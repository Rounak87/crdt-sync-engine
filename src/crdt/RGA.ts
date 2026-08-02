import { NodeId, RGANode, Op } from './types.js';

/**
 * RGA (Replicated Growable Array) — the conflict-resolution core.
 *
 * Every client holds one instance. All replicas receive the same set of ops
 * (in any order) and converge to an identical document. No central locking.
 */
export class RGA {
  // Ordered node list — array index = display order.
  private nodes: RGANode[] = [];

  // O(1) lookup by serialized NodeId key.
  private nodeMap = new Map<string, RGANode>();

  // Ops buffered because their origin node hasn't arrived yet (out-of-order delivery).
  private pendingOps: Op[] = [];

  // Guard: prevents apply() → _flushPending() → apply() infinite recursion.
  private _flushing = false;

  // Invisible sentinel that anchors inserts at the start of the document.
  private static readonly ROOT_ID: NodeId = { clientId: '__root__', counter: -1 };

  constructor() {
    const root: RGANode = { id: RGA.ROOT_ID, originId: null, value: '', isDeleted: true };
    this.nodes.push(root);
    this.nodeMap.set(RGA.serializeId(RGA.ROOT_ID), root);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  apply(op: Op): void {
    if (op.type === 'insert') {
      this._applyInsert(op.id, op.originId, op.value);
    } else {
      this._applyDelete(op.targetId);
    }
    if (!this._flushing) this._flushPending();
  }

  applyAll(ops: Op[]): void {
    for (const op of ops) this.apply(op);
  }

  toString(): string {
    return this.nodes
      .filter(n => !n.isDeleted)
      .map(n => n.value)
      .join('');
  }

  /** Returns visible characters with their IDs (used for cursor tracking later). */
  toArray(): Array<{ id: NodeId; value: string }> {
    return this.nodes
      .filter(n => !n.isDeleted)
      .map(n => ({ id: n.id, value: n.value }));
  }

  get length(): number {
    return this.nodes.filter(n => !n.isDeleted).length;
  }

  // ── Insert ────────────────────────────────────────────────────────────────

  private _applyInsert(id: NodeId, originId: NodeId | null, value: string): void {
    // Idempotency: duplicate delivery on reconnect is a no-op.
    if (this.nodeMap.has(RGA.serializeId(id))) return;

    const effectiveOriginId = originId ?? RGA.ROOT_ID;
    const originNode = this.nodeMap.get(RGA.serializeId(effectiveOriginId));

    if (!originNode) {
      // Origin not yet received — park and retry when it arrives.
      this.pendingOps.push({ type: 'insert', id, originId, value });
      return;
    }

    const newNode: RGANode = { id, originId: effectiveOriginId, value, isDeleted: false };
    const pos = this._findInsertPosition(newNode, originNode);
    this.nodes.splice(pos, 0, newNode);
    this.nodeMap.set(RGA.serializeId(id), newNode);
  }

  /**
   * Finds where newNode belongs in the ordered list.
   *
   * Scans rightward from originNode. At each candidate Q:
   *   Case A (qOriginIdx < originIdx): Q is from an earlier context — stop, insert before Q.
   *   Case B (qOriginIdx = originIdx): sibling — tie-break by ID; skip Q if Q wins, stop if we win.
   *   Case C (qOriginIdx > originIdx): Q is a child of a winning sibling — skip (keep it grouped).
   */
  private _findInsertPosition(newNode: RGANode, originNode: RGANode): number {
    const originIdx = this.nodes.indexOf(originNode);
    let i = originIdx + 1;

    while (i < this.nodes.length) {
      const q = this.nodes[i];
      const qOriginNode = this.nodeMap.get(RGA.serializeId(q.originId ?? RGA.ROOT_ID));
      const qOriginIdx = qOriginNode ? this.nodes.indexOf(qOriginNode) : 0;

      if (qOriginIdx < originIdx) break;                           // Case A

      if (qOriginIdx === originIdx) {                              // Case B
        if (RGA.compareIds(q.id, newNode.id) > 0) { i++; continue; } // Q wins
        else break;                                                    // we win
      }

      i++; // Case C
    }

    return i;
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  private _applyDelete(targetId: NodeId): void {
    const node = this.nodeMap.get(RGA.serializeId(targetId));
    if (!node) {
      this.pendingOps.push({ type: 'delete', targetId });
      return;
    }
    node.isDeleted = true; // tombstone; idempotent
  }

  // ── Pending buffer ────────────────────────────────────────────────────────

  /**
   * Retries buffered ops after each successful insert.
   * Loops until no more ops can be resolved (fixed point).
   * _flushing flag prevents re-entrant calls from apply().
   */
  private _flushPending(): void {
    if (this.pendingOps.length === 0) return;

    this._flushing = true;
    try {
      let madeProgress = true;
      while (madeProgress) {
        madeProgress = false;
        const snapshot = this.pendingOps;
        this.pendingOps = [];

        for (const op of snapshot) {
          const before = this.nodes.length;
          if (op.type === 'insert') this._applyInsert(op.id, op.originId, op.value);
          else this._applyDelete(op.targetId);
          if (this.nodes.length > before) madeProgress = true;
        }
        // Failed ops were re-pushed into this.pendingOps by the internal methods.
      }
    } finally {
      this._flushing = false;
    }
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  /** Stable string key for Map lookups. e.g. { clientId:'alice', counter:3 } → "alice@3" */
  static serializeId(id: NodeId): string {
    return `${id.clientId}@${id.counter}`;
  }

  /**
   * Tie-break comparator for concurrent siblings.
   * Returns > 0 if a sorts before b (a wins), < 0 if b wins.
   * Higher counter wins; on tie, lexicographically later clientId wins.
   * Deterministic on every replica — guarantees convergence.
   */
  static compareIds(a: NodeId, b: NodeId): number {
    if (a.counter !== b.counter) return a.counter - b.counter;
    return a.clientId.localeCompare(b.clientId);
  }

  /** Prints all nodes including tombstones. Useful for debugging. */
  debugDump(): void {
    console.log('─── RGA State ───');
    for (const n of this.nodes) {
      const id  = RGA.serializeId(n.id).padEnd(14);
      const org = RGA.serializeId(n.originId ?? RGA.ROOT_ID).padEnd(14);
      const val = n.id.clientId === '__root__' ? '[ROOT]' : `'${n.value}'`;
      console.log(`  ${n.isDeleted ? '💀' : '✅'}  ${id}  origin=${org}  val=${val}`);
    }
    console.log(`─── Rendered: "${this.toString()}" ───`);
  }
}
