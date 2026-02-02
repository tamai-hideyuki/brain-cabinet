// BASE_URL: dev時 "/" → production時 "/live-session/"
const base = import.meta.env.BASE_URL.replace(/\/$/, "");

/** API呼び出し用ベースパス (例: "/live-session/api" or "/api") */
export const API_BASE = `${base}/api`;

/** WebSocket接続用ベースパス (例: "/live-session/ws" or "/ws") */
export const WS_BASE = `${base}/ws`;
