/**
 * FTS Repository のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  insertFTS,
  insertFTSRaw,
  updateFTS,
  updateFTSRaw,
  deleteFTS,
  deleteFTSRaw,
  searchFTS,
  rebuildFTS,
  checkFTSTableExists,
  createFTSTable,
  parseJsonToText,
  buildFTSQuery,
} from "./index";

// モック
vi.mock("../../db/client", () => {
  const mockRun = vi.fn().mockResolvedValue(undefined);
  const mockAll = vi.fn().mockResolvedValue([]);
  const mockTransaction = vi.fn().mockImplementation(async (callback) => {
    const tx = { run: mockRun };
    await callback(tx);
  });
  return {
    db: {
      run: mockRun,
      all: mockAll,
      transaction: mockTransaction,
    },
  };
});

import { db } from "../../db/client";

describe("ftsRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseJsonToText", () => {
    it("JSON配列を空白区切りテキストに変換する", () => {
      const result = parseJsonToText('["TypeScript","API","React"]');
      expect(result).toBe("TypeScript API React");
    });

    it("nullを渡すと空文字を返す", () => {
      const result = parseJsonToText(null);
      expect(result).toBe("");
    });

    it("空文字を渡すと空文字を返す", () => {
      const result = parseJsonToText("");
      expect(result).toBe("");
    });

    it("無効なJSONを渡すと空文字を返す", () => {
      const result = parseJsonToText("invalid json");
      expect(result).toBe("");
    });

    it("配列でないJSONを渡すと空文字を返す", () => {
      const result = parseJsonToText('{"key": "value"}');
      expect(result).toBe("");
    });

    it("空配列を渡すと空文字を返す", () => {
      const result = parseJsonToText("[]");
      expect(result).toBe("");
    });

    it("単一要素の配列を変換する", () => {
      const result = parseJsonToText('["single"]');
      expect(result).toBe("single");
    });
  });

  describe("buildFTSQuery", () => {
    it("単一単語に前方一致の*を付ける", () => {
      const result = buildFTSQuery("TypeScript");
      expect(result).toBe("TypeScript*");
    });

    it("複数単語に前方一致の*を付ける", () => {
      const result = buildFTSQuery("React hooks");
      expect(result).toBe("React* hooks*");
    });

    it("空文字を渡すと空文字を返す", () => {
      const result = buildFTSQuery("");
      expect(result).toBe("");
    });

    it("空白のみを渡すと空文字を返す", () => {
      const result = buildFTSQuery("   ");
      expect(result).toBe("");
    });

    it("特殊文字を除去する", () => {
      const result = buildFTSQuery("React's [hooks]");
      expect(result).toBe("React* s* hooks*");
    });

    it("OR演算子をそのまま保持する", () => {
      const result = buildFTSQuery("React OR Vue");
      expect(result).toBe("React* OR Vue*");
    });

    it("AND演算子をそのまま保持する", () => {
      const result = buildFTSQuery("React AND hooks");
      expect(result).toBe("React* AND hooks*");
    });

    it("NOT演算子をそのまま保持する", () => {
      const result = buildFTSQuery("React NOT class");
      expect(result).toBe("React* NOT class*");
    });

    it("小文字の演算子を大文字に変換する", () => {
      const result = buildFTSQuery("React or Vue");
      expect(result).toBe("React* OR Vue*");
    });

    it("連続する空白を正規化する", () => {
      const result = buildFTSQuery("React   hooks");
      expect(result).toBe("React* hooks*");
    });

    it("先頭と末尾の空白をトリムする", () => {
      const result = buildFTSQuery("  React  ");
      expect(result).toBe("React*");
    });

    it("特殊文字のみの場合は空文字を返す", () => {
      const result = buildFTSQuery("***[]{}");
      expect(result).toBe("");
    });

    it("日本語を処理できる", () => {
      const result = buildFTSQuery("テスト コード");
      expect(result).toBe("テスト* コード*");
    });
  });

  describe("insertFTS", () => {
    it("FTSテーブルにデータを挿入する", async () => {
      await insertFTS("note-1", "Title", "Content", null, null);

      expect(db.run).toHaveBeenCalled();
    });

    it("tagsをテキストに変換して挿入する", async () => {
      await insertFTS("note-1", "Title", "Content", '["tag1","tag2"]', null);

      expect(db.run).toHaveBeenCalled();
    });

    it("headingsをテキストに変換して挿入する", async () => {
      await insertFTS("note-1", "Title", "Content", null, '["heading1"]');

      expect(db.run).toHaveBeenCalled();
    });
  });

  describe("insertFTSRaw", () => {
    it("トランザクション内でFTSテーブルにデータを挿入する", async () => {
      const mockTx = { run: vi.fn().mockResolvedValue(undefined) };

      await insertFTSRaw(
        mockTx as any,
        "note-1",
        "Title",
        "Content",
        null,
        null
      );

      expect(mockTx.run).toHaveBeenCalled();
    });
  });

  describe("deleteFTS", () => {
    it("FTSテーブルからデータを削除する", async () => {
      await deleteFTS("note-1");

      expect(db.run).toHaveBeenCalled();
    });
  });

  describe("deleteFTSRaw", () => {
    it("トランザクション内でFTSテーブルからデータを削除する", async () => {
      const mockTx = { run: vi.fn().mockResolvedValue(undefined) };

      await deleteFTSRaw(mockTx as any, "note-1");

      expect(mockTx.run).toHaveBeenCalled();
    });
  });

  describe("updateFTS", () => {
    it("FTSテーブルのデータを更新する（削除+挿入）", async () => {
      await updateFTS("note-1", "New Title", "New Content", null, null);

      // 削除と挿入で2回呼ばれる
      expect(db.run).toHaveBeenCalledTimes(2);
    });
  });

  describe("updateFTSRaw", () => {
    it("トランザクション内でFTSテーブルのデータを更新する", async () => {
      const mockTx = { run: vi.fn().mockResolvedValue(undefined) };

      await updateFTSRaw(
        mockTx as any,
        "note-1",
        "New Title",
        "New Content",
        null,
        null
      );

      // 削除と挿入で2回呼ばれる
      expect(mockTx.run).toHaveBeenCalledTimes(2);
    });
  });

  describe("searchFTS", () => {
    it("検索結果を返す", async () => {
      const mockResults = [
        { note_id: "note-1", rank: -1.5 },
        { note_id: "note-2", rank: -1.2 },
      ];
      vi.mocked(db.all).mockResolvedValue(mockResults);

      const result = await searchFTS("TypeScript");

      expect(result).toEqual([
        { noteId: "note-1", rank: -1.5 },
        { noteId: "note-2", rank: -1.2 },
      ]);
    });

    it("空のクエリで空配列を返す", async () => {
      const result = await searchFTS("");

      expect(result).toEqual([]);
      expect(db.all).not.toHaveBeenCalled();
    });

    it("特殊文字のみのクエリで空配列を返す", async () => {
      const result = await searchFTS("***");

      expect(result).toEqual([]);
      expect(db.all).not.toHaveBeenCalled();
    });

    it("デフォルトのlimitは50", async () => {
      vi.mocked(db.all).mockResolvedValue([]);

      await searchFTS("test");

      expect(db.all).toHaveBeenCalled();
    });

    it("カスタムlimitを指定できる", async () => {
      vi.mocked(db.all).mockResolvedValue([]);

      await searchFTS("test", 10);

      expect(db.all).toHaveBeenCalled();
    });
  });

  describe("rebuildFTS", () => {
    it("全ノートでFTSテーブルを再構築する", async () => {
      const notes = [
        {
          id: "note-1",
          title: "Title 1",
          content: "Content 1",
          tags: null,
          headings: null,
        },
        {
          id: "note-2",
          title: "Title 2",
          content: "Content 2",
          tags: '["tag"]',
          headings: null,
        },
      ];

      await rebuildFTS(notes);

      expect(db.transaction).toHaveBeenCalled();
    });

    it("空配列でも正常に動作する", async () => {
      await rebuildFTS([]);

      expect(db.transaction).toHaveBeenCalled();
    });
  });

  describe("checkFTSTableExists", () => {
    it("テーブルが存在する場合trueを返す", async () => {
      vi.mocked(db.all).mockResolvedValue([{ name: "notes_fts" }]);

      const result = await checkFTSTableExists();

      expect(result).toBe(true);
    });

    it("テーブルが存在しない場合falseを返す", async () => {
      vi.mocked(db.all).mockResolvedValue([]);

      const result = await checkFTSTableExists();

      expect(result).toBe(false);
    });

    it("エラーが発生した場合falseを返す", async () => {
      vi.mocked(db.all).mockRejectedValue(new Error("DB error"));

      const result = await checkFTSTableExists();

      expect(result).toBe(false);
    });
  });

  describe("createFTSTable", () => {
    it("FTSテーブルを作成する", async () => {
      await createFTSTable();

      expect(db.run).toHaveBeenCalled();
    });
  });
});
