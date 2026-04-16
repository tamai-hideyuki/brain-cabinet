/**
 * 体調記録サービス
 * 体調記録 + 環境センサーデータ取得のビジネスロジック
 */

import * as conditionRepo from "./repository";
import { getLatestEnvData, type EnvPayload } from "./envReceiver";

/**
 * センサー接続チェック
 */
export const checkSensor = (): { connected: boolean; data?: EnvPayload } => {
  const data = getLatestEnvData();
  return data ? { connected: true, data } : { connected: false };
};

/**
 * 体調を記録（センサー接続必須）
 */
export const record = async (label: string) => {
  const envData = getLatestEnvData();

  if (!envData) {
    throw new Error("Pico Wとの接続を確認してください");
  }

  const log = await conditionRepo.insertLog({
    label,
    temperature: envData.temp_c,
    humidity: envData.humidity,
    pressure: envData.pressure_hpa,
  });

  return log;
};

/**
 * 直近の体調ログを取得
 */
export const getRecent = async (limit: number = 50) => {
  return conditionRepo.getRecentLogs(limit);
};

/**
 * 今日の体調ログを取得
 */
export const getToday = async () => {
  return conditionRepo.getTodayLogs();
};

/**
 * 指定日の体調ログを取得
 */
export const getByDate = async (date: string) => {
  return conditionRepo.getLogsByDate(date);
};
