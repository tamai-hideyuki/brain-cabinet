import { useRef, useState, useCallback, useEffect } from "react";
import { WS_BASE } from "../config";

interface Segment {
  id: string;
  sessionId: string;
  text: string;
  speaker: string | null;
  confidence: number | null;
  timestamp: number;
  isFinal: number;
}

interface Suggestion {
  id: string;
  sessionId: string;
  segmentId: string | null;
  knowledgeNoteId: string | null;
  contentType: string;
  content: string;
  score: number | null;
  acknowledgedAt: number | null;
  pinnedAt: number | null;
  createdAt: number;
}

interface MindmapNode {
  id: string;
  sessionId: string;
  label: string;
  parentId: string | null;
  type: string;
  segmentId: string | null;
  createdAt: number;
}

type ServerMessage =
  | { type: "segment"; segment: Segment }
  | { type: "suggestions"; suggestions: Suggestion[] }
  | { type: "mindmap_node"; node: MindmapNode }
  | { type: "refined"; text: string };

interface UseWebSocketOptions {
  sessionId: string | null;
  onSegment: (segment: Segment) => void;
  onSuggestions: (suggestions: Suggestion[]) => void;
  onMindmapNode: (node: MindmapNode) => void;
  onRefined: (text: string) => void;
}

export function useWebSocket({
  sessionId,
  onSegment,
  onSuggestions,
  onMindmapNode,
  onRefined,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const callbacksRef = useRef({ onSegment, onSuggestions, onMindmapNode, onRefined });
  callbacksRef.current = { onSegment, onSuggestions, onMindmapNode, onRefined };

  useEffect(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}${WS_BASE}?sessionId=${sessionId}`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as ServerMessage;
      switch (msg.type) {
        case "segment":
          callbacksRef.current.onSegment(msg.segment);
          break;
        case "suggestions":
          callbacksRef.current.onSuggestions(msg.suggestions);
          break;
        case "mindmap_node":
          callbacksRef.current.onMindmapNode(msg.node);
          break;
        case "refined":
          callbacksRef.current.onRefined(msg.text);
          break;
      }
    };

    wsRef.current = ws;

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const sendBinary = useCallback((data: Blob | ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  return { connected, send, sendBinary };
}

export type { Segment, Suggestion, MindmapNode };
