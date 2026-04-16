/**
 * Condition ドメイン ディスパッチャー
 */

import * as conditionService from "./service";
import { CONDITION_LABELS } from "../../shared/db/schema";

export const conditionDispatcher = {
  async sensor() {
    return conditionService.checkSensor();
  },

  async record(payload: unknown) {
    const p = payload as { label?: string } | undefined;
    if (!p?.label) {
      throw new Error("label is required");
    }
    if (!CONDITION_LABELS.includes(p.label as (typeof CONDITION_LABELS)[number])) {
      throw new Error(`Invalid label. Must be one of: ${CONDITION_LABELS.join(", ")}`);
    }
    return conditionService.record(p.label);
  },

  async today() {
    return conditionService.getToday();
  },

  async recent(payload: unknown) {
    const p = payload as { limit?: number } | undefined;
    return conditionService.getRecent(p?.limit ?? 50);
  },

  async byDate(payload: unknown) {
    const p = payload as { date?: string } | undefined;
    if (!p?.date || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) {
      throw new Error("date is required (YYYY-MM-DD)");
    }
    return conditionService.getByDate(p.date);
  },
};
