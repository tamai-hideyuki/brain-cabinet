/**
 * コーチングセッション詳細 コンポーネント
 */

import { useState, useEffect } from "react";
import * as coachingApi from "../../../api/coachingApi";
import type {
  CoachingSession,
  CoachingMessage,
  CoachingPhase,
} from "../../../types/coaching";
import "./CoachingSessionDetail.css";

type Props = {
  sessionId: string;
  onBack?: () => void;
  onExport?: (sessionId: string) => void;
};

const PHASE_LABELS: Record<CoachingPhase, string> = {
  goal_setting: "ゴール設定",
  abstraction: "抽象度操作",
  self_talk: "セルフトーク",
  integration: "統合",
};

export const CoachingSessionDetail = ({ sessionId, onBack, onExport }: Props) => {
  const [session, setSession] = useState<CoachingSession | null>(null);
  const [messages, setMessages] = useState<CoachingMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"messages" | "insights">("messages");

  useEffect(() => {
    loadSessionDetail();
  }, [sessionId]);

  const loadSessionDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await coachingApi.getSessionDetail(sessionId);
      setSession(result.session);
      setMessages(result.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "セッションの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="coaching-session-detail">
        <div className="coaching-session-detail__loading">読み込み中...</div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="coaching-session-detail">
        <div className="coaching-session-detail__error">
          {error || "セッションが見つかりません"}
        </div>
        {onBack && <button onClick={onBack}>戻る</button>}
      </div>
    );
  }

  return (
    <div className="coaching-session-detail">
      <div className="coaching-session-detail__header">
        <div className="coaching-session-detail__header-left">
          {onBack && (
            <button
              className="coaching-session-detail__back-button"
              onClick={onBack}
            >
              ← 戻る
            </button>
          )}
          <div>
            <h2 className="coaching-session-detail__title">
              {formatDate(session.startedAt)}
            </h2>
            <p className="coaching-session-detail__subtitle">
              {session.totalTurns}ターン・{PHASE_LABELS[session.currentPhase]}
              {session.status === "completed" ? "（完了）" : ""}
            </p>
          </div>
        </div>
        <div className="coaching-session-detail__actions">
          {onExport && (
            <button
              className="coaching-session-detail__export-button"
              onClick={() => onExport(sessionId)}
            >
              エクスポート
            </button>
          )}
        </div>
      </div>

      <div className="coaching-session-detail__tabs">
        <button
          className={`coaching-session-detail__tab ${
            activeTab === "messages" ? "coaching-session-detail__tab--active" : ""
          }`}
          onClick={() => setActiveTab("messages")}
        >
          対話履歴
        </button>
        <button
          className={`coaching-session-detail__tab ${
            activeTab === "insights" ? "coaching-session-detail__tab--active" : ""
          }`}
          onClick={() => setActiveTab("insights")}
        >
          インサイト
        </button>
      </div>

      <div className="coaching-session-detail__content">
        {activeTab === "messages" ? (
          <div className="coaching-session-detail__messages">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={`coaching-session-detail__message coaching-session-detail__message--${message.role}`}
              >
                <div className="coaching-session-detail__message-header">
                  <span className="coaching-session-detail__message-role">
                    {message.role === "coach" ? "コーチ" : "あなた"}
                  </span>
                  {index === 0 ||
                  messages[index - 1].phase !== message.phase ? (
                    <span className="coaching-session-detail__message-phase">
                      {PHASE_LABELS[message.phase]}
                    </span>
                  ) : null}
                </div>
                <div className="coaching-session-detail__message-content">
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="coaching-session-detail__insights">
            {session.insights ? (
              <>
                {session.insights.goals.length > 0 && (
                  <div className="coaching-session-detail__insight-section">
                    <h3>見つけたゴール</h3>
                    <ul>
                      {session.insights.goals.map((goal, i) => (
                        <li key={i}>{goal.content}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {session.insights.scotomas.length > 0 && (
                  <div className="coaching-session-detail__insight-section">
                    <h3>気づいたスコトーマ（盲点）</h3>
                    <ul>
                      {session.insights.scotomas.map((scotoma, i) => (
                        <li key={i}>{scotoma.content}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {session.insights.affirmations.length > 0 && (
                  <div className="coaching-session-detail__insight-section">
                    <h3>作成したアファメーション</h3>
                    <ul>
                      {session.insights.affirmations.map((affirmation, i) => (
                        <li key={i}>{affirmation.content}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {session.insights.goals.length === 0 &&
                  session.insights.scotomas.length === 0 &&
                  session.insights.affirmations.length === 0 && (
                    <p className="coaching-session-detail__no-insights">
                      このセッションではまだインサイトが抽出されていません
                    </p>
                  )}
              </>
            ) : (
              <p className="coaching-session-detail__no-insights">
                このセッションではまだインサイトが抽出されていません
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CoachingSessionDetail;
