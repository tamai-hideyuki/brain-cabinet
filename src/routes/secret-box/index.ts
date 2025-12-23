/**
 * シークレットBOX APIルート
 */

import { Hono } from "hono";
import { itemsRoute } from "./items";
import { foldersRoute } from "./folders";
import { getFullTree } from "../../services/secretBox";
import { logger } from "../../utils/logger";

export const secretBoxRoute = new Hono();

/**
 * GET / - ツリー構造取得
 */
secretBoxRoute.get("/", async (c) => {
  try {
    const tree = await getFullTree();
    return c.json(tree);
  } catch (e) {
    logger.error({ err: e }, "Failed to get secret box tree");
    return c.json({ error: (e as Error).message }, 500);
  }
});

// サブルートマウント
secretBoxRoute.route("/items", itemsRoute);
secretBoxRoute.route("/folders", foldersRoute);
