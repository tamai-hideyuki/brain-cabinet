import type { Suggestion } from "../hooks/useWebSocket";

interface Props {
  suggestions: Suggestion[];
  onAcknowledge: (id: string) => void;
  onPin: (id: string) => void;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  argument: { label: "論点", color: "#5b8def" },
  metric: { label: "数値", color: "#e5a83b" },
  case_summary: { label: "事例", color: "#6bc46d" },
  pros_cons: { label: "判断軸", color: "#c46db5" },
};

export function SuggestionPanel({ suggestions, onAcknowledge, onPin }: Props) {
  // ピン留め → 新しい順
  const sorted = [...suggestions].sort((a, b) => {
    if (a.pinnedAt && !b.pinnedAt) return -1;
    if (!a.pinnedAt && b.pinnedAt) return 1;
    return b.createdAt - a.createdAt;
  });

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>素材</h3>
      <div style={styles.scrollArea}>
        {sorted.length === 0 && (
          <div style={styles.empty}>
            質問や判断が出たとき、関連する素材が自動で表示されます
          </div>
        )}
        {sorted.map((sug) => {
          const typeInfo = TYPE_LABELS[sug.contentType] || TYPE_LABELS.argument;
          return (
            <div
              key={sug.id}
              style={{
                ...styles.card,
                borderLeftColor: typeInfo.color,
                opacity: sug.acknowledgedAt ? 0.6 : 1,
              }}
              onClick={() => onAcknowledge(sug.id)}
            >
              <div style={styles.cardHeader}>
                <span style={{ ...styles.badge, backgroundColor: typeInfo.color }}>
                  {typeInfo.label}
                </span>
                {sug.pinnedAt && <span style={styles.pinIcon}>📌</span>}
                <button
                  style={styles.pinBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPin(sug.id);
                  }}
                >
                  {sug.pinnedAt ? "外す" : "留める"}
                </button>
              </div>
              <div style={styles.cardContent}>{sug.content}</div>
              {sug.score != null && (
                <div style={styles.score}>
                  関連度 {Math.round(sug.score * 100)}%
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
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
    padding: "8px 12px",
  },
  empty: {
    color: "#666",
    fontSize: 13,
    padding: "24px 8px",
    textAlign: "center",
    lineHeight: 1.6,
  },
  card: {
    background: "#1e1e1e",
    borderLeft: "3px solid",
    borderRadius: 4,
    padding: "10px 12px",
    marginBottom: 8,
    cursor: "pointer",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  badge: {
    fontSize: 11,
    padding: "1px 6px",
    borderRadius: 3,
    color: "#fff",
  },
  pinIcon: {
    fontSize: 12,
  },
  pinBtn: {
    marginLeft: "auto",
    fontSize: 11,
    background: "none",
    border: "1px solid #555",
    color: "#999",
    borderRadius: 3,
    padding: "1px 6px",
    cursor: "pointer",
  },
  cardContent: {
    fontSize: 13,
    color: "#ccc",
    lineHeight: 1.5,
  },
  score: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
  },
};
