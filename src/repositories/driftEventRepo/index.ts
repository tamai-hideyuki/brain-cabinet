import { db } from "../../db/client";
import { sql } from "drizzle-orm";

/**
 * ドリフトイベントの行データ
 */
export type DriftEventRow = {
  id: number;
  detected_at: number;
  severity: string;
  type: string;
  message: string;
  related_cluster: number | null;
};

/**
 * 指定期間のドリフトイベントを取得
 */
export const findEventsSince = async (
  startTimestamp: number,
  severity?: string
): Promise<DriftEventRow[]> => {
  if (severity && severity !== "all") {
    return await db.all<DriftEventRow>(sql`
      SELECT id, detected_at, severity, type, message, related_cluster
      FROM drift_events
      WHERE detected_at >= ${startTimestamp}
        AND severity = ${severity}
      ORDER BY detected_at DESC
    `);
  }

  return await db.all<DriftEventRow>(sql`
    SELECT id, detected_at, severity, type, message, related_cluster
    FROM drift_events
    WHERE detected_at >= ${startTimestamp}
    ORDER BY detected_at DESC
  `);
};

/**
 * 最新のドリフトイベントを取得
 */
export const findRecentEvents = async (
  limit: number
): Promise<Array<{
  detected_at: number;
  severity: string;
  type: string;
  message: string;
}>> => {
  return await db.all<{
    detected_at: number;
    severity: string;
    type: string;
    message: string;
  }>(sql`
    SELECT detected_at, severity, type, message
    FROM drift_events
    ORDER BY detected_at DESC
    LIMIT ${limit}
  `);
};
