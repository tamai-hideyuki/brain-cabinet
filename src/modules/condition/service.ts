/**
 * 体調記録サービス
 * 体調記録 + 環境センサーデータ取得のビジネスロジック
 */

import * as conditionRepo from "./repository";
import { logger } from "../../shared/utils/logger";

const ENV_SENSOR_URL = "http://192.168.1.48/api/current";
const SENSOR_TIMEOUT_MS = 5000;

type EnvData = {
  temp: number;
  humi: number;
  pres: number;
};

/**
 * 環境センサーからデータを取得
 * 取得失敗時はnullを返す
 */
const fetchEnvData = async (): Promise<EnvData | null> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SENSOR_TIMEOUT_MS);

    const res = await fetch(ENV_SENSOR_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      logger.warn({ status: res.status }, "Env sensor returned non-OK status");
      return null;
    }

    const data = await res.json() as EnvData;
    return data;
  } catch (e) {
    logger.warn({ err: e }, "Failed to fetch env sensor data");
    return null;
  }
};

/**
 * センサー接続チェック
 */
export const checkSensor = async (): Promise<{ connected: boolean; data?: EnvData }> => {
  const data = await fetchEnvData();
  return data ? { connected: true, data } : { connected: false };
};

/**
 * 体調を記録（センサー接続必須）
 */
export const record = async (label: string) => {
  const envData = await fetchEnvData();

  if (!envData) {
    throw new Error("Pico Wとの接続を確認してください");
  }

  const log = await conditionRepo.insertLog({
    label,
    temperature: envData.temp,
    humidity: envData.humi,
    pressure: envData.pres,
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
