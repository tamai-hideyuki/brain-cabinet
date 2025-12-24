/**
 * ノート画像 APIルート
 */

import { Hono } from "hono";
import {
  getNoteImages,
  getNoteImage,
  getNoteImageData,
  uploadNoteImage,
  removeNoteImage,
} from "../../services/noteImages";
import { logger } from "../../utils/logger";

export const imagesRoute = new Hono();

/**
 * GET /images/:id/data - 画像データ取得
 */
imagesRoute.get("/:id/data", async (c) => {
  try {
    const id = c.req.param("id");
    const { data, mimeType, size } = await getNoteImageData(id);

    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(size),
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (e) {
    logger.error({ err: e, id: c.req.param("id") }, "Failed to get note image data");
    return c.json({ error: (e as Error).message }, 404);
  }
});

/**
 * GET /images/:id - 画像メタデータ取得
 */
imagesRoute.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const image = await getNoteImage(id);
    return c.json(image);
  } catch (e) {
    logger.error({ err: e, id: c.req.param("id") }, "Failed to get note image");
    return c.json({ error: (e as Error).message }, 404);
  }
});

/**
 * DELETE /images/:id - 画像削除
 */
imagesRoute.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const image = await removeNoteImage(id);
    return c.json(image);
  } catch (e) {
    logger.error({ err: e, id: c.req.param("id") }, "Failed to delete note image");
    return c.json({ error: (e as Error).message }, 400);
  }
});

/**
 * ノート別のルート
 */
export const noteImagesRoute = new Hono();

/**
 * GET /:noteId/images - ノートの画像一覧取得
 */
noteImagesRoute.get("/:noteId/images", async (c) => {
  try {
    const noteId = c.req.param("noteId");
    const images = await getNoteImages(noteId);
    return c.json(images);
  } catch (e) {
    logger.error({ err: e, noteId: c.req.param("noteId") }, "Failed to get note images");
    return c.json({ error: (e as Error).message }, 500);
  }
});

/**
 * POST /:noteId/images - 画像アップロード
 */
noteImagesRoute.post("/:noteId/images", async (c) => {
  try {
    const noteId = c.req.param("noteId");
    const body = await c.req.parseBody();
    const file = body["file"] as File;

    if (!file) {
      return c.json({ error: "file is required" }, 400);
    }

    const name = body["name"] as string | undefined;

    const image = await uploadNoteImage(noteId, file, { name });

    // Markdown埋め込み用の文字列も返す
    const markdown = `![${image.name}](note-image://${image.id})`;

    return c.json(
      {
        ...image,
        markdown,
      },
      201
    );
  } catch (e) {
    logger.error({ err: e, noteId: c.req.param("noteId") }, "Failed to upload note image");
    return c.json({ error: (e as Error).message }, 400);
  }
});
