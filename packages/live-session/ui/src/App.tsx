import { useState } from "react";
import { SessionView } from "./components/SessionView";
import { API_BASE } from "./config";

interface SessionInfo {
  id: string;
  title: string;
}

export function App() {
  const [currentSession, setCurrentSession] = useState<SessionInfo | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const startNewSession = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `セッション ${new Date().toLocaleString("ja-JP")}` }),
      });
      const session = await res.json();
      setCurrentSession({ id: session.id, title: session.title });
    } catch (err) {
      console.error("Failed to create session", err);
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`「${title}」を削除しますか？この操作は取り消せません。`)) return;
    try {
      await fetch(`${API_BASE}/sessions/${id}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // ignore
    }
  };

  const startEditing = (s: SessionInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(s.id);
    setEditTitle(s.title);
  };

  const saveTitle = async (id: string) => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    try {
      await fetch(`${API_BASE}/sessions/${id}/title`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: trimmed } : s))
      );
    } catch {
      // ignore
    }
    setEditingId(null);
  };

  if (currentSession) {
    return (
      <SessionView
        sessionId={currentSession.id}
        sessionTitle={currentSession.title}
        onEnd={() => setCurrentSession(null)}
      />
    );
  }

  return (
    <div style={styles.root}>
      <div style={styles.center}>
        <h1 style={styles.heading}>Live Session</h1>
        <p style={styles.sub}>
          リアルタイム会話支援 — 構造化＋参照で判断をサポート
        </p>
        <button
          style={styles.startBtn}
          onClick={startNewSession}
          disabled={loading}
        >
          {loading ? "作成中..." : "新しいセッションを開始"}
        </button>

        <div style={styles.history}>
          <button style={styles.loadBtn} onClick={loadSessions}>
            過去のセッションを表示
          </button>
          {sessions.map((s) => (
            <div key={s.id} style={styles.sessionItem}>
              {editingId === s.id ? (
                <input
                  style={styles.editInput}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => saveTitle(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTitle(s.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  style={styles.sessionTitle}
                  onClick={() => setCurrentSession(s)}
                >
                  {s.title}
                </span>
              )}
              <span style={styles.sessionActions}>
                <button
                  style={styles.actionBtn}
                  onClick={(e) => startEditing(s, e)}
                  title="名前を編集"
                >
                  ✏️
                </button>
                <button
                  style={styles.actionBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(s.id, s.title);
                  }}
                  title="削除"
                >
                  🗑
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100dvh",
    background: "#141414",
    color: "#e0e0e0",
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
    padding: "0 16px",
    paddingTop: "env(safe-area-inset-top)",
    paddingBottom: "env(safe-area-inset-bottom)",
  },
  center: {
    textAlign: "center",
    maxWidth: 400,
    width: "100%",
  },
  heading: {
    fontSize: 28,
    fontWeight: 300,
    marginBottom: 8,
  },
  sub: {
    fontSize: 14,
    color: "#888",
    marginBottom: 32,
  },
  startBtn: {
    padding: "12px 32px",
    fontSize: 15,
    background: "#c0392b",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 500,
  },
  history: {
    marginTop: 40,
  },
  loadBtn: {
    background: "none",
    border: "1px solid #444",
    color: "#888",
    padding: "6px 16px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 13,
  },
  sessionItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    marginTop: 8,
    background: "#1e1e1e",
    borderRadius: 4,
    fontSize: 13,
    color: "#aaa",
  },
  sessionTitle: {
    cursor: "pointer",
    flex: 1,
    textAlign: "left",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  sessionActions: {
    display: "flex",
    gap: 4,
    marginLeft: 8,
    flexShrink: 0,
  },
  actionBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    padding: "2px 4px",
    opacity: 0.6,
  },
  editInput: {
    flex: 1,
    background: "#2a2a2a",
    border: "1px solid #555",
    borderRadius: 3,
    color: "#e0e0e0",
    fontSize: 13,
    padding: "2px 6px",
    outline: "none",
  },
};
