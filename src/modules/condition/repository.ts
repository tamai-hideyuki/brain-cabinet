/**
 * 体調記録リポジトリ
 * 体調ログの永続化
 */

import { db } from "../../shared/db/client";
import { conditionLogs } from "../../shared/db/schema";
import { desc, gte, and, sql } from "drizzle-orm";

export type ConditionLog = {
  id: number;
  label: string;
  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  recordedAt: number;
};

/**
 * 体調を記録
 */
export const insertLog = async (data: {
  label: string;
  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
}): Promise<ConditionLog> => {
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .insert(conditionLogs)
    .values({
      label: data.label,
      temperature: data.temperature,
      humidity: data.humidity,
      pressure: data.pressure,
      recordedAt: now,
    })
    .returning();

  return result[0];
};

/**
 * 直近N件の体調ログを取得
 */
export const getRecentLogs = async (limit: number = 50): Promise<ConditionLog[]> => {
  return db
    .select()
    .from(conditionLogs)
    .orderBy(desc(conditionLogs.recordedAt))
    .limit(limit);
};

/**
 * 今日の体調ログを取得
 */
export const getTodayLogs = async (): Promise<ConditionLog[]> => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartUnix = Math.floor(todayStart.getTime() / 1000);

  return db
    .select()
    .from(conditionLogs)
    .where(gte(conditionLogs.recordedAt, todayStartUnix))
    .orderBy(desc(conditionLogs.recordedAt));
};

/**
 * 指定日の体調ログを取得
 */
export const getLogsByDate = async (date: string): Promise<ConditionLog[]> => {
  const dayStart = new Date(date + "T00:00:00");
  const dayEnd = new Date(date + "T23:59:59");
  const startUnix = Math.floor(dayStart.getTime() / 1000);
  const endUnix = Math.floor(dayEnd.getTime() / 1000);

  return db
    .select()
    .from(conditionLogs)
    .where(
      and(
        gte(conditionLogs.recordedAt, startUnix),
        sql`${conditionLogs.recordedAt} <= ${endUnix}`
      )
    )
    .orderBy(desc(conditionLogs.recordedAt));
};
