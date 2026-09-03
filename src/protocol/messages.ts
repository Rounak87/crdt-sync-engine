import type { Op, StateVector } from '../crdt/types.js';

// ── Client → Server ───────────────────────────────────────────────────────────

export interface JoinMessage {
  type: 'join';
  docId: string;
}

export interface OpMessage {
  type: 'op';
  op: Op;
}

export interface SyncRequestMessage {
  type: 'sync-request';
  docId: string;
  stateVector: StateVector;
}

export type ClientMessage = JoinMessage | OpMessage | SyncRequestMessage;

// ── Server → Client ───────────────────────────────────────────────────────────

export interface SnapshotMessage {
  type: 'snapshot';
  ops: Op[];
  stateVector: StateVector;
}

export interface ServerOpMessage {
  type: 'op';
  op: Op;
}

export interface SyncResponseMessage {
  type: 'sync-response';
  missingOps: Op[];
  stateVector: StateVector;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type ServerMessage = SnapshotMessage | ServerOpMessage | SyncResponseMessage | ErrorMessage;
