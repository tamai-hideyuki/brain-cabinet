import { verifyToken } from "@clerk/backend";
import type { Context, Next } from "hono";
import { logger } from "../utils/logger";

/**
 * Clerk JWT認証ミドルウェア
 * Authorizationヘッダーからトークンを取得し、Clerkで検証する
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
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
