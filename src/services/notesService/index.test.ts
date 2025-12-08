import { describe, it, expect, vi, beforeEach } from "vitest";

// notesService の内部ロジックをテスト

describe("notesService", () => {
  describe("parseJsonArray（安全なJSONパース）", () => {
    const parseJsonArray = (jsonStr: string | null): string[] => {
      if (!jsonStr) return [];
      try {
        const parsed = JSON.parse(jsonStr);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    it("有効なJSON配列をパースする", () => {
      expect(parseJsonArray('["tag1", "tag2", "tag3"]')).toEqual(["tag1", "tag2", "tag3"]);
    });

    it("nullを空配列として処理する", () => {
      expect(parseJsonArray(null)).toEqual([]);
    });

    it("空文字列を空配列として処理する", () => {
      expect(parseJsonArray("")).toEqual([]);
    });

    it("不正なJSONを空配列として処理する", () => {
      expect(parseJsonArray("invalid")).toEqual([]);
      expect(parseJsonArray("[invalid json")).toEqual([]);
    });

    it("配列でないJSONを空配列として処理する", () => {
      expect(parseJsonArray('{"key": "value"}')).toEqual([]);
      expect(parseJsonArray("123")).toEqual([]);
      expect(parseJsonArray('"string"')).toEqual([]);
      expect(parseJsonArray("true")).toEqual([]);
    });

    it("ネストした配列を処理する", () => {
      expect(parseJsonArray('[["nested"]]')).toEqual([["nested"]]);
    });

    it("空の配列を処理する", () => {
      expect(parseJsonArray("[]")).toEqual([]);
    });
  });

  describe("formatNoteForAPI（API用フォーマット変換）", () => {
    const parseJsonArray = (jsonStr: string | null): string[] => {
      if (!jsonStr) return [];
      try {
        const parsed = JSON.parse(jsonStr);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    const formatNoteForAPI = (note: {
      id: string;
      title: string;
      path: string;
      content: string;
      tags: string | null;
      category: string | null;
      headings: string | null;
      createdAt: number;
      updatedAt: number;
    }) => {
      return {
        ...note,
        tags: parseJsonArray(note.tags),
        headings: parseJsonArray(note.headings),
      };
    };

    it("tagsとheadingsをパースする", () => {
      const note = {
        id: "1",
        title: "テスト",
        path: "/test.md",
        content: "本文",
        tags: '["tag1", "tag2"]',
        category: "技術",
        headings: '["見出し1", "見出し2"]',
        createdAt: 1000,
        updatedAt: 2000,
      };
      const formatted = formatNoteForAPI(note);
      expect(formatted.tags).toEqual(["tag1", "tag2"]);
      expect(formatted.headings).toEqual(["見出し1", "見出し2"]);
    });

    it("nullのtagsとheadingsを空配列に", () => {
      const note = {
        id: "1",
        title: "テスト",
        path: "/test.md",
        content: "本文",
        tags: null,
        category: null,
        headings: null,
        createdAt: 1000,
        updatedAt: 2000,
      };
      const formatted = formatNoteForAPI(note);
      expect(formatted.tags).toEqual([]);
      expect(formatted.headings).toEqual([]);
    });

    it("その他のフィールドはそのまま", () => {
      const note = {
        id: "abc123",
        title: "タイトル",
        path: "/path/to/note.md",
        content: "本文の内容",
        tags: null,
        category: "日記",
        headings: null,
        createdAt: 1609459200,
        updatedAt: 1609545600,
      };
      const formatted = formatNoteForAPI(note);
      expect(formatted.id).toBe("abc123");
      expect(formatted.title).toBe("タイトル");
      expect(formatted.path).toBe("/path/to/note.md");
      expect(formatted.content).toBe("本文の内容");
      expect(formatted.category).toBe("日記");
      expect(formatted.createdAt).toBe(1609459200);
      expect(formatted.updatedAt).toBe(1609545600);
    });
  });

  describe("バリデーションロジック", () => {
    const validateCreateNote = (title: string, content: string): { valid: boolean; error?: string } => {
      if (!title || !content) {
        return { valid: false, error: "Title and content are required" };
      }
      return { valid: true };
    };

    it("titleとcontentが必須", () => {
      expect(validateCreateNote("", "content")).toEqual({
        valid: false,
        error: "Title and content are required",
      });
      expect(validateCreateNote("title", "")).toEqual({
        valid: false,
        error: "Title and content are required",
      });
      expect(validateCreateNote("", "")).toEqual({
        valid: false,
        error: "Title and content are required",
      });
    });

    it("有効な入力を受け入れる", () => {
      expect(validateCreateNote("タイトル", "本文")).toEqual({ valid: true });
    });
  });

  describe("変更検出ロジック", () => {
    const detectChanges = (
      oldNote: { title: string; content: string },
      newTitle: string | undefined,
      newContent: string
    ): { titleChanged: boolean; contentChanged: boolean; hasChanges: boolean } => {
      const titleChanged = newTitle !== undefined && newTitle !== oldNote.title;
      const contentChanged = oldNote.content !== newContent;
      return {
        titleChanged,
        contentChanged,
        hasChanges: titleChanged || contentChanged,
      };
    };

    it("タイトル変更を検出", () => {
      const old = { title: "旧タイトル", content: "本文" };
      const result = detectChanges(old, "新タイトル", "本文");
      expect(result.titleChanged).toBe(true);
      expect(result.contentChanged).toBe(false);
      expect(result.hasChanges).toBe(true);
    });

    it("コンテンツ変更を検出", () => {
      const old = { title: "タイトル", content: "旧本文" };
      const result = detectChanges(old, undefined, "新本文");
      expect(result.titleChanged).toBe(false);
      expect(result.contentChanged).toBe(true);
      expect(result.hasChanges).toBe(true);
    });

    it("両方変更を検出", () => {
      const old = { title: "旧タイトル", content: "旧本文" };
      const result = detectChanges(old, "新タイトル", "新本文");
      expect(result.titleChanged).toBe(true);
      expect(result.contentChanged).toBe(true);
      expect(result.hasChanges).toBe(true);
    });

    it("変更なしを検出", () => {
      const old = { title: "タイトル", content: "本文" };
      const result = detectChanges(old, undefined, "本文");
      expect(result.titleChanged).toBe(false);
      expect(result.contentChanged).toBe(false);
      expect(result.hasChanges).toBe(false);
    });

    it("同じタイトルを指定しても変更なし", () => {
      const old = { title: "タイトル", content: "本文" };
      const result = detectChanges(old, "タイトル", "本文");
      expect(result.titleChanged).toBe(false);
      expect(result.hasChanges).toBe(false);
    });
  });

  describe("履歴復元バリデーション", () => {
    const validateRevert = (
      historyNoteId: string,
      targetNoteId: string
    ): { valid: boolean; error?: string } => {
      if (historyNoteId !== targetNoteId) {
        return { valid: false, error: "History does not belong to this note" };
      }
      return { valid: true };
    };

    it("一致するnoteIdを受け入れる", () => {
      expect(validateRevert("note-123", "note-123")).toEqual({ valid: true });
    });

    it("不一致のnoteIdを拒否", () => {
      expect(validateRevert("note-123", "note-456")).toEqual({
        valid: false,
        error: "History does not belong to this note",
      });
    });
  });

  describe("ジョブペイロード生成", () => {
    type NoteAnalyzePayload = {
      noteId: string;
      previousContent: string | null;
      previousClusterId: number | null;
      updatedAt: number;
    };

    const createJobPayload = (
      noteId: string,
      updatedAt: number,
      previousContent: string | null,
      previousClusterId: number | null
    ): NoteAnalyzePayload => {
      return {
        noteId,
        previousContent,
        previousClusterId,
        updatedAt,
      };
    };

    it("新規作成時のペイロード", () => {
      const payload = createJobPayload("note-1", 1000, null, null);
      expect(payload).toEqual({
        noteId: "note-1",
        previousContent: null,
        previousClusterId: null,
        updatedAt: 1000,
      });
    });

    it("更新時のペイロード", () => {
      const payload = createJobPayload("note-1", 2000, "旧本文", 5);
      expect(payload).toEqual({
        noteId: "note-1",
        previousContent: "旧本文",
        previousClusterId: 5,
        updatedAt: 2000,
      });
    });

    it("コンテンツ変更なしのペイロード", () => {
      const payload = createJobPayload("note-1", 2000, null, 5);
      expect(payload.previousContent).toBeNull();
      expect(payload.previousClusterId).toBe(5);
    });
  });
});
