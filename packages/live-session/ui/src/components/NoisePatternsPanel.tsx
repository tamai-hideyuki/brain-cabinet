import { useState, useEffect, useCallback } from "react";
import { API_BASE } from "../config";

interface NoisePattern {
  id: string;
  pattern: string;
  isRegex: number;
  createdAt: number;
}

interface Props {
  onClose: () => void;
}

export function NoisePatternsPanel({ onClose }: Props) {
  const [patterns, setPatterns] = useState<NoisePattern[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`${API_BASE}/noise-patterns`);
    const data = await res.json();
    setPatterns(data.patterns ?? []);
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const handleDelete = async (id: string) => {
    await fetch(`${API_BASE}/noise-patterns/${id}`, { method: "DELETE" });
    setPatterns((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>ノイズパターン管理</h3>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div style={styles.body}>
          {patterns.length === 0 && (
            <p style={styles.empty}>登録済みのノイズパターンはありません</p>
          )}
          {patterns.map((p) => (
            <div key={p.id} style={styles.row}>
              <span style={styles.pattern}>
                {p.isRegex ? <span style={styles.badge}>正規表現</span> : null}
                {p.pattern}
              </span>
              <button
                style={styles.deleteBtn}
                onClick={() => handleDelete(p.id)}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#1e1e1e",
    borderRadius: 8,
    width: "90%",
    maxWidth: 500,
    maxHeight: "70vh",
    display: "flex",
    flexDirection: "column",
    border: "1px solid #333",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid #333",
  },
  title: {
    margin: 0,
    fontSize: 15,
    color: "#e0e0e0",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#888",
    fontSize: 18,
    cursor: "pointer",
  },
  body: {
    flex: 1,
    overflow: "auto",
    padding: "8px 16px",
  },
  empty: {
    color: "#666",
    fontSize: 13,
    textAlign: "center",
    padding: 24,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid #2a2a2a",
    gap: 8,
  },
  pattern: {
    color: "#ccc",
    fontSize: 13,
    flex: 1,
    wordBreak: "break-all",
  },
  badge: {
    background: "#2c6fbb",
    color: "#fff",
    fontSize: 10,
    padding: "1px 5px",
    borderRadius: 3,
    marginRight: 6,
  },
  deleteBtn: {
    background: "none",
    border: "1px solid #555",
    color: "#c0392b",
    fontSize: 11,
    padding: "3px 8px",
    borderRadius: 3,
    cursor: "pointer",
    flexShrink: 0,
  },
};
