import { useRef, useEffect } from "react";

interface Props {
  text: string;
}

export function RefinedPanel({ text }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [text]);

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>整理済みテキスト</h3>
      <div style={styles.scrollArea}>
        {text ? (
          <p style={styles.text}>{text}</p>
        ) : (
          <p style={styles.empty}>録音を開始すると、整理されたテキストがここに表示されます</p>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
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
    padding: "12px 16px",
  },
  text: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.8,
    color: "#e0e0e0",
    whiteSpace: "pre-wrap",
  },
  empty: {
    margin: 0,
    fontSize: 13,
    color: "#555",
  },
};
