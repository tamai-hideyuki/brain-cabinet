/**
 * 体調記録API クライアント
 */

import { fetchWithAuth } from "./client";

export type ConditionLog = {
  id: number;
  label: string;
  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  recordedAt: number;
};

export type SensorStatus = {
  connected: boolean;
  data?: {
    temp: number;
    humi: number;
    pres: number;
  };
};

const API_BASE = "/api/condition";

/**
 * センサー接続チェック
 */
export const checkSensor = async (): Promise<SensorStatus> => {
  const res = await fetchWithAuth(`${API_BASE}/sensor`);
  if (!res.ok) {
    throw new Error("Failed to check sensor");
  }
  return res.json();
};

/**
 * 体調を記録
 */
export const record = async (label: string): Promise<ConditionLog> => {
  const res = await fetchWithAuth(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to record condition");
  }
  return res.json();
};

/**
 * 今日の体調ログを取得
 */
export const getToday = async (): Promise<ConditionLog[]> => {
  const res = await fetchWithAuth(`${API_BASE}/today`);
  if (!res.ok) {
    throw new Error("Failed to fetch today's condition logs");
  }
  return res.json();
};

/**
 * 直近の体調ログを取得
 */
export const getRecent = async (limit: number = 50): Promise<ConditionLog[]> => {
  const res = await fetchWithAuth(`${API_BASE}/recent?limit=${limit}`);
  if (!res.ok) {
    throw new Error("Failed to fetch recent condition logs");
  }
  return res.json();
};
