/**
 * Decision ドメイン ディスパッチャー
 *
 * 判断ファースト機能の API ハンドラー
 */

import {
  searchDecisions,
  getDecisionContext,
  getPromotionCandidates,
  compareDecisions,
} from "../services/decision";
import {
  addCounterevidence,
  getCounterevidences,
  deleteCounterevidence,
} from "../services/counterevidence";
import {
  INTENTS,
  COUNTEREVIDENCE_TYPES,
  COUNTEREVIDENCE_SEVERITIES,
  type Intent,
  type CounterevidencelType,
  type CounterevidencelSeverity,
} from "../db/schema";
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

type DecisionComparePayload = {
  query?: string;
  intent?: Intent;
  minConfidence?: number;
  limit?: number;
};

type AddCounterevidencelPayload = {
  decisionNoteId?: string;
  type?: CounterevidencelType;
  content?: string;
  sourceNoteId?: string;
  severity?: CounterevidencelSeverity;
};

type GetCounterevidencelPayload = {
  decisionNoteId?: string;
};

type DeleteCounterevidencelPayload = {
  id?: number;
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

  /**
   * decision.compare - 複数の判断を比較用に並べて取得
   */
  async compare(payload: unknown) {
    const p = payload as DecisionComparePayload | undefined;
    const query = validateQuery(p?.query);
    const intent = validateOptionalEnum(p?.intent, "intent", INTENTS);
    const minConfidence =
      typeof p?.minConfidence === "number"
        ? Math.max(0, Math.min(1, p.minConfidence))
        : 0.3; // 比較用は低めの閾値
    const limit = validateLimitAllowAll(p?.limit, 5);

    return compareDecisions(query, {
      intent: intent ?? undefined,
      minConfidence,
      limit: limit === 0 ? 5 : limit,
    });
  },

  /**
   * decision.addCounterevidence - 反証を追加
   */
  async addCounterevidence(payload: unknown) {
    const p = payload as AddCounterevidencelPayload | undefined;
    const decisionNoteId = requireString(p?.decisionNoteId, "decisionNoteId");
    const type = validateOptionalEnum(p?.type, "type", COUNTEREVIDENCE_TYPES);
    if (!type) {
      throw new Error("type is required");
    }
    const content = requireString(p?.content, "content");
    const severity = validateOptionalEnum(
      p?.severity,
      "severity",
      COUNTEREVIDENCE_SEVERITIES
    );

    return addCounterevidence({
      decisionNoteId,
      type,
      content,
      sourceNoteId: p?.sourceNoteId,
      severity: severity ?? undefined,
    });
  },

  /**
   * decision.getCounterevidences - 反証一覧を取得
   */
  async getCounterevidences(payload: unknown) {
    const p = payload as GetCounterevidencelPayload | undefined;
    const decisionNoteId = requireString(p?.decisionNoteId, "decisionNoteId");

    return getCounterevidences(decisionNoteId);
  },

  /**
   * decision.deleteCounterevidence - 反証を削除
   */
  async deleteCounterevidence(payload: unknown) {
    const p = payload as DeleteCounterevidencelPayload | undefined;
    if (typeof p?.id !== "number") {
      throw new Error("id is required");
    }

    await deleteCounterevidence(p.id);
    return { success: true, message: "Counterevidence deleted" };
  },
};
