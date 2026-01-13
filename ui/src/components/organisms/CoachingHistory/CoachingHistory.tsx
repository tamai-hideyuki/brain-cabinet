/**
 * コーチングセッション履歴 コンポーネント
 */

import { useState, useEffect } from "react";
import * as coachingApi from "../../../api/coachingApi";
import type { CoachingSession, CoachingPhase } from "../../../types/coaching";
import "./CoachingHistory.css";

type Props = {
  onSelectSession?: (sessionId: string) => void;
  onStartNewSession?: () => void;
};

const PHASE_LABELS: Record<CoachingPhase, string> = {
  goal_setting: "ゴール設定",
  abstraction: "抽象度操作",
  self_talk: "セルフトーク",
  integration: "統合",
};

const STATUS_LABELS: Record<string, string> = {
  active: "進行中",
  completed: "完了",
  abandoned: "中断",
};

export const CoachingHistory = ({ onSelectSession, onStartNewSession }: Props) => {
  const [sessions, setSessions] = useState<CoachingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await coachingApi.getSessionHistory(20);
      setSessions(result.sessions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "履歴の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (startedAt: number, completedAt: number | null): string => {
    const end = completedAt ?? Math.floor(Date.now() / 1000);
    const durationMinutes = Math.round((end - startedAt) / 60);
    if (durationMinutes < 60) {
      return `${durationMinutes}分`;
    }
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    return `${hours}時間${mins}分`;
  };

  if (loading) {
    return (
      <div className="coaching-history">
        <div className="coaching-history__loading">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="coaching-history">
        <div className="coaching-history__error">{error}</div>
        <button onClick={loadHistory}>再試行</button>
      </div>
    );
  }

  return (
    <div className="coaching-history">
      <div className="coaching-history__header">
        <h2 className="coaching-history__title">セッション履歴</h2>
        {onStartNewSession && (
          <button
            className="coaching-history__new-button"
            onClick={onStartNewSession}
          >
            新しいセッション
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="coaching-history__empty">
          <p>まだセッション履歴がありません</p>
          {onStartNewSession && (
            <button
              className="coaching-history__start-button"
              onClick={onStartNewSession}
            >
              最初のセッションを始める
            </button>
          )}
        </div>
      ) : (
        <div className="coaching-history__list">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`coaching-history__item coaching-history__item--${session.status}`}
              onClick={() => onSelectSession?.(session.id)}
            >
              <div className="coaching-history__item-header">
                <span className="coaching-history__date">
                  {formatDate(session.startedAt)}
                </span>
                <span className={`coaching-history__status coaching-history__status--${session.status}`}>
                  {STATUS_LABELS[session.status]}
                </span>
              </div>

              <div className="coaching-history__item-body">
                <div className="coaching-history__phase">
                  {session.status === "active"
                    ? `${PHASE_LABELS[session.currentPhase]}フェーズ`
                    : "全フェーズ完了"}
                </div>
                <div className="coaching-history__stats">
                  <span>{session.totalTurns}ターン</span>
                  <span>{formatDuration(session.startedAt, session.completedAt)}</span>
                </div>
              </div>

              {session.insights && (
                <div className="coaching-history__insights">
                  {session.insights.goals.length > 0 && (
                    <span className="coaching-history__insight-badge">
                      ゴール {session.insights.goals.length}
                    </span>
                  )}
                  {session.insights.affirmations.length > 0 && (
                    <span className="coaching-history__insight-badge">
                      アファメーション {session.insights.affirmations.length}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CoachingHistory;
