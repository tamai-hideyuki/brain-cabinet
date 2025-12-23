/**
 * シークレットBOXアイテム APIルート
 */

import { Hono } from "hono";
import {
  getAllItems,
  getItemsByFolder,
  getItem,
  getItemData,
  getItemThumbnail,
  uploadItem,
  updateItemMeta,
  removeItem,
} from "../../services/secretBox";
import { logger } from "../../utils/logger";

export const itemsRoute = new Hono();

/**
 * GET /items - アイテム一覧取得
 */
itemsRoute.get("/", async (c) => {
  try {
    const folderId = c.req.query("folderId");

    let items;
    if (folderId === "null" || folderId === "") {
      items = await getItemsByFolder(null);
    } else if (folderId) {
      items = await getItemsByFolder(folderId);
    } else {
      items = await getAllItems();
    }

    return c.json(items);
  } catch (e) {
    logger.error({ err: e }, "Failed to get secret box items");
    return c.json({ error: (e as Error).message }, 500);
  }
});

/**
 * GET /items/:id - アイテムメタデータ取得
 */
itemsRoute.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const item = await getItem(id);
    return c.json(item);
  } catch (e) {
    logger.error({ err: e, id: c.req.param("id") }, "Failed to get secret box item");
    return c.json({ error: (e as Error).message }, 404);
  }
});

/**
 * GET /items/:id/data - ファイルデータ取得（ストリーミング対応）
 */
itemsRoute.get("/:id/data", async (c) => {
  try {
    const id = c.req.param("id");
    const { data, mimeType, size } = await getItemData(id);

    // Range Header対応（動画シーク用）
    const range = c.req.header("Range");
    if (range) {
      const parts = range.replace("bytes=", "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 1024 * 1024 - 1, size - 1);
      const chunkSize = end - start + 1;
      const chunk = data.slice(start, end + 1);

      return new Response(new Uint8Array(chunk), {
        status: 206,
        headers: {
          "Content-Type": mimeType,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
        },
      });
    }

    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (e) {
    logger.error({ err: e, id: c.req.param("id") }, "Failed to get secret box item data");
    return c.json({ error: (e as Error).message }, 404);
  }
});

/**
 * GET /items/:id/thumbnail - サムネイル取得
 */
itemsRoute.get("/:id/thumbnail", async (c) => {
  try {
    const id = c.req.param("id");
    const thumbnail = await getItemThumbnail(id);

    if (!thumbnail) {
      return c.json({ error: "No thumbnail available" }, 404);
    }

    return new Response(new Uint8Array(thumbnail), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (e) {
    logger.error({ err: e, id: c.req.param("id") }, "Failed to get secret box item thumbnail");
    return c.json({ error: (e as Error).message }, 404);
  }
});

/**
 * POST /items - アイテムアップロード
 */
itemsRoute.post("/", async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body["file"] as File;

    if (!file) {
      return c.json({ error: "file is required" }, 400);
    }

    const name = body["name"] as string | undefined;
    const folderId = body["folderId"] as string | undefined;

    const item = await uploadItem(file, {
      name,
      folderId: folderId === "null" || folderId === "" ? null : folderId,
    });

    return c.json(item, 201);
  } catch (e) {
    logger.error({ err: e }, "Failed to upload secret box item");
    return c.json({ error: (e as Error).message }, 400);
  }
});

/**
 * PUT /items/:id - アイテム更新
 */
itemsRoute.put("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();

    const item = await updateItemMeta(id, {
      name: body.name,
      folderId: body.folderId,
      position: body.position,
    });

    return c.json(item);
  } catch (e) {
    logger.error({ err: e, id: c.req.param("id") }, "Failed to update secret box item");
    return c.json({ error: (e as Error).message }, 400);
  }
});

/**
 * DELETE /items/:id - アイテム削除
 */
itemsRoute.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const item = await removeItem(id);
    return c.json(item);
  } catch (e) {
    logger.error({ err: e, id: c.req.param("id") }, "Failed to delete secret box item");
    return c.json({ error: (e as Error).message }, 400);
  }
});
