/**
 * Drift ドメイン ディスパッチャー
 */

import * as driftCore from "../../services/drift/driftCore";
import * as driftService from "../../services/drift/driftService";
import { detectAllDriftEvents } from "../../services/drift/detectDriftEvents";

type RangeDaysPayload = { rangeDays?: number };
type DriftEventsPayload = {
  rangeDays?: number;
  eventType?: "medium" | "large" | "cluster_shift";
};

export const driftDispatcher = {
  async timeline(payload: unknown) {
    const p = payload as RangeDaysPayload | undefined;
    const rangeDays = p?.rangeDays ?? 30;
    return driftService.buildDriftTimeline(rangeDays);
  },

  async events(payload: unknown) {
    const p = payload as DriftEventsPayload | undefined;
    const events = await detectAllDriftEvents();

    if (p?.eventType) {
      return events.filter((e) => e.eventType === p.eventType);
    }
    return events;
  },

  async summary(payload: unknown) {
    const p = payload as RangeDaysPayload | undefined;
    const rangeDays = p?.rangeDays ?? 30;

    const data = await driftCore.getDailyDriftData(rangeDays);
    const angle = driftCore.calcGrowthAngle(data);
    const warning = driftCore.detectWarning(data);
    const mode = driftCore.detectDriftMode(angle, warning);

    return {
      rangeDays,
      dataPoints: data.length,
      angle,
      warning,
      mode,
    };
  },

  async angle(payload: unknown) {
    const p = payload as RangeDaysPayload | undefined;
    const rangeDays = p?.rangeDays ?? 30;

    const data = await driftCore.getDailyDriftData(rangeDays);
    return driftCore.calcGrowthAngle(data);
  },

  async forecast(payload: unknown) {
    const p = payload as RangeDaysPayload | undefined;
    const rangeDays = p?.rangeDays ?? 30;

    const data = await driftCore.getDailyDriftData(rangeDays);
    const angle = driftCore.calcGrowthAngle(data);
    return driftCore.calcDriftForecast(data, angle);
  },

  async warning(payload: unknown) {
    const p = payload as RangeDaysPayload | undefined;
    const rangeDays = p?.rangeDays ?? 30;

    const data = await driftCore.getDailyDriftData(rangeDays);
    return driftCore.detectWarning(data);
  },

  async insight(payload: unknown) {
    const p = payload as RangeDaysPayload | undefined;
    const rangeDays = p?.rangeDays ?? 30;
    return driftCore.generateDriftInsight(rangeDays);
  },
};
