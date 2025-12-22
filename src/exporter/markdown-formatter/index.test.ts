/**
 * Markdown Formatter のテスト
 */

import { describe, it, expect } from "vitest";
import { formatNoteAsMarkdown, generateExportPath } from "./index";

describe("markdown-formatter", () => {
  describe("formatNoteAsMarkdown", () => {
    const createNote = (overrides: Partial<{
      id: string;
      title: string;
      path: string;
      content: string;
      tags: string | null;
      category: string | null;
      headings: string | null;
      createdAt: number;
      updatedAt: number;
    }> = {}) => ({
      id: "note-123",
      title: "Test Note",
      path: "test/path.md",
      content: "This is test content.",
      tags: null,
      category: null,
      headings: null,
      createdAt: 1705276800, // 2024-01-15 00:00:00 UTC
      updatedAt: 1705363200, // 2024-01-16 00:00:00 UTC
      ...overrides,
    });

    it("基本的なノートをMarkdown形式に変換する", () => {
      const note = createNote();
      const result = formatNoteAsMarkdown(note);

      expect(result).toContain("---");
      expect(result).toContain("id: note-123");
      expect(result).toContain('title: "Test Note"');
      expect(result).toContain('source_path: "test/path.md"');
      expect(result).toContain("This is test content.");
    });

    it("フロントマターにID、タイトル、日時が含まれる", () => {
      const note = createNote();
      const result = formatNoteAsMarkdown(note);

      expect(result).toContain("id: note-123");
      expect(result).toContain('title: "Test Note"');
      expect(result).toContain("created_at:");
      expect(result).toContain("updated_at:");
    });

    it("カテゴリがある場合はフロントマターに含まれる", () => {
      const note = createNote({ category: "tech" });
      const result = formatNoteAsMarkdown(note);

      expect(result).toContain("category: tech");
    });

    it("カテゴリがnullの場合はフロントマターに含まれない", () => {
      const note = createNote({ category: null });
      const result = formatNoteAsMarkdown(note);

      expect(result).not.toContain("category:");
    });

    it("タグがある場合はYAML配列形式で含まれる", () => {
      const note = createNote({ tags: JSON.stringify(["javascript", "typescript"]) });
      const result = formatNoteAsMarkdown(note);

      expect(result).toContain("tags:");
      expect(result).toContain("  - javascript");
      expect(result).toContain("  - typescript");
    });

    it("タグがnullの場合はフロントマターに含まれない", () => {
      const note = createNote({ tags: null });
      const result = formatNoteAsMarkdown(note);

      expect(result).not.toContain("tags:");
    });

    it("見出しがある場合はフロントマターに含まれる", () => {
      const note = createNote({ headings: JSON.stringify(["Introduction", "Setup"]) });
      const result = formatNoteAsMarkdown(note);

      expect(result).toContain("headings:");
      expect(result).toContain('  - "Introduction"');
      expect(result).toContain('  - "Setup"');
    });

    it("コンテンツがH1で始まる場合はタイトルを追加しない", () => {
      const note = createNote({
        title: "My Title",
        content: "# My Title\n\nContent here.",
      });
      const result = formatNoteAsMarkdown(note);

      // H1タイトルは1つだけ
      const h1Count = (result.match(/^# /gm) || []).length;
      expect(h1Count).toBe(1);
    });

    it("コンテンツがH1で始まらない場合はタイトルを追加する", () => {
      const note = createNote({
        title: "My Title",
        content: "Some content without heading.",
      });
      const result = formatNoteAsMarkdown(note);

      expect(result).toContain("# My Title");
      expect(result).toContain("Some content without heading.");
    });

    it("タイトルに特殊文字が含まれる場合はエスケープされる", () => {
      const note = createNote({ title: 'Title with "quotes"' });
      const result = formatNoteAsMarkdown(note);

      expect(result).toContain('title: "Title with \\"quotes\\""');
    });

    it("不正なJSONタグは空配列として扱われる", () => {
      const note = createNote({ tags: "invalid json" });
      const result = formatNoteAsMarkdown(note);

      expect(result).not.toContain("tags:");
    });

    it("空のタグ配列は含まれない", () => {
      const note = createNote({ tags: "[]" });
      const result = formatNoteAsMarkdown(note);

      expect(result).not.toContain("tags:");
    });

    it("日時がISO 8601形式で出力される", () => {
      const note = createNote({
        createdAt: 1705276800,
        updatedAt: 1705363200,
      });
      const result = formatNoteAsMarkdown(note);

      expect(result).toMatch(/created_at: \d{4}-\d{2}-\d{2}T/);
      expect(result).toMatch(/updated_at: \d{4}-\d{2}-\d{2}T/);
    });

    it("フロントマターは---で囲まれる", () => {
      const note = createNote();
      const result = formatNoteAsMarkdown(note);

      const lines = result.split("\n");
      expect(lines[0]).toBe("---");
      expect(result).toMatch(/---\n\n/); // フロントマター終了と本文の間に空行
    });
  });

  describe("generateExportPath", () => {
    const slugify = (text: string) => text.toLowerCase().replace(/\s+/g, "-");

    it("カテゴリとタイトルからパスを生成する", () => {
      const note = {
        id: "note-123",
        title: "My Note",
        path: "some/path.md",
        content: "Content",
        tags: null,
        category: "tech",
        headings: null,
        createdAt: 0,
        updatedAt: 0,
      };

      const result = generateExportPath(note, slugify);
      expect(result).toBe("tech/my-note.md");
    });

    it("カテゴリがnullの場合はuncategorizedを使う", () => {
      const note = {
        id: "note-123",
        title: "My Note",
        path: "some/path.md",
        content: "Content",
        tags: null,
        category: null,
        headings: null,
        createdAt: 0,
        updatedAt: 0,
      };

      const result = generateExportPath(note, slugify);
      expect(result).toBe("uncategorized/my-note.md");
    });

    it("タイトルをslugify関数で変換する", () => {
      const note = {
        id: "note-123",
        title: "Hello World Test",
        path: "some/path.md",
        content: "Content",
        tags: null,
        category: "ideas",
        headings: null,
        createdAt: 0,
        updatedAt: 0,
      };

      const customSlugify = (text: string) => text.replace(/\s/g, "_").toLowerCase();
      const result = generateExportPath(note, customSlugify);
      expect(result).toBe("ideas/hello_world_test.md");
    });

    it(".md拡張子が付加される", () => {
      const note = {
        id: "note-123",
        title: "Test",
        path: "some/path.md",
        content: "Content",
        tags: null,
        category: "misc",
        headings: null,
        createdAt: 0,
        updatedAt: 0,
      };

      const result = generateExportPath(note, slugify);
      expect(result).toMatch(/\.md$/);
    });
  });
});
