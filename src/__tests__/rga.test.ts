import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { RGA } from '../crdt/RGA.js';
import { Op, NodeId, InsertOp } from '../crdt/types.js';

// Apply ops to a fresh RGA and return the rendered string.
function applyAll(ops: Op[]): string {
  const rga = new RGA();
  rga.applyAll(ops);
  return rga.toString();
}

// Reorder ops using float sort keys controlled by fast-check (enables shrinking on failure).
function permute(ops: Op[], keys: number[]): Op[] {
  return ops
    .map((op, i) => ({ op, key: keys[i] ?? 0 }))
    .sort((a, b) => a.key - b.key)
    .map(x => x.op);
}

// ── Unit tests ────────────────────────────────────────────────────────────────

describe('RGA core behaviour', () => {

  test('sequential inserts build the document in order', () => {
    const rga = new RGA();
    let prevId: NodeId | null = null;
    for (const [i, char] of [...'hello'].entries()) {
      const id = { clientId: 'alice', counter: i + 1 };
      rga.apply({ type: 'insert', id, originId: prevId, value: char });
      prevId = id;
    }
    expect(rga.toString()).toBe('hello');
  });

  test('delete tombstones a node and hides it from output', () => {
    const rga = new RGA();
    const id = { clientId: 'alice', counter: 1 };
    rga.apply({ type: 'insert', id, originId: null, value: 'X' });
    expect(rga.toString()).toBe('X');
    rga.apply({ type: 'delete', targetId: id });
    expect(rga.toString()).toBe('');
    expect(rga.length).toBe(0);
  });

  test('deleting the same node twice is a no-op', () => {
    const rga = new RGA();
    const id = { clientId: 'alice', counter: 1 };
    rga.apply({ type: 'insert', id, originId: null, value: 'X' });
    rga.apply({ type: 'delete', targetId: id });
    rga.apply({ type: 'delete', targetId: id }); // duplicate — must not throw
    expect(rga.toString()).toBe('');
  });

  test('applying the same insert twice is a no-op', () => {
    const op: Op = { type: 'insert', id: { clientId: 'alice', counter: 1 }, originId: null, value: 'A' };
    const rga = new RGA();
    rga.apply(op);
    rga.apply(op);
    expect(rga.toString()).toBe('A');
  });

  test('out-of-order delivery: ops arrive C then B then A, resolve to ABC', () => {
    const rga = new RGA();
    const id1: NodeId = { clientId: 'alice', counter: 1 };
    const id2: NodeId = { clientId: 'alice', counter: 2 };
    const id3: NodeId = { clientId: 'alice', counter: 3 };
    const op1: Op = { type: 'insert', id: id1, originId: null, value: 'A' };
    const op2: Op = { type: 'insert', id: id2, originId: id1,  value: 'B' };
    const op3: Op = { type: 'insert', id: id3, originId: id2,  value: 'C' };
    rga.apply(op3); // buffered — origin missing
    rga.apply(op2); // buffered — origin missing
    rga.apply(op1); // resolves A, buffer flushes B then C
    expect(rga.toString()).toBe('ABC');
  });

  test('delete arrives before its insert: character is never visible', () => {
    const rga = new RGA();
    const id: NodeId = { clientId: 'alice', counter: 1 };
    rga.apply({ type: 'delete', targetId: id });                       // buffered
    rga.apply({ type: 'insert', id, originId: null, value: 'X' });    // insert lands, delete flushes
    expect(rga.toString()).toBe('');
  });

  test('concurrent inserts at same position: tie-break by clientId', () => {
    // "bob" > "alice" lexicographically — B sorts first on both replicas
    const opAlice: Op = { type: 'insert', id: { clientId: 'alice', counter: 1 }, originId: null, value: 'A' };
    const opBob:   Op = { type: 'insert', id: { clientId: 'bob',   counter: 1 }, originId: null, value: 'B' };
    const r1 = new RGA(); r1.apply(opAlice); r1.apply(opBob);
    const r2 = new RGA(); r2.apply(opBob);   r2.apply(opAlice);
    expect(r1.toString()).toBe('BA');
    expect(r1.toString()).toBe(r2.toString());
  });

  test('concurrent inserts at same position: higher counter wins over clientId', () => {
    // alice counter=5, bob counter=2 — alice wins despite "bob" > "alice"
    const opAlice: Op = { type: 'insert', id: { clientId: 'alice', counter: 5 }, originId: null, value: 'A' };
    const opBob:   Op = { type: 'insert', id: { clientId: 'bob',   counter: 2 }, originId: null, value: 'B' };
    const r1 = new RGA(); r1.apply(opAlice); r1.apply(opBob);
    const r2 = new RGA(); r2.apply(opBob);   r2.apply(opAlice);
    expect(r1.toString()).toBe('AB');
    expect(r1.toString()).toBe(r2.toString());
  });

  test('child of winning sibling stays grouped with its parent (Case C)', () => {
    // alice@2 (counter=2) wins over bob@1 (counter=1) → A sorts first.
    // O was typed after B, so O must stay grouped after B regardless of arrival order.
    const H:   NodeId = { clientId: 'alice', counter: 1 };
    const idA: NodeId = { clientId: 'alice', counter: 2 };
    const idB: NodeId = { clientId: 'bob',   counter: 1 };
    const idO: NodeId = { clientId: 'bob',   counter: 2 };
    const opH: Op = { type: 'insert', id: H,   originId: null, value: 'H' };
    const opA: Op = { type: 'insert', id: idA, originId: H,    value: 'A' };
    const opB: Op = { type: 'insert', id: idB, originId: H,    value: 'B' };
    const opO: Op = { type: 'insert', id: idO, originId: idB,  value: 'O' };
    const r1 = new RGA(); r1.apply(opH); r1.apply(opA); r1.apply(opB); r1.apply(opO);
    const r2 = new RGA(); r2.apply(opH); r2.apply(opB); r2.apply(opO); r2.apply(opA);
    expect(r1.toString()).toBe(r2.toString());
    expect(r1.toString()).toBe('HABO');
  });

});

// ── Property tests — convergence proof ───────────────────────────────────────
// Each test runs 300-500 random trials. fast-check generates op sets and
// permutations automatically. On failure it shrinks to the minimal failing case.

describe('Strong Eventual Consistency (fuzz proof)', () => {

  test('concurrent inserts at same position converge for any delivery order', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 1 }), { minLength: 2, maxLength: 15 }),
        fc.array(fc.float({ min: 0, max: 1 }), { minLength: 15, maxLength: 15 }),
        (chars, sortKeys) => {
          // All chars from unique clients with same origin — maximum concurrent conflict.
          const ops: Op[] = chars.map((char, i) => ({
            type: 'insert' as const,
            id: { clientId: `c${i}`, counter: 1 },
            originId: null,
            value: char,
          }));
          return applyAll(ops) === applyAll(permute(ops, sortKeys));
        }
      ),
      { numRuns: 500 }
    );
  });

  test('sequential chain from one client converges in any delivery order', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 20 }),
        fc.array(fc.float({ min: 0, max: 1 }), { minLength: 20, maxLength: 20 }),
        (word, sortKeys) => {
          const ops: Op[] = [];
          let prevId: NodeId | null = null;
          for (const [i, char] of [...word].entries()) {
            const id = { clientId: 'alice', counter: i + 1 };
            ops.push({ type: 'insert', id, originId: prevId, value: char });
            prevId = id;
          }
          return applyAll(ops) === applyAll(permute(ops, sortKeys));
        }
      ),
      { numRuns: 500 }
    );
  });

  test('multi-client concurrent edits converge regardless of delivery order', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            clientId: fc.constantFrom('alice', 'bob', 'charlie', 'dave'),
            word: fc.string({ minLength: 1, maxLength: 5 }),
          }),
          { minLength: 2, maxLength: 6 }
        ),
        fc.array(fc.float({ min: 0, max: 1 }), { minLength: 30, maxLength: 30 }),
        (clients, sortKeys) => {
          const allOps: Op[] = [];
          const counters: Record<string, number> = {};
          for (const { clientId, word } of clients) {
            counters[clientId] = counters[clientId] ?? 0;
            let prevId: NodeId | null = null;
            for (const char of word) {
              const id = { clientId, counter: ++counters[clientId] };
              allOps.push({ type: 'insert', id, originId: prevId, value: char });
              prevId = id;
            }
          }
          return applyAll(allOps) === applyAll(permute(allOps, sortKeys));
        }
      ),
      { numRuns: 300 }
    );
  });

  test('mix of inserts and deletes converge regardless of delivery order', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 1 }), { minLength: 3, maxLength: 12 }),
        fc.array(fc.float({ min: 0, max: 1 }), { minLength: 25, maxLength: 25 }),
        (chars, sortKeys) => {
          const insertOps: InsertOp[] = chars.map((char, i) => ({
            type: 'insert',
            id: { clientId: `c${i}`, counter: 1 },
            originId: null,
            value: char,
          }));
          const deleteOps: Op[] = insertOps
            .filter((_, i) => i % 2 === 0)
            .map(op => ({ type: 'delete' as const, targetId: op.id }));
          return applyAll([...insertOps, ...deleteOps]) === applyAll(permute([...insertOps, ...deleteOps], sortKeys));
        }
      ),
      { numRuns: 300 }
    );
  });

  test('delete of concurrent insert (paragraph-deletion edge case) converges', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 1 }), { minLength: 2, maxLength: 8 }),
        fc.array(fc.float({ min: 0, max: 1 }), { minLength: 20, maxLength: 20 }),
        (chars, sortKeys) => {
          const insertOps: InsertOp[] = chars.map((char, i) => ({
            type: 'insert',
            id: { clientId: 'alice', counter: i + 1 },
            originId: i === 0 ? null : { clientId: 'alice', counter: i },
            value: char,
          }));
          const deleteOps: Op[] = insertOps.map(op => ({ type: 'delete' as const, targetId: op.id }));
          const allOps = [...insertOps, ...deleteOps];
          return applyAll(allOps) === applyAll(permute(allOps, sortKeys));
        }
      ),
      { numRuns: 300 }
    );
  });

});
