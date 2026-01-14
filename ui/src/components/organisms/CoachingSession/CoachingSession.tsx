/**
 * 苫米地式コーチングセッション コンポーネント
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useCoachingSession } from "../../../hooks/useCoachingSession";
import type { CoachingPhase } from "../../../types/coaching";
import "./CoachingSession.css";

export const CoachingSession = () => {
  const {
    session,
    messages,
    loading,
    sending,
    error,
    endResult,
    checkActiveSession,
    start,
    sendMessage,
    transitionPhase,
    endSession,
    reset,
  } = useCoachingSession();

  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 初回マウント時にアクティブセッションを確認
  useEffect(() => {
    checkActiveSession();
  }, [checkActiveSession]);

  // メッセージが追加されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // テキストエリアの高さを自動調整
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    adjustTextareaHeight();
  };

  const handleSend = async () => {
    if (!inputValue.trim() || sending) return;

    const message = inputValue.trim();
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      await sendMessage(message);
    } catch (e) {
      console.error("Failed to send message:", e);
    }
  };


  const handleStart = async () => {
    try {
      await start();
    } catch (e) {
      console.error("Failed to start session:", e);
    }
  };

  const handleTransition = async (phase: CoachingPhase) => {
    try {
      await transitionPhase(phase);
    } catch (e) {
      console.error("Failed to transition phase:", e);
    }
  };

  const handleEnd = async () => {
    try {
      await endSession();
    } catch (e) {
      console.error("Failed to end session:", e);
    }
  };

  const handleNewSession = () => {
    reset();
  };

  // ローディング中
  if (loading && !session) {
    return (
      <div className="coaching-session">
        <div className="coaching-session__loading">
          セッションを読み込んでいます...
        </div>
      </div>
    );
  }

  // エラー表示
  if (error && !session) {
    return (
      <div className="coaching-session">
        <div className="coaching-session__error">{error}</div>
        <button onClick={() => checkActiveSession()}>再試行</button>
      </div>
    );
  }

  // セッション終了画面
  if (endResult) {
    return (
      <div className="coaching-session">
        <div className="coaching-session__end">
          <h2 className="coaching-session__end-title">
            セッションが終了しました
          </h2>
          <div className="coaching-session__summary">{endResult.summary}</div>
          <button
            className="coaching-session__end-button"
            onClick={handleNewSession}
          >
            新しいセッションを始める
          </button>
        </div>
      </div>
    );
  }

  // セッション開始画面
  if (!session) {
    return (
      <div className="coaching-session">
        <div className="coaching-session__start">
          <h2 className="coaching-session__start-title">
            コーチングセッション
          </h2>
          <p className="coaching-session__start-description">
            苫米地英人式コーチングの専門コーチがあなたの思考変革をサポートします。
            ゴール設定から始めて、一緒に新しい可能性を探っていきましょう。
          </p>
          <button
            className="coaching-session__start-button"
            onClick={handleStart}
            disabled={loading}
          >
            {loading ? "開始しています..." : "セッションを始める"}
          </button>
        </div>
      </div>
    );
  }

  // セッション中
  return (
    <div className="coaching-session">
      {/* ヘッダー */}
      <div className="coaching-session__header">
        <div>
          <h2 className="coaching-session__title">コーチングセッション</h2>
          {session.phaseGuide && (
            <p className="coaching-session__phase-guide">{session.phaseGuide}</p>
          )}
        </div>
        <div className="coaching-session__actions">
          <button
            className="coaching-session__button--secondary coaching-session__button--danger"
            onClick={handleEnd}
            disabled={loading}
          >
            終了
          </button>
        </div>
      </div>

      {/* メッセージエリア */}
      <div className="coaching-session__messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`coaching-message coaching-message--${message.role}`}
          >
            {message.content}
          </div>
        ))}
        {sending && (
          <div className="coaching-message coaching-message--coach">
            考えています...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* フェーズ遷移提案 */}
      {session.nextPhase && (
        <div className="coaching-session__transition">
          <span className="coaching-session__transition-text">
            次のフェーズに進む準備ができています
          </span>
          <button
            className="coaching-session__transition-button"
            onClick={() => handleTransition(session.nextPhase!)}
            disabled={sending}
          >
            進む
          </button>
        </div>
      )}

      {/* 入力エリア */}
      <div className="coaching-session__input-area">
        {error && (
          <div className="coaching-session__error" style={{ marginBottom: 8 }}>
            {error}
          </div>
        )}
        <div className="coaching-session__input-wrapper">
          <textarea
            ref={textareaRef}
            className="coaching-session__textarea"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="思いを自由に書いてください..."
            disabled={sending}
          />
          <button
            className="coaching-session__send-button"
            onClick={handleSend}
            disabled={!inputValue.trim() || sending}
          >
            送信
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoachingSession;
