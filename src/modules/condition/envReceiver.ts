/**
 * UDP環境センサー受信モジュール
 * Pico WからのUDPブロードキャストを受信し、最新値をメモリに保持する
 */

import dgram from "node:dgram";
import { logger } from "../../shared/utils/logger";

const UDP_PORT = 50505;
const STALE_THRESHOLD_MS = 30_000;

export type EnvPayload = {
  device: string;
  ts: number;
  temp_c: number;
  humidity: number;
  pressure_hpa: number;
};

type EnvState = {
  data: EnvPayload;
  receivedAt: number;
};

let latest: EnvState | null = null;
let socket: dgram.Socket | null = null;

/**
 * 最新の環境データを取得
 * 鮮度チェック付き: 最終受信からSTALE_THRESHOLD_MS以上経過していたらnullを返す
 */
export const getLatestEnvData = (): EnvPayload | null => {
  if (!latest) return null;

  const age = Date.now() - latest.receivedAt;
  if (age > STALE_THRESHOLD_MS) {
    logger.warn({ ageMs: age }, "Env sensor data is stale");
    return null;
  }

  return latest.data;
};

/**
 * UDP受信を開始
 */
export const startEnvReceiver = (): void => {
  if (socket) return;

  socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

  socket.on("message", (msg, rinfo) => {
    try {
      const data = JSON.parse(msg.toString("utf-8")) as EnvPayload;
      latest = { data, receivedAt: Date.now() };
      logger.debug({ device: data.device, from: rinfo.address }, "Env data received");
    } catch {
      logger.warn({ from: rinfo.address }, "Invalid env sensor packet");
    }
  });

  socket.on("listening", () => {
    const addr = socket!.address();
    logger.info({ port: addr.port }, "Env sensor UDP receiver started");
  });

  socket.on("error", (err) => {
    logger.error({ err }, "Env sensor UDP receiver error");
    socket?.close();
    socket = null;
  });

  socket.bind(UDP_PORT);
};

/**
 * UDP受信を停止
 */
export const stopEnvReceiver = (): void => {
  socket?.close();
  socket = null;
  latest = null;
};
