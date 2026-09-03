import { WebSocket, WebSocketServer } from 'ws';
import type { ClientMessage } from '../protocol/messages.js';
import {
  getOrCreateDoc,
  addClient,
  removeClient,
  getOps,
  getStateVector,
  getMissingOpsDelta,
  applyAndBroadcast,
} from './docManager.js';

const clientDocs = new Map<WebSocket, string>();

export function attachWebSocketServer(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket) => {
    console.log('[ws] client connected');

    ws.on('message', async (raw: Buffer) => {
      try {
        const msg: ClientMessage = JSON.parse(raw.toString());

        if (msg.type === 'join') {
          const { docId } = msg;

          await getOrCreateDoc(docId);

          addClient(docId, ws);
          clientDocs.set(ws, docId);

          ws.send(
            JSON.stringify({
              type: 'snapshot',
              ops: getOps(docId),
              stateVector: getStateVector(docId),
            })
          );
          console.log(`[ws] client joined doc "${docId}" — ${getOps(docId).length} ops in history`);

        } else if (msg.type === 'sync-request') {
          const { docId, stateVector } = msg;
          await getOrCreateDoc(docId);
          addClient(docId, ws);
          clientDocs.set(ws, docId);

          const missingOps = await getMissingOpsDelta(docId, stateVector);
          const serverVector = getStateVector(docId);

          ws.send(
            JSON.stringify({
              type: 'sync-response',
              missingOps,
              stateVector: serverVector,
            })
          );
          console.log(`[ws] client sync-request for doc "${docId}" — streaming ${missingOps.length} delta ops`);

        } else if (msg.type === 'op') {
          const docId = clientDocs.get(ws);
          if (!docId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Must join a document first.' }));
            return;
          }
          await applyAndBroadcast(docId, msg.op, ws);
        }

      } catch (err) {
        console.error('[ws] message error:', err);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format.' }));
      }
    });

    ws.on('close', () => {
      const docId = clientDocs.get(ws);
      if (docId) {
        removeClient(docId, ws);
        clientDocs.delete(ws);
      }
      console.log('[ws] client disconnected');
    });

    ws.on('error', (err) => console.error('[ws] socket error:', err));
  });
}
