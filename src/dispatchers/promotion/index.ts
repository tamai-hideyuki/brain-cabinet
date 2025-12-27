/**
 * Promotion ドメイン ディスパッチャー
 *
 * 昇格通知機能の API ハンドラー
 */

import {
  getPendingPromotions,
  dismissPromotion,
  acceptPromotion,
} from "../../services/promotion";
import { validateLimitAllowAll, LIMITS } from "../../utils/validation";
import { AppError, ErrorCodes } from "../../utils/errors";

type PendingPayload = {
  limit?: number;
};

type DismissPayload = {
  id?: number;
};

type AcceptPayload = {
  id?: number;
};

export const promotionDispatcher = {
  /**
   * promotion.pending - 未対応の昇格通知一覧を取得
   */
  async pending(payload: unknown) {
    const p = payload as PendingPayload | undefined;
    const limit = validateLimitAllowAll(p?.limit, LIMITS.LIMIT_DEFAULT);

    const notifications = await getPendingPromotions(limit === 0 ? 20 : limit);

    return {
      count: notifications.length,
      notifications,
    };
  },

  /**
   * promotion.dismiss - 昇格を却下
   */
  async dismiss(payload: unknown) {
    const p = payload as DismissPayload | undefined;

    if (typeof p?.id !== "number") {
      throw new AppError(ErrorCodes.VALIDATION_REQUIRED, "id is required", {
        field: "id",
      });
    }

    await dismissPromotion(p.id);

    return {
      success: true,
      message: "Promotion dismissed",
    };
  },

  /**
   * promotion.accept - 昇格を実行
   */
  async accept(payload: unknown) {
    const p = payload as AcceptPayload | undefined;

    if (typeof p?.id !== "number") {
      throw new AppError(ErrorCodes.VALIDATION_REQUIRED, "id is required", {
        field: "id",
      });
    }

    const result = await acceptPromotion(p.id);

    return {
      success: true,
      message: `Note promoted to ${result.suggestedType}`,
      noteId: result.noteId,
      promotedType: result.suggestedType,
    };
  },
};
