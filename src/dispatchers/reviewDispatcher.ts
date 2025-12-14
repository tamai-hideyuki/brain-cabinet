/**
 * Review ドメイン ディスパッチャー
 *
 * Spaced Review + Active Recall の API ハンドラー
 */

import {
  getDueReviewItems,
  getReviewQueueSummary,
  getReviewListGrouped,
  startReview,
  submitReviewResult,
  scheduleReviewForNote,
  cancelReview,
  rescheduleReview,
  setFixedRevision,
  clearFixedRevision,
  getQuestionsForReview,
  regenerateQuestionsForNote,
  getReviewStatsByNote,
  getOverallReviewStats,
  formatInterval,
} from "../services/review";
import { findNoteById } from "../repositories/notesRepo";
import { findHistoryById } from "../repositories/historyRepo";
import { getLatestInference } from "../services/inference";
import { RECALL_QUALITIES, type RecallQuality } from "../db/schema";
import {
  validateLimitAllowAll,
  requireString,
  LIMITS,
} from "../utils/validation";

// ============================================================
// Payload Types
// ============================================================

type ReviewQueuePayload = {
  limit?: number;
};

type ReviewStartPayload = {
  noteId?: string;
};

type ReviewSubmitPayload = {
  scheduleId?: number;
  quality?: number;
  responseTimeMs?: number;
  questionsAttempted?: number;
  questionsCorrect?: number;
};

type ReviewSchedulePayload = {
  noteId?: string;
  force?: boolean;
};

type ReviewCancelPayload = {
  noteId?: string;
};

type ReviewReschedulePayload = {
  noteId?: string;
  daysFromNow?: number;
};

type ReviewQuestionsPayload = {
  noteId?: string;
};

type ReviewRegenerateQuestionsPayload = {
  noteId?: string;
};

type ReviewStatsPayload = {
  noteId?: string;
};

type ReviewFixRevisionPayload = {
  noteId?: string;
  historyId?: string;
};

type ReviewUnfixRevisionPayload = {
  noteId?: string;
};

// ============================================================
// Dispatcher
// ============================================================

export const reviewDispatcher = {
  /**
   * review.queue - レビュー待ちキューを取得
   */
  async queue(payload: unknown) {
    const p = payload as ReviewQueuePayload | undefined;
    const limit = validateLimitAllowAll(p?.limit, 20);

    const reviews = await getDueReviewItems({
      limit: limit === 0 ? undefined : limit,
    });
    const summary = await getReviewQueueSummary();

    // ノート情報を付加
    const enrichedReviews = await Promise.all(
      reviews.map(async (item) => {
        const note = await findNoteById(item.noteId);
        const inference = await getLatestInference(item.noteId);
        return {
          ...item,
          noteTitle: note?.title ?? "Unknown",
          noteType: inference?.type ?? "unknown",
          nextReviewIn: formatInterval(
            Math.max(
              0,
              Math.ceil(
                (item.schedule.nextReviewAt - Math.floor(Date.now() / 1000)) /
                  (24 * 60 * 60)
              )
            )
          ),
        };
      })
    );

    return {
      ...summary,
      reviews: enrichedReviews,
    };
  },

  /**
   * review.start - レビューセッションを開始
   * fixedRevisionId がある場合は note_history からコンテンツを取得
   */
  async start(payload: unknown) {
    const p = payload as ReviewStartPayload | undefined;
    const noteId = requireString(p?.noteId, "noteId");

    const session = await startReview(noteId);
    const note = await findNoteById(noteId);

    // fixedRevisionId がある場合は履歴からコンテンツを取得
    let noteContent = note?.content ?? "";
    if (session.fixedRevisionId) {
      const history = await findHistoryById(session.fixedRevisionId);
      if (history) {
        noteContent = history.content;
      }
    }

    return {
      ...session,
      noteTitle: note?.title ?? "Unknown",
      noteContent,
    };
  },

  /**
   * review.submit - レビュー結果を送信
   */
  async submit(payload: unknown) {
    const p = payload as ReviewSubmitPayload | undefined;

    if (typeof p?.scheduleId !== "number") {
      throw new Error("scheduleId is required");
    }

    if (typeof p?.quality !== "number") {
      throw new Error("quality is required");
    }

    // quality が 0-5 の範囲内かチェック
    if (!RECALL_QUALITIES.includes(p.quality as RecallQuality)) {
      throw new Error("quality must be between 0 and 5");
    }

    return submitReviewResult(p.scheduleId, {
      quality: p.quality as RecallQuality,
      responseTimeMs: p.responseTimeMs,
      questionsAttempted: p.questionsAttempted,
      questionsCorrect: p.questionsCorrect,
    });
  },

  /**
   * review.schedule - 手動でレビューをスケジュール
   * force: true でタイプチェックをスキップして強制登録
   */
  async schedule(payload: unknown) {
    const p = payload as ReviewSchedulePayload | undefined;
    const noteId = requireString(p?.noteId, "noteId");
    const force = p?.force === true;

    const note = await findNoteById(noteId);
    if (!note) {
      throw new Error("Note not found");
    }

    const inference = await getLatestInference(noteId);
    const noteType = inference?.type ?? "scratch";

    // force: true でない場合はタイプチェック
    if (!force && noteType !== "learning" && noteType !== "decision") {
      throw new Error(
        "Only learning and decision notes can be scheduled for review. Use force: true to override."
      );
    }

    // force の場合は learning として扱う（質問生成のため）
    const effectiveType = (noteType === "learning" || noteType === "decision")
      ? noteType
      : "learning";

    const result = await scheduleReviewForNote(
      noteId,
      note.content,
      effectiveType,
      { manual: true }
    );

    if (!result) {
      throw new Error("Failed to schedule review");
    }

    return {
      success: true,
      scheduleId: result.scheduleId,
      nextReviewAt: result.nextReviewAt,
      message: force
        ? `Review scheduled (forced, treated as ${effectiveType})`
        : "Review scheduled successfully",
    };
  },

  /**
   * review.cancel - レビューをキャンセル
   */
  async cancel(payload: unknown) {
    const p = payload as ReviewCancelPayload | undefined;
    const noteId = requireString(p?.noteId, "noteId");

    await cancelReview(noteId);

    return {
      success: true,
      message: "Review cancelled",
    };
  },

  /**
   * review.reschedule - レビューを再スケジュール
   */
  async reschedule(payload: unknown) {
    const p = payload as ReviewReschedulePayload | undefined;
    const noteId = requireString(p?.noteId, "noteId");

    if (typeof p?.daysFromNow !== "number" || p.daysFromNow < 1) {
      throw new Error("daysFromNow must be a positive number");
    }

    const result = await rescheduleReview(noteId, p.daysFromNow);

    return {
      success: true,
      nextReviewAt: result.nextReviewAt,
      nextReviewIn: formatInterval(p.daysFromNow),
      message: `Review rescheduled to ${p.daysFromNow} days from now`,
    };
  },

  /**
   * review.questions - ノートの質問一覧を取得
   */
  async questions(payload: unknown) {
    const p = payload as ReviewQuestionsPayload | undefined;
    const noteId = requireString(p?.noteId, "noteId");

    const questions = await getQuestionsForReview(noteId);

    return {
      noteId,
      count: questions.length,
      questions,
    };
  },

  /**
   * review.regenerateQuestions - 質問を再生成
   */
  async regenerateQuestions(payload: unknown) {
    const p = payload as ReviewRegenerateQuestionsPayload | undefined;
    const noteId = requireString(p?.noteId, "noteId");

    const note = await findNoteById(noteId);
    if (!note) {
      throw new Error("Note not found");
    }

    const inference = await getLatestInference(noteId);
    const noteType = inference?.type ?? "scratch";

    if (noteType !== "learning" && noteType !== "decision") {
      throw new Error(
        "Only learning and decision notes can have questions generated"
      );
    }

    const count = await regenerateQuestionsForNote(
      noteId,
      note.content,
      noteType
    );

    return {
      success: true,
      questionsGenerated: count,
      message:
        count > 0
          ? `${count} questions generated`
          : "Questions already up to date",
    };
  },

  /**
   * review.stats - ノートのレビュー統計
   */
  async stats(payload: unknown) {
    const p = payload as ReviewStatsPayload | undefined;
    const noteId = requireString(p?.noteId, "noteId");

    const note = await findNoteById(noteId);
    if (!note) {
      throw new Error("Note not found");
    }

    const result = await getReviewStatsByNote(noteId);

    return {
      noteId,
      noteTitle: note.title,
      ...result,
    };
  },

  /**
   * review.overview - 全体のレビュー統計
   */
  async overview(_payload: unknown) {
    return getOverallReviewStats();
  },

  /**
   * review.list - 期間別にグルーピングしたレビューリストを取得
   */
  async list(_payload: unknown) {
    return getReviewListGrouped();
  },

  /**
   * review.fixRevision - レビュー対象のバージョンを固定（v4.6）
   */
  async fixRevision(payload: unknown) {
    const p = payload as ReviewFixRevisionPayload | undefined;
    const noteId = requireString(p?.noteId, "noteId");
    const historyId = requireString(p?.historyId, "historyId");

    // 履歴が存在するか確認
    const history = await findHistoryById(historyId);
    if (!history) {
      throw new Error(`History not found: ${historyId}`);
    }

    // 履歴がこのノートのものか確認
    if (history.noteId !== noteId) {
      throw new Error(`History ${historyId} does not belong to note ${noteId}`);
    }

    const result = await setFixedRevision(noteId, historyId);

    return {
      success: true,
      noteId,
      ...result,
      message: "Review content fixed to specified revision",
    };
  },

  /**
   * review.unfixRevision - レビュー対象のバージョン固定を解除（v4.6）
   */
  async unfixRevision(payload: unknown) {
    const p = payload as ReviewUnfixRevisionPayload | undefined;
    const noteId = requireString(p?.noteId, "noteId");

    const result = await clearFixedRevision(noteId);

    return {
      success: true,
      noteId,
      ...result,
      message: "Review content will now use latest version",
    };
  },
};
