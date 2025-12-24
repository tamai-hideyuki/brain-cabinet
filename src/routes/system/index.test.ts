/**
 * System Route のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// モック用の関数をvi.hoistedで作成（vi.mockより先に評価される）
const { mockStatSync, mockDbAll } = vi.hoisted(() => ({
  mockStatSync: vi.fn(),
  mockDbAll: vi.fn(),
}));

// モック
vi.mock("fs", () => ({
  default: {
    statSync: mockStatSync,
  },
}));

vi.mock("../../db/client", () => ({
  db: {
    all: mockDbAll,
  },
}));

vi.mock("../../utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { systemRoute } from "./index";

describe("systemRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /storage", () => {
    it("正常時にストレージ統計を返す", async () => {
      // DBファイルサイズのモック
      mockStatSync.mockReturnValue({ size: 1024000 });

      // テーブルクエリのモック（notesテーブルに10件）
      mockDbAll.mockImplementation(async (query: unknown) => {
        const queryStr =
          (query as { queryChunks?: { value: string }[] }).queryChunks?.[0]
            ?.value || String(query);
        if (queryStr.includes("COUNT(*)")) {
          if (queryStr.includes("notes")) {
            return [{ count: 10 }];
          }
          return [{ count: 0 }];
        }
        if (queryStr.includes("SUM(LENGTH")) {
          return [{ size: 50000 }];
        }
        return [];
      });

      const res = await systemRoute.request("/storage");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.totalSize).toBe(1024000);
      expect(json.tables).toBeDefined();
      expect(Array.isArray(json.tables)).toBe(true);
    });

    it("テーブル情報を正しい形式で返す", async () => {
      mockStatSync.mockReturnValue({ size: 500000 });
      mockDbAll.mockResolvedValue([{ count: 5 }]);

      const res = await systemRoute.request("/storage");
      const json = await res.json();

      expect(res.status).toBe(200);

      // テーブル情報の形式を確認
      const notesTable = json.tables.find(
        (t: { name: string }) => t.name === "notes"
      );
      expect(notesTable).toBeDefined();
      expect(notesTable.label).toBe("ノート");
      expect(typeof notesTable.rowCount).toBe("number");
      expect(typeof notesTable.size).toBe("number");
    });

    it("DBファイルが存在しない場合でもtotalSize=0で処理を継続する", async () => {
      mockStatSync.mockImplementation(() => {
        throw new Error("ENOENT: no such file");
      });
      mockDbAll.mockResolvedValue([{ count: 0 }]);

      const res = await systemRoute.request("/storage");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.totalSize).toBe(0);
      expect(json.tables).toBeDefined();
    });

    it("テーブルクエリでエラーが発生した場合でも処理を継続する", async () => {
      mockStatSync.mockReturnValue({ size: 100000 });
      mockDbAll.mockRejectedValue(new Error("SQL error"));

      const res = await systemRoute.request("/storage");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.totalSize).toBe(100000);
      // エラーが発生したテーブルはrowCount=0, size=0になる
      expect(
        json.tables.every(
          (t: { rowCount: number; size: number }) =>
            t.rowCount === 0 && t.size === 0
        )
      ).toBe(true);
    });

    it("テーブルがサイズ順（降順）でソートされる", async () => {
      mockStatSync.mockReturnValue({ size: 1000000 });

      // 異なるサイズを返すモック
      let callCount = 0;
      mockDbAll.mockImplementation(async () => {
        callCount++;
        // 奇数回目は大きいcount、偶数回目は小さいcount
        return [{ count: callCount % 2 === 1 ? 100 : 10 }];
      });

      const res = await systemRoute.request("/storage");
      const json = await res.json();

      expect(res.status).toBe(200);

      // サイズが降順になっていることを確認
      for (let i = 1; i < json.tables.length; i++) {
        expect(json.tables[i - 1].size).toBeGreaterThanOrEqual(
          json.tables[i].size
        );
      }
    });

    it("空のテーブルはrowCount=0, size=0を返す", async () => {
      mockStatSync.mockReturnValue({ size: 50000 });
      mockDbAll.mockResolvedValue([{ count: 0 }]);

      const res = await systemRoute.request("/storage");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(
        json.tables.every(
          (t: { rowCount: number; size: number }) =>
            t.rowCount === 0 && t.size === 0
        )
      ).toBe(true);
    });

    it("全テーブルの定義が含まれている", async () => {
      mockStatSync.mockReturnValue({ size: 100000 });
      mockDbAll.mockResolvedValue([{ count: 1 }]);

      const res = await systemRoute.request("/storage");
      const json = await res.json();

      expect(res.status).toBe(200);

      // 主要テーブルが含まれていることを確認
      const tableNames = json.tables.map((t: { name: string }) => t.name);
      expect(tableNames).toContain("notes");
      expect(tableNames).toContain("note_history");
      expect(tableNames).toContain("note_embeddings");
      expect(tableNames).toContain("clusters");
      expect(tableNames).toContain("secret_box_items");
      expect(tableNames).toContain("bookmark_nodes");
    });

    it("BLOBカラムを持つテーブルのサイズ計算が正しい", async () => {
      mockStatSync.mockReturnValue({ size: 500000 });

      // note_embeddingsのみ特別な値を返す
      let noteEmbeddingsQueryCount = 0;
      mockDbAll.mockImplementation(async (query: unknown) => {
        // sql.rawの場合、クエリはSymbolでラップされている
        const queryStr = JSON.stringify(query);

        if (queryStr.includes("note_embeddings")) {
          noteEmbeddingsQueryCount++;
          if (noteEmbeddingsQueryCount === 1) {
            // COUNT(*)クエリ
            return [{ count: 10 }];
          } else {
            // SUM(LENGTH())クエリ
            return [{ size: 100000 }];
          }
        }

        // 他のテーブルは0件
        return [{ count: 0 }];
      });

      const res = await systemRoute.request("/storage");
      const json = await res.json();

      expect(res.status).toBe(200);

      // note_embeddingsはBLOBを持つテーブル
      const embeddingsTable = json.tables.find(
        (t: { name: string }) => t.name === "note_embeddings"
      );
      expect(embeddingsTable).toBeDefined();
      expect(embeddingsTable.rowCount).toBe(10);
      // BLOBサイズ(100000) + 行データ推定(10 * 200) = 102000
      expect(embeddingsTable.size).toBe(102000);
    });
  });
});
