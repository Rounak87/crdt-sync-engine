import { Op } from '../crdt/types.js';

// ── Client → Server ───────────────────────────────────────────────────────────

export interface JoinMessage {
  type: 'join';
  docId: string;
}

export interface OpMessage {
  type: 'op';
  op: Op;
}

export type ClientMessage = JoinMessage | OpMessage;

// ── Server → Client ───────────────────────────────────────────────────────────

export interface SnapshotMessage {
  type: 'snapshot';
  ops: Op[];
}

export interface ServerOpMessage {
  type: 'op';
  op: Op;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type ServerMessage = SnapshotMessage | ServerOpMessage | ErrorMessage;
