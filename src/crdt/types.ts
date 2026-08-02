/**
 * NodeId — globally unique identifier for every character node.
 *
 * clientId: who created it (e.g. a UUID assigned to each browser tab)
 * counter:  monotonically increasing per client (1st char = 1, 2nd = 2, ...)
 *
 * Using (clientId, counter) instead of a position index means the identity
 * of a character never changes when concurrent edits shift things around.
 */
export interface NodeId {
  clientId: string;
  counter: number;
}

/**
 * RGANode — one character in the document.
 *
 * originId: the ID of the node this was inserted after. Null = start of doc.
 *           This is a permanent, immutable anchor — never re-computed.
 *
 * isDeleted: tombstone flag. Nodes are never physically removed because
 *            future inserts may reference a deleted node as their origin.
 */
export interface RGANode {
  id: NodeId;
  originId: NodeId | null;
  value: string;
  isDeleted: boolean;
}

// ── Operation types ────────────────────────────────────────────────────────
// These are the messages sent over the network and persisted to the database.

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
