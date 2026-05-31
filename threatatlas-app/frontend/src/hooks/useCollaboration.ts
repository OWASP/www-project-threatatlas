import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/api';

export interface CollabUser {
  user_id: number;
  user_name: string;
  color: string;
}

export interface CollabCursor {
  user_id: number;
  user_name: string;
  color: string;
  x: number;  // flow coordinates
  y: number;
}

interface UseCollaborationResult {
  users: CollabUser[];
  cursors: CollabCursor[];
  notifyDiagramSaved: () => void;
  sendCursorMove: (x: number, y: number) => void;
  sendDiagramSync: (nodes: any[], edges: any[]) => void;
}

interface UseCollaborationOptions {
  diagramId: number | null;
  enabled: boolean;
  onRemoteSync?: (nodes: any[], edges: any[]) => void;
  onRemoteSave?: (userName: string) => void;
}

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2000;

const CURSOR_THROTTLE_MS = 50;
const SYNC_THROTTLE_MS = 150;

export function useCollaboration({
  diagramId,
  enabled,
  onRemoteSync,
  onRemoteSave,
}: UseCollaborationOptions): UseCollaborationResult {
  const [users, setUsers] = useState<CollabUser[]>([]);
  const [cursors, setCursors] = useState<CollabCursor[]>([]);
  const onRemoteSaveRef = useRef(onRemoteSave);
  onRemoteSaveRef.current = onRemoteSave;

  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCursorSendRef = useRef(0);
  const lastSyncSendRef = useRef(0);
  const onRemoteSyncRef = useRef(onRemoteSync);
  onRemoteSyncRef.current = onRemoteSync;
  // Track whether the hook is still mounted / the current diagramId to avoid
  // stale closures racing with React re-renders.
  const mountedRef = useRef(true);
  const currentDiagramIdRef = useRef<number | null>(null);

  const clearRetryTimer = () => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const closeWs = useCallback(() => {
    clearRetryTimer();
    if (wsRef.current) {
      // Replace handlers before closing to prevent the onclose handler from
      // scheduling a reconnect after an intentional close.
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(
    (id: number) => {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Derive WebSocket URL from API_BASE_URL so it works whether the frontend
      // and backend are on the same origin (via nginx proxy) or different ports.
      const wsBase = API_BASE_URL.replace(/^http/, 'ws');
      const url = `${wsBase}/ws/diagrams/${id}?token=${encodeURIComponent(token)}`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current || currentDiagramIdRef.current !== id) {
          ws.close();
          return;
        }
        retryCountRef.current = 0;
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current || currentDiagramIdRef.current !== id) return;
        try {
          const msg = JSON.parse(event.data as string);
          switch (msg.type) {
            case 'room_state':
              setUsers(msg.users as CollabUser[]);
              break;
            case 'user_joined':
              setUsers((prev) => {
                // Avoid duplicates (e.g. reconnect race)
                if (prev.some((u) => u.user_id === msg.user.user_id)) return prev;
                return [...prev, msg.user as CollabUser];
              });
              break;
            case 'user_left':
              setUsers((prev) =>
                prev.filter((u) => u.user_id !== (msg.user as CollabUser).user_id),
              );
              setCursors((prev) => prev.filter((c) => c.user_id !== (msg.user as CollabUser).user_id));
              break;
            case 'diagram_updated':
              try { onRemoteSaveRef.current?.(msg.user_name as string); } catch (e) { console.error('[collab] onRemoteSave error', e); }
              break;
            case 'cursor_update':
              setCursors((prev) => {
                const filtered = prev.filter((c) => c.user_id !== msg.user_id);
                return [...filtered, { user_id: msg.user_id, user_name: msg.user_name, color: msg.color, x: msg.x, y: msg.y }];
              });
              break;
            case 'diagram_sync':
              try { onRemoteSyncRef.current?.(msg.nodes, msg.edges); } catch (e) { console.error('[collab] onRemoteSync error', e); }
              break;
            case 'error':
              console.warn('[collab] server error:', msg.message);
              break;
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onerror = () => {
        // onclose will fire next and handle reconnection
      };

      ws.onclose = () => {
        if (!mountedRef.current || currentDiagramIdRef.current !== id) return;
        wsRef.current = null;
        setUsers([]);
        setCursors([]);

        if (retryCountRef.current < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, retryCountRef.current);
          retryCountRef.current += 1;
          retryTimerRef.current = setTimeout(() => {
            if (mountedRef.current && currentDiagramIdRef.current === id) {
              connect(id);
            }
          }, delay);
        }
      };
    },
    // connect itself has no external deps — it reads from refs + closures
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Tear down any previous connection first
    closeWs();
    setUsers([]);
    setCursors([]);
    retryCountRef.current = 0;
    currentDiagramIdRef.current = diagramId;

    if (enabled && diagramId !== null) {
      connect(diagramId);
    }

    return () => {
      closeWs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramId, enabled]);

  const notifyDiagramSaved = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'diagram_saved' }));
    }
  }, []);

  const sendCursorMove = useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastCursorSendRef.current < CURSOR_THROTTLE_MS) return;
    lastCursorSendRef.current = now;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cursor_move', x, y }));
    }
  }, []);

  const sendDiagramSync = useCallback((nodes: any[], edges: any[]) => {
    const now = Date.now();
    if (now - lastSyncSendRef.current < SYNC_THROTTLE_MS) return;
    lastSyncSendRef.current = now;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'diagram_sync', nodes, edges }));
    }
  }, []);

  return { users, cursors, notifyDiagramSaved, sendCursorMove, sendDiagramSync };
}
