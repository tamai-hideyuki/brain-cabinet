/**
 * Brain Cabinet — Bookmark Dispatcher
 *
 * ブックマーク関連のコマンドを処理するディスパッチャー
 */

import * as bookmarkService from "../../services/bookmark";
import type { BookmarkNodeType } from "../../db/schema";

export const bookmarkDispatcher = {
  /**
   * bookmark.list - ブックマークツリー取得
   */
  async list(_payload: unknown) {
    return bookmarkService.getBookmarkTree();
  },

  /**
   * bookmark.get - 単一ノード取得
   */
  async get(payload: unknown) {
    const p = payload as { id: string };
    if (!p?.id) {
      throw new Error("id is required");
    }
    const node = await bookmarkService.getBookmarkNodeById(p.id);
    if (!node) {
      throw new Error("Bookmark node not found");
    }
    return node;
  },

  /**
   * bookmark.create - ノード作成
   */
  async create(payload: unknown) {
    const p = payload as {
      parentId?: string | null;
      type: BookmarkNodeType;
      name: string;
      noteId?: string | null;
      url?: string | null;
    };

    if (!p?.type || !p?.name) {
      throw new Error("type and name are required");
    }

    if (p.type === "note" && !p.noteId) {
      throw new Error("noteId is required for note type");
    }

    if (p.type === "link" && !p.url) {
      throw new Error("url is required for link type");
    }

    return bookmarkService.createBookmarkNode({
      parentId: p.parentId ?? null,
      type: p.type,
      name: p.name,
      noteId: p.noteId ?? null,
      url: p.url ?? null,
    });
  },

  /**
   * bookmark.update - ノード更新
   */
  async update(payload: unknown) {
    const p = payload as {
      id: string;
      name?: string;
      isExpanded?: boolean;
    };

    if (!p?.id) {
      throw new Error("id is required");
    }

    return bookmarkService.updateBookmarkNode(p.id, {
      name: p.name,
      isExpanded: p.isExpanded,
    });
  },

  /**
   * bookmark.delete - ノード削除
   */
  async delete(payload: unknown) {
    const p = payload as { id: string };
    if (!p?.id) {
      throw new Error("id is required");
    }
    await bookmarkService.deleteBookmarkNode(p.id);
    return { success: true };
  },

  /**
   * bookmark.move - ノード移動
   */
  async move(payload: unknown) {
    const p = payload as {
      id: string;
      newParentId?: string | null;
      newPosition?: number;
    };

    if (!p?.id) {
      throw new Error("id is required");
    }

    return bookmarkService.moveBookmarkNode(
      p.id,
      p.newParentId ?? null,
      p.newPosition
    );
  },

  /**
   * bookmark.reorder - 並び順更新
   */
  async reorder(payload: unknown) {
    const p = payload as {
      parentId?: string | null;
      orderedIds: string[];
    };

    if (!Array.isArray(p?.orderedIds)) {
      throw new Error("orderedIds must be an array");
    }

    await bookmarkService.reorderBookmarkNodes(
      p.parentId ?? null,
      p.orderedIds
    );
    return { success: true };
  },

  /**
   * bookmark.updateLibraryPosition - ライブラリ3D空間での位置更新
   */
  async updateLibraryPosition(payload: unknown) {
    const p = payload as {
      folderName: string;
      position: [number, number, number];
    };

    if (!p?.folderName) {
      throw new Error("folderName is required");
    }
    if (!Array.isArray(p?.position) || p.position.length !== 3) {
      throw new Error("position must be [x, y, z] array");
    }

    return bookmarkService.updateLibraryPosition(p.folderName, p.position);
  },

  /**
   * bookmark.getLibraryPositions - ライブラリ位置一覧取得
   */
  async getLibraryPositions(_payload: unknown) {
    return bookmarkService.getLibraryPositions();
  },
};
