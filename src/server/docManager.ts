import { WebSocket } from 'ws';
import { RGA } from '../crdt/RGA.js';
import { Op } from '../crdt/types.js';
import { saveOp, getOpsForDoc } from '../db/opStore.js';

interface DocState {
  rga: RGA;
  clients: Set<WebSocket>;
  ops: Op[]; // in-memory op log — used for snapshot delivery to new clients
}

// One entry per active document. Persists across client connects/disconnects.
// On server restart, documents are lazily reloaded from Postgres on first access.
const docs = new Map<string, DocState>();

export async function getOrCreateDoc(docId: string): Promise<DocState> {
  if (docs.has(docId)) return docs.get(docId)!;

  const ops = await getOpsForDoc(docId);
  const rga = new RGA();
  rga.applyAll(ops);

  const state: DocState = { rga, clients: new Set(), ops };
  docs.set(docId, state);
  return state;
}

export function addClient(docId: string, ws: WebSocket): void {
  docs.get(docId)?.clients.add(ws);
}

export function removeClient(docId: string, ws: WebSocket): void {
  docs.get(docId)?.clients.delete(ws);
}

export function getOps(docId: string): Op[] {
  return docs.get(docId)?.ops ?? [];
}

// Apply op to in-memory RGA, persist to Postgres, broadcast to all other clients.
export async function applyAndBroadcast(
  docId: string,
  op: Op,
  sender: WebSocket
): Promise<void> {
  const doc = docs.get(docId);
  if (!doc) return;

  doc.rga.apply(op);
  doc.ops.push(op);

  await saveOp(docId, op);

  const payload = JSON.stringify({ type: 'op', op });
  for (const client of doc.clients) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}
