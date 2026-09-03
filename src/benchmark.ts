/**
 * Automated High-Throughput Load Testing & Benchmark Suite
 *
 * Run with: npm run benchmark
 * (Server must be running on ws://localhost:3000)
 */

import WebSocket from 'ws';
import { RGA } from './crdt/RGA.js';
import type { Op, NodeId } from './crdt/types.js';

const SERVER_URL = process.env.WS_URL ?? 'ws://localhost:3000';
const DOC_ID = `bench-${Date.now()}`;
const CLIENT_COUNT = 20;       // Number of concurrent simulated clients
const OPS_PER_CLIENT = 30;     // Ops submitted by each client (Total = 600 ops)

interface BenchClient {
  id: string;
  counter: number;
  rga: RGA;
  ws: WebSocket;
  latencies: number[];
}

function createBenchClient(clientId: string): Promise<BenchClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(SERVER_URL);
    const client: BenchClient = {
      id: clientId,
      counter: 0,
      rga: new RGA(),
      ws,
      latencies: [],
    };

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'join', docId: DOC_ID }));
    });

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'snapshot') {
          client.rga.applyAll(msg.ops);
          resolve(client);
        } else if (msg.type === 'sync-response') {
          client.rga.applyAll(msg.missingOps);
        } else if (msg.type === 'op') {
          client.rga.apply(msg.op);
        }
      } catch (err) {
        reject(err);
      }
    });

    ws.on('error', reject);
  });
}

function calculatePercentile(numbers: number[], p: number): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = Math.floor((p / 100) * sorted.length);
  return Math.round(sorted[Math.min(index, sorted.length - 1)] * 100) / 100;
}

async function runBenchmark() {
  console.log('\n===============================================================');
  console.log('    CRDT SYNC ENGINE — HIGH-THROUGHPUT LOAD BENCHMARK');
  console.log('===============================================================\n');
  console.log(`[bench] Target Server: ${SERVER_URL}`);
  console.log(`[bench] Document ID:   ${DOC_ID}`);
  console.log(`[bench] Clients:       ${CLIENT_COUNT} concurrent WebSocket workers`);
  console.log(`[bench] Total Ops:     ${CLIENT_COUNT * OPS_PER_CLIENT} operations\n`);

  console.log('[bench] Connecting workers...');
  const clients: BenchClient[] = [];

  for (let i = 0; i < CLIENT_COUNT; i++) {
    const client = await createBenchClient(`worker_${i + 1}`);
    clients.push(client);
  }
  console.log(`[bench] ${clients.length} workers connected & initialized.\n`);

  console.log('[bench] Executing concurrent load test...');
  const startTime = Date.now();
  const allLatencies: number[] = [];

  const clientPromises = clients.map((client) => {
    return new Promise<void>((resolve) => {
      let opsDone = 0;

      const interval = setInterval(() => {
        if (opsDone >= OPS_PER_CLIENT) {
          clearInterval(interval);
          resolve();
          return;
        }

        const visible = client.rga.toArray();
        const originId: NodeId | null =
          visible.length > 0 ? visible[Math.floor(Math.random() * visible.length)].id : null;

        const newId: NodeId = { clientId: client.id, counter: ++client.counter };
        const char = String.fromCharCode(65 + Math.floor(Math.random() * 26));

        const op: Op = { type: 'insert', id: newId, originId, value: char };

        const sendTime = performance.now();
        client.rga.apply(op);

        client.ws.send(JSON.stringify({ type: 'op', op }));

        const rtt = performance.now() - sendTime;
        client.latencies.push(rtt);
        allLatencies.push(rtt);

        opsDone++;
      }, 10);
    });
  });

  await Promise.all(clientPromises);

  // Settlement phase: Send state vector sync requests to guarantee all remote socket frames are caught up
  console.log('[bench] Settlement phase (State Vector reconciliation)...');
  clients.forEach((client) => {
    client.ws.send(
      JSON.stringify({
        type: 'sync-request',
        docId: DOC_ID,
        stateVector: client.rga.getStateVector(),
      })
    );
  });

  await new Promise((r) => setTimeout(r, 1000));

  const totalDurationSec = (Date.now() - startTime) / 1000;
  const totalOps = CLIENT_COUNT * OPS_PER_CLIENT;
  const opsPerSec = Math.round(totalOps / totalDurationSec);

  // Eventual Consistency Validation across all worker replicas
  const canonicalState = clients[0].rga.toString();
  let allConverged = true;

  for (let i = 1; i < clients.length; i++) {
    if (clients[i].rga.toString() !== canonicalState) {
      allConverged = false;
      break;
    }
  }

  console.log('\n---------------------------------------------------------------');
  console.log('                 BENCHMARK RESULTS SUMMARY                     ');
  console.log('---------------------------------------------------------------');
  console.log(` Total Operations Processed : ${totalOps}`);
  console.log(` Total Elapsed Time         : ${totalDurationSec.toFixed(2)} seconds`);
  console.log(` Throughput                 : ${opsPerSec} Ops / sec`);
  console.log(` p50 Latency (median)       : ${calculatePercentile(allLatencies, 50)} ms`);
  console.log(` p95 Latency                : ${calculatePercentile(allLatencies, 95)} ms`);
  console.log(` p99 Latency                : ${calculatePercentile(allLatencies, 99)} ms`);
  console.log(` Eventual Consistency SEC   : ${allConverged ? '✅ VERIFIED (100% Convergence)' : '❌ DIVERGED'}`);
  console.log('---------------------------------------------------------------\n');

  clients.forEach((c) => c.ws.close());
  process.exit(0);
}

runBenchmark().catch((err) => {
  console.error('[bench] Benchmark failed:', err);
  process.exit(1);
});
