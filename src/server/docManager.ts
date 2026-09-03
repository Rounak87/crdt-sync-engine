import { WebSocket } from 'ws';
import { RGA } from '../crdt/RGA.js';
import type { Op, StateVector } from '../crdt/types.js';
import { saveOp, getOpsForDoc, getOpsDeltaForDoc } from '../db/opStore.js';

interface DocState {
  rga: RGA;
  clients: Set<WebSocket>;
  ops: Op[];
}

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

export function getStateVector(docId: string): StateVector {
  return docs.get(docId)?.rga.getStateVector() ?? {};
}

/** Compute delta ops missing from client's stateVector */
export async function getMissingOpsDelta(docId: string, clientVector: StateVector): Promise<Op[]> {
  const docOps = docs.get(docId)?.ops;
  if (docOps) {
    return docOps.filter((op) => {
      const targetId = op.type === 'insert' ? op.id : op.targetId;
      const clientKnownCounter = clientVector[targetId.clientId] ?? 0;
      return targetId.counter > clientKnownCounter;
    });
  }
  return getOpsDeltaForDoc(docId, clientVector);
}

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
