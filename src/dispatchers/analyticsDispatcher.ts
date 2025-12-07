/**
 * Analytics ドメイン ディスパッチャー
 */

import * as analyticsService from "../services/analyticsService";

export const analyticsDispatcher = {
  async summary() {
    return analyticsService.getSummaryStats();
  },

  async timeline(payload: unknown) {
    const p = payload as { range?: string } | undefined;
    const rangeStr = p?.range ?? "30d";
    const dateRange = analyticsService.parseDateRange(rangeStr);
    return analyticsService.getSemanticDiffTimeline(dateRange);
  },

  async journey(payload: unknown) {
    const p = payload as { range?: string } | undefined;
    const rangeStr = p?.range ?? "30d";
    const dateRange = analyticsService.parseDateRange(rangeStr);
    return analyticsService.getClusterJourney(dateRange);
  },

  async heatmap(payload: unknown) {
    const p = payload as { year?: number } | undefined;
    const year = p?.year ?? new Date().getFullYear();
    return analyticsService.getDailyActivity(year);
  },

  async trends(payload: unknown) {
    const p = payload as { unit?: "day" | "week" | "month"; range?: string } | undefined;
    const unit = p?.unit ?? "day";
    const rangeStr = p?.range ?? "30d";
    const dateRange = analyticsService.parseDateRange(rangeStr);
    return analyticsService.getTrendStats(unit, dateRange);
  },
};
