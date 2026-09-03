import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { attachWebSocketServer } from './wsHandler.js';
import { getOpsHistoryForDoc, getOpsForDoc } from '../db/opStore.js';
import { RGA } from '../crdt/RGA.js';

const PORT = process.env.PORT ?? 3000;

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/** REST API: Fetch full document operation history for Time-Travel playback */
app.get('/api/docs/:docId/history', async (req, res) => {
  try {
    const { docId } = req.params;
    const history = await getOpsHistoryForDoc(docId);
    res.json({ docId, count: history.length, ops: history });
  } catch (err) {
    console.error('Failed to fetch doc history:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/** REST API: Compute document state at a specific historical step index */
app.get('/api/docs/:docId/at-step/:step', async (req, res) => {
  try {
    const { docId, step } = req.params;
    const stepNum = parseInt(step, 10);
    const allOps = await getOpsForDoc(docId);

    const opsToApply = isNaN(stepNum) ? allOps : allOps.slice(0, Math.max(0, stepNum));

    const historicalRga = new RGA();
    historicalRga.applyAll(opsToApply);

    res.json({
      docId,
      step: opsToApply.length,
      totalOps: allOps.length,
      text: historicalRga.toString(),
      visibleLength: historicalRga.length,
    });
  } catch (err) {
    console.error('Failed to calculate historical state:', err);
    res.status(500).json({ error: 'Failed to calculate state' });
  }
});

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });
attachWebSocketServer(wss);

httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`WebSocket ready on ws://localhost:${PORT}`);
});
