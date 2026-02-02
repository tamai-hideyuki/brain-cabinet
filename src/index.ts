/**
 * サーバーエントリーポイント
 *
 * 環境変数を読み込み、サーバーを起動する
 */
import "dotenv/config";
import { serve } from "@hono/node-server";
import http from "http";
import net from "net";
import { app } from "./app";
import { logger } from "./utils/logger";
import { enqueueJob } from "./services/jobs/job-queue";

const LIVE_SESSION_WS_URL = process.env.LIVE_SESSION_API_URL || "http://localhost:3003";

const server = serve({ fetch: app.fetch, port: 3000 }, (info) => {
  logger.info(`Server running on http://localhost:${info.port}`);

  // サーバー起動時に削除済みノートのクリーンアップを実行
  enqueueJob("CLEANUP_DELETED_NOTES").catch((err) => {
    logger.error({ err }, "Failed to enqueue cleanup job");
  });
});

// WebSocketプロキシ: /live-session/ws → live-sessionサーバー
(server as http.Server).on("upgrade", (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
  if (!req.url?.startsWith("/live-session/ws")) return;

  const targetPath = req.url.replace("/live-session/ws", "/ws");
  const targetUrl = new URL(LIVE_SESSION_WS_URL);

  const proxyReq = http.request({
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    path: targetPath,
    method: "GET",
    headers: {
      ...req.headers,
      host: `${targetUrl.hostname}:${targetUrl.port}`,
    },
  });

  proxyReq.on("upgrade", (_proxyRes, proxySocket, proxyHead) => {
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${_proxyRes.headers["sec-websocket-accept"]}\r\n` +
      "\r\n"
    );
    if (proxyHead.length > 0) socket.write(proxyHead);

    proxySocket.pipe(socket);
    socket.pipe(proxySocket);

    proxySocket.on("error", () => socket.destroy());
    socket.on("error", () => proxySocket.destroy());
  });

  proxyReq.on("error", (err) => {
    logger.error({ err }, "WebSocket proxy error");
    socket.destroy();
  });

  proxyReq.end();
});
