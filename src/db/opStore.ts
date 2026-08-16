import pool from './pool.js';
import { Op } from '../crdt/types.js';

// Persist one op to the append-only log.
// Simple insert — RGA idempotency handles any duplicates on replay.
export async function saveOp(docId: string, op: Op): Promise<void> {
  await pool.query(
    `INSERT INTO ops (doc_id, payload) VALUES ($1, $2)`,
    [docId, JSON.stringify(op)]
  );
}

// Load all ops for a document in insertion order.
// Used to replay document state on server start or new client join.
export async function getOpsForDoc(docId: string): Promise<Op[]> {
  const result = await pool.query(
    `SELECT payload FROM ops WHERE doc_id = $1 ORDER BY id ASC`,
    [docId]
  );
  return result.rows.map(row => row.payload as Op);
}
