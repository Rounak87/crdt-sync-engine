/**
 * NodeId — globally unique identifier for every character node.
 */
export interface NodeId {
  clientId: string;
  counter: number;
}

/**
 * StateVector — maps clientId to highest operation counter processed from that client.
 * e.g. { "alice": 12, "bob": 7 }
 */
export type StateVector = Record<string, number>;

/**
 * RGANode — one character in the document.
 */
export interface RGANode {
  id: NodeId;
  originId: NodeId | null;
  value: string;
  isDeleted: boolean;
}

// ── Operation types ────────────────────────────────────────────────────────
export interface InsertOp {
  type: 'insert';
  id: NodeId;
  originId: NodeId | null;
  value: string;
}

export interface DeleteOp {
  type: 'delete';
  targetId: NodeId;
}

export type Op = InsertOp | DeleteOp;
