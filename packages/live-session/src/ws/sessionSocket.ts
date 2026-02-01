import { WebSocketServer, WebSocket, type RawData } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import pino from "pino";
import { saveSegment } from "../services/transcriptionService";
import { searchAndCreateSuggestions } from "../services/suggestionService";
import { processSegment } from "../services/mindmapService";
import { transcribe, checkWhisperHealth } from "../services/whisperService";
import { webmToWav } from "../services/audioConverter";
import { refineSegments } from "../services/refineService";
import { getSessionTranscripts } from "../services/sessionService";

const log = pino({ name: "session-ws" });

// セッションごとのクライアント管理
const sessionClients = new Map<string, Set<WebSocket>>();

interface IncomingMessage_Transcript {
  type: "transcript";
  sessionId: string;
  text: string;
  speaker?: string;
  confidence?: number;
  timestamp: number;
  isFinal: boolean;
}

interface IncomingMessage_Acknowledge {
  type: "acknowledge";
  suggestionId: string;
}

interface IncomingMessage_Pin {
  type: "pin" | "unpin";
  suggestionId: string;
}

type ClientMessage = IncomingMessage_Transcript | IncomingMessage_Acknowledge | IncomingMessage_Pin;

function broadcast(sessionId: string, data: unknown) {
  const clients = sessionClients.get(sessionId);
  if (!clients) return;
  const msg = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  // 起動時にWhisperサーバーの状態を確認
  checkWhisperHealth().then((ok) => {
    if (ok) {
      log.info("Whisper server is available");
    } else {
      log.warn("Whisper server is not available — audio transcription will not work. Start with: pnpm whisper:server");
    }
  });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
      ws.close(4000, "sessionId required");
      return;
    }

    if (!sessionClients.has(sessionId)) {
      sessionClients.set(sessionId, new Set());
    }
    sessionClients.get(sessionId)!.add(ws);
    log.info({ sessionId }, "Client connected");

    ws.on("message", async (raw: RawData, isBinary: boolean) => {
      try {
        if (isBinary) {
          // バイナリ = 音声チャンク（webm/opus）
          await handleAudioChunk(sessionId, Buffer.from(raw as ArrayBuffer));
          return;
        }
        const msg = JSON.parse(raw.toString()) as ClientMessage;
        await handleMessage(sessionId, msg);
      } catch (err) {
        log.error({ err }, "Failed to handle WS message");
      }
    });

    ws.on("close", () => {
      const clients = sessionClients.get(sessionId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) sessionClients.delete(sessionId);
      }
      log.info({ sessionId }, "Client disconnected");
    });
  });

  log.info("WebSocket server ready on /ws");
}

async function handleMessage(sessionId: string, msg: ClientMessage) {
  switch (msg.type) {
    case "transcript":
      await handleTranscript(sessionId, msg);
      break;
    case "acknowledge": {
      const { acknowledgeSuggestion } = await import("../services/suggestionService");
      await acknowledgeSuggestion(msg.suggestionId);
      break;
    }
    case "pin": {
      const { pinSuggestion } = await import("../services/suggestionService");
      await pinSuggestion(msg.suggestionId);
      break;
    }
    case "unpin": {
      const { unpinSuggestion } = await import("../services/suggestionService");
      await unpinSuggestion(msg.suggestionId);
      break;
    }
  }
}

/**
 * 音声チャンク処理: webm → wav → Whisper → テキスト → 通常のtranscript処理
 */
async function handleAudioChunk(sessionId: string, audioData: Buffer) {
  log.info({ sessionId, bytes: audioData.length }, "Received audio chunk");

  // 1. webm → wav変換
  const wavBuffer = await webmToWav(audioData);

  // 2. Whisperで文字起こし
  const { text } = await transcribe(wavBuffer);

  // 完全な空のみスキップ（短いテキストも全保存）
  if (!text || text.trim().length === 0) {
    log.info("Empty transcription, skipping");
    return;
  }

  log.info({ text }, "Whisper transcription result");

  // 3. 通常のtranscript処理と同じパイプラインに流す
  await handleTranscript(sessionId, {
    type: "transcript",
    sessionId,
    text,
    timestamp: Date.now(),
    isFinal: true,
  });
}

async function handleTranscript(sessionId: string, msg: IncomingMessage_Transcript) {
  log.info({ sessionId, text: msg.text, isFinal: msg.isFinal }, "Processing transcript");

  const segment = await saveSegment({
    sessionId,
    text: msg.text,
    speaker: msg.speaker,
    confidence: msg.confidence,
    timestamp: msg.timestamp,
    isFinal: msg.isFinal,
  });

  broadcast(sessionId, {
    type: "segment",
    segment,
  });

  // 整理済みテキストを生成して配信
  if (msg.isFinal) {
    const allSegments = await getSessionTranscripts(sessionId);
    const refinedText = refineSegments(
      allSegments
        .filter((s) => s.isFinal === 1)
        .map((s) => ({ text: s.text, timestamp: s.timestamp }))
    );
    broadcast(sessionId, {
      type: "refined",
      text: refinedText,
    });
  }

  if (!msg.isFinal) return;

  // マインドマップ更新
  const { node, type: nodeType } = await processSegment(sessionId, segment.id, msg.text);
  log.info({ nodeType, hasNode: !!node }, "Mindmap processed");

  if (node) {
    broadcast(sessionId, {
      type: "mindmap_node",
      node,
    });
  }

  // question/decision_point のときだけ知識検索
  if (nodeType === "question" || nodeType === "decision_point") {
    log.info({ nodeType, text: msg.text }, "Searching knowledge base");
    const newSuggestions = await searchAndCreateSuggestions(
      sessionId,
      segment.id,
      msg.text
    );
    log.info({ count: newSuggestions.length }, "Suggestions created");

    if (newSuggestions.length > 0) {
      broadcast(sessionId, {
        type: "suggestions",
        suggestions: newSuggestions,
      });
    }
  }
}
