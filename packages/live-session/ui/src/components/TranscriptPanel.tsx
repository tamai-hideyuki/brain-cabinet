import { useRef, useEffect } from "react";
import type { Segment } from "../hooks/useWebSocket";

interface Props {
  segments: Segment[];
  interimText: string;
}

export function TranscriptPanel({ segments, interimText }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments, interimText]);

  const finalSegments = segments.filter((s) => s.isFinal === 1);

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>文字起こし</h3>
      <div style={styles.scrollArea}>
        {finalSegments.map((seg) => (
          <div key={seg.id} style={styles.segment}>
            <span style={styles.time}>
              {formatTime(seg.timestamp)}
            </span>
            <span style={styles.text}>{seg.text}</span>
          </div>
        ))}
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
  },
};
