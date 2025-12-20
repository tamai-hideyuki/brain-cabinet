import { Hono } from "hono";
import {
  getBookmarkTree,
  getBookmarkNodeById,
  createBookmarkNode,
  updateBookmarkNode,
  deleteBookmarkNode,
  moveBookmarkNode,
  reorderBookmarkNodes,
} from "../../services/bookmarkService";
import { logger } from "../../utils/logger";

export const bookmarksRoute = new Hono();

// GET /api/bookmarks - ツリー構造で取得
bookmarksRoute.get("/", async (c) => {
  try {
    const tree = await getBookmarkTree();
    return c.json(tree);
  } catch (e) {
    logger.error({ err: e }, "Failed to get bookmark tree");
    return c.json({ error: (e as Error).message }, 500);
  }
});

// GET /api/bookmarks/:id - 単一ノード取得
bookmarksRoute.get("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const node = await getBookmarkNodeById(id);
    if (!node) {
      return c.json({ error: "Bookmark node not found" }, 404);
    }
    return c.json(node);
  } catch (e) {
    logger.error({ err: e, nodeId: id }, "Failed to get bookmark node");
    return c.json({ error: (e as Error).message }, 500);
  }
});

// POST /api/bookmarks - 新規作成
bookmarksRoute.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const { parentId, type, name, noteId, url } = body;

    if (!type || !name) {
      return c.json({ error: "type and name are required" }, 400);
    }

    if (type === "note" && !noteId) {
      return c.json({ error: "noteId is required for note type" }, 400);
    }

    if (type === "link" && !url) {
      return c.json({ error: "url is required for link type" }, 400);
    }

    const created = await createBookmarkNode({
      parentId: parentId ?? null,
      type,
      name,
      noteId: noteId ?? null,
      url: url ?? null,
    });

    return c.json(created, 201);
  } catch (e) {
    logger.error({ err: e }, "Failed to create bookmark node");
    return c.json({ error: (e as Error).message }, 400);
  }
});

// PUT /api/bookmarks/:id - 更新
bookmarksRoute.put("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { name, isExpanded } = body;

    const updated = await updateBookmarkNode(id, { name, isExpanded });
    return c.json(updated);
  } catch (e) {
    logger.error({ err: e, nodeId: id }, "Failed to update bookmark node");
    return c.json({ error: (e as Error).message }, 400);
  }
});

// DELETE /api/bookmarks/:id - 削除
bookmarksRoute.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    await deleteBookmarkNode(id);
    return c.json({ message: "Bookmark node deleted" });
  } catch (e) {
    logger.error({ err: e, nodeId: id }, "Failed to delete bookmark node");
    return c.json({ error: (e as Error).message }, 400);
  }
});

// POST /api/bookmarks/:id/move - ノード移動
bookmarksRoute.post("/:id/move", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { parentId, position } = body;

    const moved = await moveBookmarkNode(id, parentId ?? null, position);
    return c.json(moved);
  } catch (e) {
    logger.error({ err: e, nodeId: id }, "Failed to move bookmark node");
    return c.json({ error: (e as Error).message }, 400);
  }
});

// POST /api/bookmarks/reorder - 並び順更新
bookmarksRoute.post("/reorder", async (c) => {
  try {
    const body = await c.req.json();
    const { parentId, orderedIds } = body;

    if (!Array.isArray(orderedIds)) {
      return c.json({ error: "orderedIds must be an array" }, 400);
    }

    await reorderBookmarkNodes(parentId ?? null, orderedIds);
    return c.json({ message: "Reordered successfully" });
  } catch (e) {
    logger.error({ err: e }, "Failed to reorder bookmark nodes");
    return c.json({ error: (e as Error).message }, 400);
  }
});
