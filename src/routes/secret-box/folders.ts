/**
 * シークレットBOXフォルダ APIルート
 */

import { Hono } from "hono";
import {
  getAllFolders,
  getFoldersByParent,
  getFolder,
  createNewFolder,
  updateFolderMeta,
  removeFolder,
} from "../../services/secretBox";
import { logger } from "../../utils/logger";

export const foldersRoute = new Hono();

/**
 * GET /folders - フォルダ一覧取得
 */
foldersRoute.get("/", async (c) => {
  try {
    const parentId = c.req.query("parentId");

    let folders;
    if (parentId === "null" || parentId === "") {
      folders = await getFoldersByParent(null);
    } else if (parentId) {
      folders = await getFoldersByParent(parentId);
    } else {
      folders = await getAllFolders();
    }

    return c.json(folders);
  } catch (e) {
    logger.error({ err: e }, "Failed to get secret box folders");
    return c.json({ error: (e as Error).message }, 500);
  }
});

/**
 * GET /folders/:id - フォルダ取得
 */
foldersRoute.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const folder = await getFolder(id);
    return c.json(folder);
  } catch (e) {
    logger.error({ err: e, id: c.req.param("id") }, "Failed to get secret box folder");
    return c.json({ error: (e as Error).message }, 404);
  }
});

/**
 * POST /folders - フォルダ作成
 */
foldersRoute.post("/", async (c) => {
  try {
    const body = await c.req.json();

    if (!body.name) {
      return c.json({ error: "name is required" }, 400);
    }

    const folder = await createNewFolder({
      name: body.name,
      parentId: body.parentId === "null" || body.parentId === "" ? null : body.parentId,
    });

    return c.json(folder, 201);
  } catch (e) {
    logger.error({ err: e }, "Failed to create secret box folder");
    return c.json({ error: (e as Error).message }, 400);
  }
});

/**
 * PUT /folders/:id - フォルダ更新
 */
foldersRoute.put("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();

    const folder = await updateFolderMeta(id, {
      name: body.name,
      parentId: body.parentId,
      position: body.position,
      isExpanded: body.isExpanded,
    });

    return c.json(folder);
  } catch (e) {
    logger.error({ err: e, id: c.req.param("id") }, "Failed to update secret box folder");
    return c.json({ error: (e as Error).message }, 400);
  }
});

/**
 * DELETE /folders/:id - フォルダ削除（空の場合のみ）
 */
foldersRoute.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const folder = await removeFolder(id);
    return c.json(folder);
  } catch (e) {
    logger.error({ err: e, id: c.req.param("id") }, "Failed to delete secret box folder");
    return c.json({ error: (e as Error).message }, 400);
  }
});
