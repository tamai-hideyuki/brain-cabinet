/**
 * Embedding Repository のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DEFAULT_MODEL,
  DEFAULT_DIMENSIONS,
  EMBEDDING_VERSION,
  saveEmbedding,
  getEmbedding,
  deleteEmbedding,
  getAllEmbeddings,
  hasEmbedding,
  createEmbeddingTable,
  checkEmbeddingTableExists,
  countEmbeddings,
  deleteEmbeddingRaw,
  float32ArrayToBuffer,
  bufferToFloat32Array,
} from "./index";

// モック
vi.mock("../../db/client", () => {
  const mockRun = vi.fn().mockResolvedValue(undefined);
  const mockAll = vi.fn().mockResolvedValue([]);
  return {
    db: {
      run: mockRun,
      all: mockAll,
    },
  };
});

import { db } from "../../db/client";

describe("embeddingRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("定数", () => {
    it("DEFAULT_MODELはminilm-v1", () => {
      expect(DEFAULT_MODEL).toBe("minilm-v1");
    });

    it("DEFAULT_DIMENSIONSは384", () => {
      expect(DEFAULT_DIMENSIONS).toBe(384);
    });

    it("EMBEDDING_VERSIONはminilm-v1", () => {
      expect(EMBEDDING_VERSION).toBe("minilm-v1");
    });
  });

  describe("float32ArrayToBuffer", () => {
    it("number配列をBufferに変換する", () => {
      const arr = [1.0, 2.0, 3.0];
      const buffer = float32ArrayToBuffer(arr);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBe(12); // 3 * 4 bytes (Float32)
    });

    it("空配列を変換する", () => {
      const buffer = float32ArrayToBuffer([]);

      expect(buffer.length).toBe(0);
    });

    it("変換後に復元できる", () => {
      const original = [1.5, 2.5, 3.5];
      const buffer = float32ArrayToBuffer(original);
      const restored = bufferToFloat32Array(buffer);

      expect(restored).toEqual(original);
    });
  });

  describe("bufferToFloat32Array", () => {
    it("BufferをFloat32配列に変換する", () => {
      const original = [1.0, 2.0, 3.0];
      const float32 = new Float32Array(original);
      const buffer = Buffer.from(float32.buffer);

      const result = bufferToFloat32Array(buffer);

      expect(result).toEqual(original);
    });

    it("ArrayBufferをFloat32配列に変換する", () => {
      const original = [1.0, 2.0];
      const float32 = new Float32Array(original);

      const result = bufferToFloat32Array(float32.buffer);

      expect(result).toEqual(original);
    });

    it("Uint8ArrayをFloat32配列に変換する", () => {
      const original = [1.0, 2.0];
      const float32 = new Float32Array(original);
      const uint8 = new Uint8Array(float32.buffer);

      const result = bufferToFloat32Array(uint8);

      expect(result).toEqual(original);
    });

    it("予期しない型の場合は空配列を返す", () => {
      const result = bufferToFloat32Array({} as any);

      expect(result).toEqual([]);
    });
  });

  describe("saveEmbedding", () => {
    it("Embeddingを保存する", async () => {
      await saveEmbedding("note-1", [1.0, 2.0, 3.0]);

      expect(db.run).toHaveBeenCalled();
    });

    it("デフォルトモデルを使用する", async () => {
      await saveEmbedding("note-1", [1.0, 2.0]);

      expect(db.run).toHaveBeenCalled();
    });

    it("カスタムモデルを指定できる", async () => {
      await saveEmbedding("note-1", [1.0, 2.0], "custom-model", "v2");

      expect(db.run).toHaveBeenCalled();
    });
  });

  describe("getEmbedding", () => {
    it("Embeddingを取得する", async () => {
      const mockEmbedding = [1.0, 2.0, 3.0];
      const buffer = float32ArrayToBuffer(mockEmbedding);
      vi.mocked(db.all).mockResolvedValue([{ embedding: buffer }]);

      const result = await getEmbedding("note-1");

      expect(result).toEqual(mockEmbedding);
    });

    it("存在しない場合はnullを返す", async () => {
      vi.mocked(db.all).mockResolvedValue([]);

      const result = await getEmbedding("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("deleteEmbedding", () => {
    it("Embeddingを削除する", async () => {
      await deleteEmbedding("note-1");

      expect(db.run).toHaveBeenCalled();
    });
  });

  describe("getAllEmbeddings", () => {
    it("全Embeddingを取得する", async () => {
      const mockData = [
        { note_id: "note-1", embedding: float32ArrayToBuffer([1.0, 2.0]) },
        { note_id: "note-2", embedding: float32ArrayToBuffer([3.0, 4.0]) },
      ];
      vi.mocked(db.all).mockResolvedValue(mockData);

      const result = await getAllEmbeddings();

      expect(result).toEqual([
        { noteId: "note-1", embedding: [1.0, 2.0] },
        { noteId: "note-2", embedding: [3.0, 4.0] },
      ]);
    });

    it("Embeddingがない場合は空配列を返す", async () => {
      vi.mocked(db.all).mockResolvedValue([]);

      const result = await getAllEmbeddings();

      expect(result).toEqual([]);
    });
  });

  describe("hasEmbedding", () => {
    it("Embeddingが存在する場合trueを返す", async () => {
      vi.mocked(db.all).mockResolvedValue([{ count: 1 }]);

      const result = await hasEmbedding("note-1");

      expect(result).toBe(true);
    });

    it("Embeddingが存在しない場合falseを返す", async () => {
      vi.mocked(db.all).mockResolvedValue([{ count: 0 }]);

      const result = await hasEmbedding("note-1");

      expect(result).toBe(false);
    });
  });

  describe("createEmbeddingTable", () => {
    it("Embeddingテーブルを作成する", async () => {
      await createEmbeddingTable();

      expect(db.run).toHaveBeenCalled();
    });
  });

  describe("checkEmbeddingTableExists", () => {
    it("テーブルが存在する場合trueを返す", async () => {
      vi.mocked(db.all).mockResolvedValue([{ name: "note_embeddings" }]);

      const result = await checkEmbeddingTableExists();

      expect(result).toBe(true);
    });

    it("テーブルが存在しない場合falseを返す", async () => {
      vi.mocked(db.all).mockResolvedValue([]);

      const result = await checkEmbeddingTableExists();

      expect(result).toBe(false);
    });

    it("エラーが発生した場合falseを返す", async () => {
      vi.mocked(db.all).mockRejectedValue(new Error("DB error"));

      const result = await checkEmbeddingTableExists();

      expect(result).toBe(false);
    });
  });

  describe("countEmbeddings", () => {
    it("Embedding数を返す", async () => {
      vi.mocked(db.all).mockResolvedValue([{ count: 42 }]);

      const result = await countEmbeddings();

      expect(result).toBe(42);
    });

    it("結果がない場合は0を返す", async () => {
      vi.mocked(db.all).mockResolvedValue([]);

      const result = await countEmbeddings();

      expect(result).toBe(0);
    });
  });

  describe("deleteEmbeddingRaw", () => {
    it("トランザクション内でEmbeddingを削除する", async () => {
      const mockRun = vi.fn().mockResolvedValue(undefined);
      const mockTx = { run: mockRun };

      await deleteEmbeddingRaw(mockTx as any, "note-1");

      expect(mockRun).toHaveBeenCalled();
    });
  });
});
