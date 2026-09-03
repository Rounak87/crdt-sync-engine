import { useState, useEffect, useRef, useCallback } from 'react';
import { RGA } from '../../../src/crdt/RGA';
import type { NodeId, Op, StateVector } from '../../../src/crdt/types';
import type { ClientMessage, ServerMessage } from '../../../src/protocol/messages';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface CRDTNodeView {
  id: NodeId;
  originId: NodeId | null;
  value: string;
  isDeleted: boolean;
}

// Get or create persistent clientId in localStorage
function getPersistentClientId(): string {
  const KEY = 'crdt_client_id';
  let stored = localStorage.getItem(KEY);
  if (!stored) {
    stored = `usr_${Math.random().toString(36).substring(2, 7)}`;
    localStorage.setItem(KEY, stored);
  }
  return stored;
}

export function useCRDT(initialDocId: string = 'demo-doc', serverUrl: string = 'ws://localhost:3000') {
  const [docId, setDocId] = useState<string>(initialDocId);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [docText, setDocText] = useState<string>('');
  const [nodesView, setNodesView] = useState<CRDTNodeView[]>([]);
  const [opCount, setOpCount] = useState<number>(0);
  const [tombstoneCount, setTombstoneCount] = useState<number>(0);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const [queuedOpsCount, setQueuedOpsCount] = useState<number>(0);
  const [stateVectorView, setStateVectorView] = useState<StateVector>({});
  
  // Persistent Client ID across page refreshes
  const [clientId, setClientId] = useState<string>(getPersistentClientId);

  const counterRef = useRef<number>(0);
  const rgaRef = useRef<RGA>(new RGA());
  const wsRef = useRef<WebSocket | null>(null);
  const offlineQueueRef = useRef<Op[]>([]);

  // Update persistent client ID
  const updateClientId = (newId: string) => {
    const trimmed = newId.trim();
    if (trimmed) {
      localStorage.setItem('crdt_client_id', trimmed);
      setClientId(trimmed);
    }
  };

  // Update local React state from RGA core
  const updateLocalState = useCallback(() => {
    const rga = rgaRef.current;
    setDocText(rga.toString());

    // @ts-expect-error accessing internal nodes for inspector
    const rawNodes: any[] = rga.nodes ?? [];

    const views: CRDTNodeView[] = rawNodes.map((n) => ({
      id: n.id,
      originId: n.originId,
      value: n.value,
      isDeleted: n.isDeleted,
    }));

    setNodesView(views);
    setTombstoneCount(views.filter((v) => v.isDeleted && v.id.clientId !== '__root__').length);
    setStateVectorView(rga.getStateVector());
    setQueuedOpsCount(offlineQueueRef.current.length);
  }, []);

  // Connect & Sync effect
  useEffect(() => {
    if (isSimulatedOffline) {
      if (wsRef.current) wsRef.current.close();
      setStatus('disconnected');
      return;
    }

    setStatus('connecting');
    const ws = new WebSocket(serverUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      const currentVector = rgaRef.current.getStateVector();
      const hasExistingState = Object.keys(currentVector).length > 0;

      if (hasExistingState) {
        const syncMsg: ClientMessage = {
          type: 'sync-request',
          docId,
          stateVector: currentVector,
        };
        ws.send(JSON.stringify(syncMsg));
      } else {
        const joinMsg: ClientMessage = { type: 'join', docId };
        ws.send(JSON.stringify(joinMsg));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);

        if (msg.type === 'snapshot') {
          rgaRef.current = new RGA();
          rgaRef.current.applyAll(msg.ops);
          setOpCount(msg.ops.length);
          updateLocalState();
          flushOfflineQueue();

        } else if (msg.type === 'sync-response') {
          rgaRef.current.applyAll(msg.missingOps);
          setOpCount((prev) => prev + msg.missingOps.length);
          updateLocalState();
          flushOfflineQueue();

        } else if (msg.type === 'op') {
          rgaRef.current.apply(msg.op);
          setOpCount((prev) => prev + 1);
          updateLocalState();
        }
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };

    ws.onerror = () => setStatus('error');
    ws.onclose = () => setStatus('disconnected');

    return () => {
      ws.close();
    };
  }, [docId, serverUrl, isSimulatedOffline, updateLocalState]);

  const flushOfflineQueue = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const queue = [...offlineQueueRef.current];
    if (queue.length === 0) return;

    for (const op of queue) {
      const opMsg: ClientMessage = { type: 'op', op };
      wsRef.current.send(JSON.stringify(opMsg));
    }

    offlineQueueRef.current = [];
    setQueuedOpsCount(0);
  };

  const insertChar = useCallback(
    (char: string, visibleIndex: number) => {
      const visible = rgaRef.current.toArray();
      const originId =
        visibleIndex > 0 && visibleIndex <= visible.length
          ? visible[visibleIndex - 1].id
          : null;

      const newId: NodeId = {
        clientId: clientId,
        counter: ++counterRef.current,
      };

      const op: Op = {
        type: 'insert',
        id: newId,
        originId,
        value: char,
      };

      rgaRef.current.apply(op);
      setOpCount((prev) => prev + 1);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !isSimulatedOffline) {
        const opMsg: ClientMessage = { type: 'op', op };
        wsRef.current.send(JSON.stringify(opMsg));
      } else {
        offlineQueueRef.current.push(op);
      }

      updateLocalState();
    },
    [clientId, isSimulatedOffline, updateLocalState]
  );

  const deleteChar = useCallback(
    (visibleIndex: number) => {
      const visible = rgaRef.current.toArray();
      if (visibleIndex < 0 || visibleIndex >= visible.length) return;

      const targetId = visible[visibleIndex].id;
      const op: Op = {
        type: 'delete',
        targetId,
      };

      rgaRef.current.apply(op);
      setOpCount((prev) => prev + 1);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !isSimulatedOffline) {
        const opMsg: ClientMessage = { type: 'op', op };
        wsRef.current.send(JSON.stringify(opMsg));
      } else {
        offlineQueueRef.current.push(op);
      }

      updateLocalState();
    },
    [isSimulatedOffline, updateLocalState]
  );

  const toggleSimulatedOffline = () => {
    setIsSimulatedOffline((prev) => !prev);
  };

  const reconnect = useCallback(() => {
    setIsSimulatedOffline(false);
    setDocId((prev) => prev);
  }, []);

  return {
    docId,
    setDocId,
    status,
    docText,
    nodesView,
    opCount,
    tombstoneCount,
    visibleLength: rgaRef.current.length,
    clientId,
    updateClientId,
    stateVectorView,
    queuedOpsCount,
    isSimulatedOffline,
    toggleSimulatedOffline,
    insertChar,
    deleteChar,
    reconnect,
  };
}
