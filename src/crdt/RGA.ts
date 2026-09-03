import type { NodeId, RGANode, Op, StateVector } from './types.js';

/**
 * RGA (Replicated Growable Array) — the conflict-resolution core.
 */
export class RGA {
  private nodes: RGANode[] = [];
  private nodeMap = new Map<string, RGANode>();
  private pendingOps: Op[] = [];
  private _flushing = false;

  // Active State Vector: maps clientId -> highest counter processed from that client
  private stateVector: StateVector = {};

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

    // Update state vector for the client who generated this operation
    const targetId = op.type === 'insert' ? op.id : op.targetId;
    this._updateStateVector(targetId.clientId, targetId.counter);

    if (!this._flushing) this._flushPending();
  }

  applyAll(ops: Op[]): void {
    for (const op of ops) this.apply(op);
  }

  /** Export copy of current State Vector */
  getStateVector(): StateVector {
    return { ...this.stateVector };
  }

  toString(): string {
    return this.nodes
      .filter(n => !n.isDeleted)
      .map(n => n.value)
      .join('');
  }

  toArray(): Array<{ id: NodeId; value: string }> {
    return this.nodes
      .filter(n => !n.isDeleted)
      .map(n => ({ id: n.id, value: n.value }));
  }

  get length(): number {
    return this.nodes.filter(n => !n.isDeleted).length;
  }

  // ── Internal Helpers ───────────────────────────────────────────────────────

  private _updateStateVector(clientId: string, counter: number): void {
    if (clientId === '__root__') return;
    const currentMax = this.stateVector[clientId] ?? 0;
    if (counter > currentMax) {
      this.stateVector[clientId] = counter;
    }
  }

  private _applyInsert(id: NodeId, originId: NodeId | null, value: string): void {
    if (this.nodeMap.has(RGA.serializeId(id))) return;

    const effectiveOriginId = originId ?? RGA.ROOT_ID;
    const originNode = this.nodeMap.get(RGA.serializeId(effectiveOriginId));

    if (!originNode) {
      this.pendingOps.push({ type: 'insert', id, originId, value });
      return;
    }

    const newNode: RGANode = { id, originId: effectiveOriginId, value, isDeleted: false };
    const pos = this._findInsertPosition(newNode, originNode);
    this.nodes.splice(pos, 0, newNode);
    this.nodeMap.set(RGA.serializeId(id), newNode);
  }

  private _findInsertPosition(newNode: RGANode, originNode: RGANode): number {
    const originIdx = this.nodes.indexOf(originNode);
    let i = originIdx + 1;

    while (i < this.nodes.length) {
      const q = this.nodes[i];
      const qOriginNode = this.nodeMap.get(RGA.serializeId(q.originId ?? RGA.ROOT_ID));
      const qOriginIdx = qOriginNode ? this.nodes.indexOf(qOriginNode) : 0;

      if (qOriginIdx < originIdx) break;

      if (qOriginIdx === originIdx) {
        if (RGA.compareIds(q.id, newNode.id) > 0) { i++; continue; }
        else break;
      }

      i++;
    }

    return i;
  }

  private _applyDelete(targetId: NodeId): void {
    const node = this.nodeMap.get(RGA.serializeId(targetId));
    if (!node) {
      this.pendingOps.push({ type: 'delete', targetId });
      return;
    }
    node.isDeleted = true;
  }

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
      }
    } finally {
      this._flushing = false;
    }
  }

  static serializeId(id: NodeId): string {
    return `${id.clientId}@${id.counter}`;
  }

  static compareIds(a: NodeId, b: NodeId): number {
    if (a.counter !== b.counter) return a.counter - b.counter;
    return a.clientId.localeCompare(b.clientId);
  }

  debugDump(): void {
    console.log('─── RGA State ───');
    for (const n of this.nodes) {
      const id = RGA.serializeId(n.id).padEnd(14);
      const org = RGA.serializeId(n.originId ?? RGA.ROOT_ID).padEnd(14);
      const val = n.id.clientId === '__root__' ? '[ROOT]' : `'${n.value}'`;
      console.log(`  ${n.isDeleted ? '💀' : '✅'}  ${id}  origin=${org}  val=${val}`);
    }
    console.log(`─── Rendered: "${this.toString()}" ───`);
  }
}
