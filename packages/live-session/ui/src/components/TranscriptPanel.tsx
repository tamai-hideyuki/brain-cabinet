import { useRef, useEffect, useState } from "react";
import type { Segment } from "../hooks/useWebSocket";

interface Props {
  segments: Segment[];
  interimText: string;
  onMarkNoise?: (text: string) => void;
}

export function TranscriptPanel({ segments, interimText, onMarkNoise }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments, interimText]);

  const finalSegments = segments.filter((s) => s.isFinal === 1);

  const handleMarkNoise = (seg: Segment) => {
    if (!onMarkNoise) return;
    onMarkNoise(seg.text);
    setMarkedIds((prev) => new Set(prev).add(seg.id));
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>文字起こし</h3>
      <div style={styles.scrollArea}>
        {finalSegments.map((seg) => {
          const isMarked = markedIds.has(seg.id);
          return (
            <div
              key={seg.id}
              style={{
                ...styles.segment,
                ...(isMarked ? styles.marked : {}),
              }}
            >
              <span style={styles.time}>
                {formatTime(seg.timestamp)}
              </span>
              <span style={styles.text}>{seg.text}</span>
              {onMarkNoise && !isMarked && (
                <button
                  style={styles.noiseBtn}
                  onClick={() => handleMarkNoise(seg)}
                  title="ノイズとして登録"
                >
                  ×
                </button>
              )}
              {isMarked && (
                <span style={styles.noiseLabel}>ノイズ登録済</span>
              )}
            </div>
          );
        })}
        {interimText && (
          <div style={{ ...styles.segment, ...styles.interim }}>
            <span style={styles.time}>…</span>
            <span style={styles.text}>{interimText}</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return `${min}:${String(s).padStart(2, "0")}`;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    borderRight: "1px solid #333",
  },
  heading: {
    margin: 0,
    padding: "12px 16px",
    fontSize: 14,
    color: "#999",
    borderBottom: "1px solid #333",
  },
  scrollArea: {
    flex: 1,
    overflow: "auto",
    padding: "8px 16px",
  },
  segment: {
    display: "flex",
    gap: 8,
    padding: "6px 0",
    fontSize: 14,
    lineHeight: 1.5,
    alignItems: "flex-start",
  },
  marked: {
    opacity: 0.3,
    textDecoration: "line-through",
  },
  interim: {
    opacity: 0.4,
  },
  time: {
    color: "#666",
    fontSize: 12,
    minWidth: 40,
    flexShrink: 0,
    paddingTop: 2,
  },
  text: {
    color: "#e0e0e0",
    flex: 1,
  },
  noiseBtn: {
    background: "none",
    border: "1px solid #555",
    color: "#888",
    fontSize: 11,
    padding: "2px 6px",
    borderRadius: 3,
    cursor: "pointer",
    flexShrink: 0,
    opacity: 0.5,
  },
  noiseLabel: {
    fontSize: 10,
    color: "#666",
    flexShrink: 0,
  },
};
