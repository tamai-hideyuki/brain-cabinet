/**
 * Decision ドメイン ディスパッチャー
 *
 * 判断ファースト機能の API ハンドラー
 */

import {
  searchDecisions,
  getDecisionContext,
  getPromotionCandidates,
} from "../services/decision";
import { INTENTS, type Intent } from "../db/schema";
import {
  validateQuery,
  validateLimitAllowAll,
  validateOptionalEnum,
  requireString,
  LIMITS,
} from "../utils/validation";

type DecisionSearchPayload = {
  query?: string;
  intent?: Intent;
  minConfidence?: number;
  limit?: number;
};

type DecisionContextPayload = {
  noteId?: string;
};

type PromotionCandidatesPayload = {
  limit?: number;
};

export const decisionDispatcher = {
  /**
   * decision.search - 判断ノートを優先した検索
   */
  async search(payload: unknown) {
    const p = payload as DecisionSearchPayload | undefined;
    const query = validateQuery(p?.query);
    const intent = validateOptionalEnum(p?.intent, "intent", INTENTS);
    // minConfidence: 0-1 の範囲、デフォルト 0.4
    const minConfidence =
      typeof p?.minConfidence === "number"
        ? Math.max(0, Math.min(1, p.minConfidence))
        : 0.4;
    const limit = validateLimitAllowAll(p?.limit, LIMITS.LIMIT_DEFAULT);

    return searchDecisions(query, {
      intent: intent ?? undefined,
      minConfidence,
      limit: limit === 0 ? undefined : limit,
    });
  },

  /**
   * decision.context - 判断の詳細コンテキスト取得
   */
  async context(payload: unknown) {
    const p = payload as DecisionContextPayload | undefined;
    const noteId = requireString(p?.noteId, "noteId");

    const context = await getDecisionContext(noteId);
    if (!context) {
      throw new Error("Decision context not found or note is not a decision");
    }

    return context;
  },

  /**
   * decision.promotionCandidates - 昇格候補の scratch 一覧
   */
  async promotionCandidates(payload: unknown) {
    const p = payload as PromotionCandidatesPayload | undefined;
    const limit = validateLimitAllowAll(p?.limit, 10);

    return getPromotionCandidates(limit === 0 ? 10 : limit);
  },
};
