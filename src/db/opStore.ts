import pool from './pool.js';
import type { Op, StateVector } from '../crdt/types.js';

export interface OpRow {
  id: number;
  doc_id: string;
  payload: Op;
  created_at: string;
}

export async function saveOp(docId: string, op: Op): Promise<void> {
  await pool.query(
    `INSERT INTO ops (doc_id, payload) VALUES ($1, $2)`,
    [docId, JSON.stringify(op)]
  );
}

export async function getOpsForDoc(docId: string): Promise<Op[]> {
  const result = await pool.query(
    `SELECT payload FROM ops WHERE doc_id = $1 ORDER BY id ASC`,
    [docId]
  );
  return result.rows.map(row => row.payload as Op);
}

/** Fetch full historical op log with database IDs and timestamps for time-travel */
export async function getOpsHistoryForDoc(docId: string): Promise<OpRow[]> {
  const result = await pool.query(
    `SELECT id, doc_id, payload, created_at FROM ops WHERE doc_id = $1 ORDER BY id ASC`,
    [docId]
  );
  return result.rows.map(row => ({
    id: row.id,
    doc_id: row.doc_id,
    payload: row.payload as Op,
    created_at: row.created_at,
  }));
}

/** Filter and return ops for docId that the client has NOT seen according to clientVector */
export async function getOpsDeltaForDoc(docId: string, clientVector: StateVector): Promise<Op[]> {
  const allOps = await getOpsForDoc(docId);
  return allOps.filter((op) => {
    const targetId = op.type === 'insert' ? op.id : op.targetId;
    const clientKnownCounter = clientVector[targetId.clientId] ?? 0;
    return targetId.counter > clientKnownCounter;
  });
}
