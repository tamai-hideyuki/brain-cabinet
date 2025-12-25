import { verifyToken } from "@clerk/backend";
import type { Context, Next } from "hono";
import { logger } from "../utils/logger";

/**
 * Clerk JWT認証 または APIキー認証ミドルウェア
 * - Bearer token: Clerk JWTとして検証
 * - X-API-Key: GPT等の外部サービス用APIキー
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  const apiKey = c.req.header("X-API-Key");

  // APIキー認証（GPT等の外部サービス用）
  if (apiKey) {
    if (apiKey === process.env.API_KEY) {
      c.set("userId", "api-client");
      await next();
      return;
    }
    logger.warn("Invalid API key");
    return c.json({ error: "Invalid API key" }, 401);
  }

  // Clerk JWT認証（UI用）
  const token = authHeader?.replace("Bearer ", "");

  logger.debug({ hasToken: !!token, hasSecretKey: !!process.env.CLERK_SECRET_KEY }, "Auth check");

  if (!token) {
    logger.warn("No token provided");
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      jwtKey: process.env.CLERK_JWT_KEY,
    });
    c.set("userId", payload.sub);
    await next();
  } catch (e) {
    logger.error({ err: e }, "Token verification failed");
    return c.json({ error: "Invalid token" }, 401);
  }
}
