import { useState, useCallback, useEffect } from "react";
import { useTranscription } from "../hooks/useTranscription";
import { useWebSocket } from "../hooks/useWebSocket";
import { API_BASE } from "../config";
import type { Segment, Suggestion, MindmapNode } from "../hooks/useWebSocket";
import { TranscriptPanel } from "./TranscriptPanel";
import { SuggestionPanel } from "./SuggestionPanel";
import { MindmapPanel } from "./MindmapPanel";
import { RefinedPanel } from "./RefinedPanel";

interface Props {
  sessionId: string;
  sessionTitle: string;
  onEnd: () => void;
}

const TABS = [
  { key: "transcript", label: "文字起こし" },
  { key: "refined", label: "整理" },
  { key: "mindmap", label: "地図" },
  { key: "suggestions", label: "素材" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function SessionView({ sessionId, sessionTitle, onEnd }: Props) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [mindmapNodes, setMindmapNodes] = useState<MindmapNode[]>([]);
  const [interimText, setInterimText] = useState("");
  const [refinedText, setRefinedText] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("transcript");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 過去データの読み込み
  useEffect(() => {
    const load = async () => {
      const [segRes, sugRes, mapRes, refRes] = await Promise.all([
        fetch(`${API_BASE}/sessions/${sessionId}/transcripts`),
        fetch(`${API_BASE}/sessions/${sessionId}/suggestions`),
        fetch(`${API_BASE}/sessions/${sessionId}/mindmap`),
        fetch(`${API_BASE}/sessions/${sessionId}/refined`),
      ]);
      const { transcripts } = await segRes.json();
      const { suggestions: sugs } = await sugRes.json();
      const { nodes } = await mapRes.json();
      const { text } = await refRes.json();
      setSegments(transcripts ?? []);
      setSuggestions(sugs ?? []);
      setMindmapNodes(nodes ?? []);
      setRefinedText(text ?? "");
    };
    load().catch(console.error);
  }, [sessionId]);

  // サーバーから戻ってきたセグメント
  const onSegment = useCallback((seg: Segment) => {
    if (seg.isFinal === 0) {
      setInterimText(seg.text);
      return;
    }
    setSegments((prev) => {
      // ローカル仮IDを正式IDに差し替え
      const idx = prev.findIndex(
        (s) => s.id.startsWith("local-") && s.text === seg.text
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = seg;
        return next;
      }
      return [...prev, seg];
    });
    setInterimText("");
  }, []);

  const onSuggestions = useCallback((newSugs: Suggestion[]) => {
    setSuggestions((prev) => [...newSugs, ...prev]);
  }, []);

  const onMindmapNode = useCallback((node: MindmapNode) => {
    setMindmapNodes((prev) => [...prev, node]);
  }, []);

  const onRefined = useCallback((text: string) => {
    setRefinedText(text);
  }, []);

  const { connected, send, sendBinary } = useWebSocket({
    sessionId,
    onSegment,
    onSuggestions,
    onMindmapNode,
    onRefined,
  });

  let localIdCounter = 0;

  const transcriptionCallbacks = {
    onInterim: (text: string) => {
      setInterimText(text);
    },
    onFinal: (text: string, confidence: number) => {
      // Web Speech APIフォールバック時のみ使われる
      const timestamp = transcription.getElapsedMs();

      const localSegment: Segment = {
        id: `local-${++localIdCounter}`,
        sessionId,
        text,
        speaker: null,
        confidence,
        timestamp,
        isFinal: 1,
      };
      setSegments((prev) => [...prev, localSegment]);
      setInterimText("");

      send({
        type: "transcript",
        sessionId,
        text,
        confidence,
        timestamp,
        isFinal: true,
      });
    },
    onAudioChunk: (blob: Blob) => {
      // Whisperモード: 音声チャンクをバイナリで送信
      sendBinary(blob);
    },
    onError: (error: string) => {
      console.error(error);
    },
  };

  const transcription = useTranscription(transcriptionCallbacks);

  const handleStop = () => {
    transcription.stop();
  };

  const handleEnd = async () => {
    transcription.stop();
    await fetch(`${API_BASE}/sessions/${sessionId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ended" }),
    });
    onEnd();
  };

  const handleAcknowledge = (id: string) => {
    send({ type: "acknowledge", suggestionId: id });
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, acknowledgedAt: Date.now() } : s))
    );
  };

  const handlePin = (id: string) => {
    const sug = suggestions.find((s) => s.id === id);
    if (sug?.pinnedAt) {
      send({ type: "unpin", suggestionId: id });
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, pinnedAt: null } : s))
      );
    } else {
      send({ type: "pin", suggestionId: id });
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, pinnedAt: Date.now() } : s))
      );
    }
  };

  const engineLabel =
    transcription.engine === "whisper" ? "Whisper" : "Web Speech";
  const sourceLabel =
    transcription.source === "both" ? "マイク+システム" :
    transcription.source === "system" ? "システム音声" : "マイク";

  return (
    <div style={styles.root}>
      <style>{responsiveCSS}</style>
      <header className="sv-header">
        <div style={styles.headerLeft}>
          <h2 style={styles.title}>{sessionTitle}</h2>
          <span style={styles.status}>
            {connected ? "● 接続中" : "○ 未接続"}
          </span>
        </div>
        <div style={styles.headerRight}>
          {transcription.isListening ? (
            <>
              <span style={styles.engineLabel}>{engineLabel} / {sourceLabel}</span>
              <button
                style={{ ...styles.btn, ...styles.btnStop }}
                onClick={handleStop}
              >
                ⏸ 停止
              </button>
            </>
          ) : (
            <>
              <button
                style={{ ...styles.btn, ...styles.btnStart }}
                onClick={() => transcription.start("mic")}
              >
                対面
              </button>
              <button
                style={{ ...styles.btn, ...styles.btnStartAlt }}
                onClick={() => transcription.start("both")}
              >
                会議
              </button>
            </>
          )}
          <button style={{ ...styles.btn, ...styles.btnEnd }} onClick={handleEnd}>
            終了
          </button>
        </div>
      </header>

      {/* モバイル用タブバー */}
      <nav className="sv-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`sv-tab ${activeTab === tab.key ? "sv-tab-active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="sv-panels">
        {(!isMobile || activeTab === "transcript") && (
          <div className="sv-panel">
            <TranscriptPanel segments={segments} interimText={interimText} />
          </div>
        )}
        {(!isMobile || activeTab === "refined") && (
          <div className="sv-panel">
            <RefinedPanel text={refinedText} />
          </div>
        )}
        {(!isMobile || activeTab === "mindmap") && (
          <div className="sv-panel">
            <MindmapPanel nodes={mindmapNodes} />
          </div>
        )}
        {(!isMobile || activeTab === "suggestions") && (
          <div className="sv-panel">
            <SuggestionPanel
              suggestions={suggestions}
              onAcknowledge={handleAcknowledge}
              onPin={handlePin}
            />
          </div>
        )}
      </main>
    </div>
  );
}

const responsiveCSS = `
  .sv-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    padding-top: max(8px, env(safe-area-inset-top));
    padding-left: max(16px, env(safe-area-inset-left));
    padding-right: max(16px, env(safe-area-inset-right));
    border-bottom: 1px solid #333;
    background: #1a1a1a;
  }
  .sv-tabs {
    display: none;
  }
  .sv-panels {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    flex: 1;
    overflow: hidden;
  }
  .sv-panel {
    overflow: hidden;
    height: 100%;
  }

  @media (max-width: 768px) {
    .sv-header {
      flex-direction: column;
      gap: 6px;
      padding: 8px 12px;
      padding-top: max(8px, env(safe-area-inset-top));
      padding-left: max(12px, env(safe-area-inset-left));
      padding-right: max(12px, env(safe-area-inset-right));
    }
    .sv-tabs {
      display: flex;
      border-bottom: 1px solid #333;
      background: #1a1a1a;
      padding-left: env(safe-area-inset-left);
      padding-right: env(safe-area-inset-right);
    }
    .sv-tab {
      flex: 1;
      padding: 10px 0;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: #666;
      font-size: 13px;
      cursor: pointer;
      font-weight: 500;
    }
    .sv-tab-active {
      color: #e0e0e0;
      border-bottom-color: #c0392b;
    }
    .sv-panels {
      display: flex;
      flex-direction: column;
      flex: 1;
      overflow: hidden;
    }
    .sv-panel {
      flex: 1;
      overflow: hidden;
    }
    .sv-panel > div {
      border-right: none !important;
    }
  }
`;

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100dvh",
    background: "#141414",
    color: "#e0e0e0",
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 500,
  },
  status: {
    fontSize: 12,
    color: "#666",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  engineLabel: {
    fontSize: 11,
    color: "#6bc46d",
    padding: "2px 8px",
    background: "#1a2e1a",
    borderRadius: 3,
  },
  btn: {
    padding: "6px 16px",
    borderRadius: 4,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
  },
  btnStart: {
    background: "#c0392b",
    color: "#fff",
  },
  btnStartAlt: {
    background: "#2c6fbb",
    color: "#fff",
  },
  btnStop: {
    background: "#555",
    color: "#fff",
  },
  btnEnd: {
    background: "#333",
    color: "#999",
  },
};
