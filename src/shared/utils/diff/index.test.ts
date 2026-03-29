import { describe, it, expect } from "vitest";
import { computeDiff, computeHtmlDiff } from "./index";

describe("computeDiff", () => {
  describe("基本的な差分生成", () => {
    it("同一テキストの場合は空のパッチを返す", () => {
      const result = computeDiff("hello", "hello");
      expect(result).toBe("");
    });

    it("完全に異なるテキストのパッチを生成する", () => {
      const result = computeDiff("old", "new");
      expect(result).toContain("@@ ");
      expect(result).toContain("-old");
      expect(result).toContain("+new");
    });

    it("部分的な変更のパッチを生成する", () => {
      const result = computeDiff("hello world", "hello universe");
      expect(result).toContain("@@ ");
      expect(result).toContain("-world");
      expect(result).toContain("+universe");
    });
  });

  describe("追加・削除操作", () => {
    it("テキスト追加のパッチを生成する", () => {
      const result = computeDiff("hello", "hello world");
      expect(result).toContain("+");
      expect(result).toContain("world");
    });

    it("テキスト削除のパッチを生成する", () => {
      const result = computeDiff("hello world", "hello");
      expect(result).toContain("-");
      expect(result).toContain("world");
    });

    it("空文字列からの追加を処理する", () => {
      const result = computeDiff("", "new text");
      expect(result).toContain("+new text");
    });

    it("空文字列への削除を処理する", () => {
      const result = computeDiff("old text", "");
      expect(result).toContain("-old text");
    });
  });

  describe("複数行の差分", () => {
    it("複数行テキストの差分を生成する", () => {
      const oldText = "line1\nline2\nline3";
      const newText = "line1\nmodified\nline3";
      const result = computeDiff(oldText, newText);
      expect(result).toContain("-line2");
      expect(result).toContain("+modified");
    });

    it("行の追加を検出する", () => {
      const oldText = "line1\nline2";
      const newText = "line1\nline2\nline3";
      const result = computeDiff(oldText, newText);
      expect(result).toContain("+");
      expect(result).toContain("line3");
    });
  });

  describe("日本語テキスト", () => {
    it("日本語テキストの差分を生成する", () => {
      const result = computeDiff("こんにちは", "こんばんは");
      expect(result).toContain("@@ ");
    });

    it("日本語と英語の混在テキストを処理する", () => {
      const result = computeDiff("Hello こんにちは", "Hello こんばんは");
      expect(result).toContain("@@ ");
    });
  });

  describe("パッチ形式の検証", () => {
    it("パッチはテキスト形式で返される", () => {
      const result = computeDiff("a", "b");
      expect(typeof result).toBe("string");
    });

    it("パッチは再適用可能な形式である", () => {
      // パッチ形式の基本構造を確認
      const result = computeDiff("old", "new");
      // @@ -位置,長さ +位置,長さ @@ の形式
      expect(result).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
    });
  });
});

describe("computeHtmlDiff", () => {
  describe("基本的なHTML差分生成", () => {
    it("同一テキストの場合はそのまま返す", () => {
      const result = computeHtmlDiff("hello", "hello");
      expect(result).toContain("hello");
      expect(result).not.toContain("<del>");
      expect(result).not.toContain("<ins>");
    });

    it("削除部分を<del>タグで囲む", () => {
      const result = computeHtmlDiff("hello world", "hello");
      expect(result).toContain("<del");
      expect(result).toContain("world");
    });

    it("追加部分を<ins>タグで囲む", () => {
      const result = computeHtmlDiff("hello", "hello world");
      expect(result).toContain("<ins");
      expect(result).toContain("world");
    });
  });

  describe("変更の視覚化", () => {
    it("変更箇所を削除と追加で表現する", () => {
      const result = computeHtmlDiff("old text", "new text");
      expect(result).toContain("<del");
      expect(result).toContain("<ins");
    });

    it("変更されていない部分はそのまま出力する", () => {
      const result = computeHtmlDiff("hello world", "hello universe");
      expect(result).toContain("hello");
      // helloは変更されていないのでタグなし
    });
  });

  describe("HTML出力形式", () => {
    it("HTML形式の文字列を返す", () => {
      const result = computeHtmlDiff("a", "b");
      expect(typeof result).toBe("string");
    });

    it("背景色スタイルを含む", () => {
      const result = computeHtmlDiff("old", "new");
      // diff-match-patchのprettyHtmlは背景色付きspanを生成
      expect(result).toContain("background:");
    });
  });

  describe("日本語テキスト", () => {
    it("日本語テキストの差分をHTML形式で生成する", () => {
      const result = computeHtmlDiff("おはよう", "こんにちは");
      expect(result).toContain("<del");
      expect(result).toContain("<ins");
    });
  });

  describe("複数行の差分", () => {
    it("複数行の差分をHTML形式で生成する", () => {
      const oldText = "line1\nline2";
      const newText = "line1\nmodified";
      const result = computeHtmlDiff(oldText, newText);
      expect(result).toContain("line1");
      expect(result).toContain("<del");
      expect(result).toContain("<ins");
    });
  });

  describe("エッジケース", () => {
    it("空文字列同士の比較", () => {
      const result = computeHtmlDiff("", "");
      expect(result).toBe("");
    });

    it("空文字列からの追加", () => {
      const result = computeHtmlDiff("", "new");
      expect(result).toContain("<ins");
      expect(result).toContain("new");
    });

    it("空文字列への削除", () => {
      const result = computeHtmlDiff("old", "");
      expect(result).toContain("<del");
      expect(result).toContain("old");
    });
  });
});
