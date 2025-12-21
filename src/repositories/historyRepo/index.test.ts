/**
 * History Repository のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  insertHistory,
  findHistoryByNoteId,
  countHistoryByNoteId,
  findHistoryById,
} from "./index";

// DBクライアントをモック
vi.mock("../../db/client", () => {
  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });
  const mockSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue([]),
          }),
        }),
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  });
  return {
    db: {
      insert: mockInsert,
      select: mockSelect,
    },
  };
});

import { db } from "../../db/client";

describe("historyRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("insertHistory", () => {
    it("履歴データを挿入する", async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as any);

      const historyData = {
        id: "history-1",
        noteId: "note-1",
        content: "過去の内容",
        createdAt: 1700000000,
      };

      await insertHistory(historyData);

      expect(db.insert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(historyData);
    });
  });

  describe("findHistoryByNoteId", () => {
    it("ノートIDで履歴を取得する", async () => {
      const mockHistories = [
        { id: "h1", noteId: "note-1", content: "内容1", createdAt: 1700000000 },
        { id: "h2", noteId: "note-1", content: "内容2", createdAt: 1699900000 },
      ];

      const mockOffset = vi.fn().mockResolvedValue(mockHistories);
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findHistoryByNoteId("note-1");

      expect(result).toEqual(mockHistories);
      expect(db.select).toHaveBeenCalled();
    });

    it("limitとoffsetを指定できる", async () => {
      const mockOffset = vi.fn().mockResolvedValue([]);
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await findHistoryByNoteId("note-1", { limit: 5, offset: 10 });

      expect(mockLimit).toHaveBeenCalledWith(5);
      expect(mockOffset).toHaveBeenCalledWith(10);
    });

    it("デフォルトのlimitは1000、offsetは0", async () => {
      const mockOffset = vi.fn().mockResolvedValue([]);
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await findHistoryByNoteId("note-1");

      expect(mockLimit).toHaveBeenCalledWith(1000);
      expect(mockOffset).toHaveBeenCalledWith(0);
    });
  });

  describe("countHistoryByNoteId", () => {
    it("履歴の件数を返す", async () => {
      const mockHistories = [
        { id: "h1" },
        { id: "h2" },
        { id: "h3" },
      ];

      const mockWhere = vi.fn().mockResolvedValue(mockHistories);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await countHistoryByNoteId("note-1");

      expect(result).toBe(3);
    });

    it("履歴がない場合は0を返す", async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await countHistoryByNoteId("note-1");

      expect(result).toBe(0);
    });
  });

  describe("findHistoryById", () => {
    it("履歴IDで履歴を取得する", async () => {
      const mockHistory = {
        id: "history-1",
        noteId: "note-1",
        content: "過去の内容",
        createdAt: 1700000000,
      };

      const mockLimit = vi.fn().mockResolvedValue([mockHistory]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findHistoryById("history-1");

      expect(result).toEqual(mockHistory);
    });

    it("履歴が見つからない場合はnullを返す", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findHistoryById("not-found");

      expect(result).toBeNull();
    });
  });
});
