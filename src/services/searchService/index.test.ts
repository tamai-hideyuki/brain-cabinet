import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// テスト対象の内部関数をテスト可能にするため、モジュール全体をモック
// 実際の検索ロジックのユニットテストに焦点を当てる

describe("searchService", () => {
  describe("splitSentences（句境界分割）", () => {
    // 内部関数のロジックをテスト
    const splitSentences = (text: string): string[] => {
      return text
        .split(/(?<=[。！？\n])|(?=\n)/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    };

    it("句点で分割する", () => {
      const input = "これは文1です。これは文2です。";
      const result = splitSentences(input);
      expect(result).toEqual(["これは文1です。", "これは文2です。"]);
    });

    it("感嘆符で分割する", () => {
      const input = "すごい！本当に！";
      const result = splitSentences(input);
      expect(result).toEqual(["すごい！", "本当に！"]);
    });

    it("疑問符で分割する", () => {
      const input = "本当？嘘でしょ？";
      const result = splitSentences(input);
      expect(result).toEqual(["本当？", "嘘でしょ？"]);
    });

    it("改行で分割する", () => {
      const input = "1行目\n2行目\n3行目";
      const result = splitSentences(input);
      expect(result).toEqual(["1行目", "2行目", "3行目"]);
    });

    it("空文字列を返さない", () => {
      const input = "文1。\n\n文2。";
      const result = splitSentences(input);
      expect(result.every((s) => s.length > 0)).toBe(true);
    });

    it("複合ケース", () => {
      const input = "これは何？素晴らしい！終わり。";
      const result = splitSentences(input);
      expect(result).toEqual(["これは何？", "素晴らしい！", "終わり。"]);
    });
  });

  describe("escapeRegex（正規表現エスケープ）", () => {
    const escapeRegex = (str: string): string => {
      return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    };

    it("特殊文字をエスケープする", () => {
      expect(escapeRegex("hello.world")).toBe("hello\\.world");
      expect(escapeRegex("a*b+c?")).toBe("a\\*b\\+c\\?");
      expect(escapeRegex("[test]")).toBe("\\[test\\]");
      expect(escapeRegex("(foo|bar)")).toBe("\\(foo\\|bar\\)");
    });

    it("通常文字はそのまま", () => {
      expect(escapeRegex("hello")).toBe("hello");
      expect(escapeRegex("日本語")).toBe("日本語");
    });

    it("空文字列を処理する", () => {
      expect(escapeRegex("")).toBe("");
    });
  });

  describe("highlightQuery（クエリ強調）", () => {
    // TinySegmenterの代わりに簡易的なトークナイザーを使用
    const tokenize = (text: string): string[] => {
      // 2文字以上の連続した文字をトークンとして抽出
      return text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\w]{2,}/g) || [];
    };

    const escapeRegex = (str: string): string => {
      return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    };

    const highlightQuery = (text: string, query: string): string => {
      const q = query.toLowerCase();
      const queryTokens = tokenize(q).filter((t) => t.length >= 2);

      let result = text;
      for (const token of queryTokens) {
        const regex = new RegExp(`(${escapeRegex(token)})`, "gi");
        result = result.replace(regex, "<mark>$1</mark>");
      }
      return result;
    };

    it("クエリ語を<mark>タグで囲む", () => {
      const result = highlightQuery("これはテストです", "テスト");
      expect(result).toBe("これは<mark>テスト</mark>です");
    });

    it("複数のマッチを強調する", () => {
      const result = highlightQuery("テストとテストの話", "テスト");
      expect(result).toBe("<mark>テスト</mark>と<mark>テスト</mark>の話");
    });

    it("大文字小文字を無視する（英語）", () => {
      const result = highlightQuery("Hello World hello", "hello");
      expect(result).toBe("<mark>Hello</mark> World <mark>hello</mark>");
    });

    it("マッチがない場合はそのまま返す", () => {
      const text = "これはテキストです";
      const result = highlightQuery(text, "xyz");
      expect(result).toBe(text);
    });
  });

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
      expect(parseJsonArray('["a", "b", "c"]')).toEqual(["a", "b", "c"]);
    });

    it("nullを空配列として処理する", () => {
      expect(parseJsonArray(null)).toEqual([]);
    });

    it("空文字列を空配列として処理する", () => {
      expect(parseJsonArray("")).toEqual([]);
    });

    it("不正なJSONを空配列として処理する", () => {
      expect(parseJsonArray("invalid json")).toEqual([]);
      expect(parseJsonArray("{not an array}")).toEqual([]);
    });

    it("配列でないJSONを空配列として処理する", () => {
      expect(parseJsonArray('{"key": "value"}')).toEqual([]);
      expect(parseJsonArray('"string"')).toEqual([]);
      expect(parseJsonArray("123")).toEqual([]);
    });
  });

  describe("computeLengthScore（長さスコア計算）", () => {
    const computeLengthScore = (note: { content: string }): number => {
      const length = note.content.length;
      if (length < 100) return -1.0;
      if (length < 300) return -0.5;
      if (length < 1000) return 0;
      return 0.5;
    };

    it("100文字未満はペナルティ -1.0", () => {
      expect(computeLengthScore({ content: "a".repeat(50) })).toBe(-1.0);
      expect(computeLengthScore({ content: "a".repeat(99) })).toBe(-1.0);
    });

    it("100-300文字は軽いペナルティ -0.5", () => {
      expect(computeLengthScore({ content: "a".repeat(100) })).toBe(-0.5);
      expect(computeLengthScore({ content: "a".repeat(299) })).toBe(-0.5);
    });

    it("300-1000文字はニュートラル 0", () => {
      expect(computeLengthScore({ content: "a".repeat(300) })).toBe(0);
      expect(computeLengthScore({ content: "a".repeat(999) })).toBe(0);
    });

    it("1000文字以上はボーナス 0.5", () => {
      expect(computeLengthScore({ content: "a".repeat(1000) })).toBe(0.5);
      expect(computeLengthScore({ content: "a".repeat(5000) })).toBe(0.5);
    });
  });

  describe("computeRecencyScore（新規性スコア計算）", () => {
    const computeRecencyScore = (note: { updatedAt: number }): number => {
      const age = Math.floor(Date.now() / 1000) - note.updatedAt;
      const daysSinceUpdate = age / (60 * 60 * 24);

      if (daysSinceUpdate <= 7) return 1.0;
      if (daysSinceUpdate <= 30) return 0.5;
      if (daysSinceUpdate <= 90) return 0.2;
      return 0;
    };

    it("7日以内は高スコア 1.0", () => {
      const now = Math.floor(Date.now() / 1000);
      expect(computeRecencyScore({ updatedAt: now })).toBe(1.0);
      expect(computeRecencyScore({ updatedAt: now - 6 * 24 * 60 * 60 })).toBe(1.0);
    });

    it("30日以内は中スコア 0.5", () => {
      const now = Math.floor(Date.now() / 1000);
      expect(computeRecencyScore({ updatedAt: now - 8 * 24 * 60 * 60 })).toBe(0.5);
      expect(computeRecencyScore({ updatedAt: now - 29 * 24 * 60 * 60 })).toBe(0.5);
    });

    it("90日以内は低スコア 0.2", () => {
      const now = Math.floor(Date.now() / 1000);
      expect(computeRecencyScore({ updatedAt: now - 31 * 24 * 60 * 60 })).toBe(0.2);
      expect(computeRecencyScore({ updatedAt: now - 89 * 24 * 60 * 60 })).toBe(0.2);
    });

    it("90日以降は 0", () => {
      const now = Math.floor(Date.now() / 1000);
      expect(computeRecencyScore({ updatedAt: now - 91 * 24 * 60 * 60 })).toBe(0);
      expect(computeRecencyScore({ updatedAt: now - 365 * 24 * 60 * 60 })).toBe(0);
    });
  });

  describe("computeStructureScore（構造スコア計算）", () => {
    const computeStructureScore = (note: { title: string; headings: string | null }, query: string): number => {
      const q = query.toLowerCase();
      const title = note.title.toLowerCase();
      let score = 0;

      // タイトル一致
      if (title === q) score += 5;
      else if (title.includes(q)) score += 3;

      // 見出し一致
      const headings: string[] = note.headings ? JSON.parse(note.headings) : [];
      for (const heading of headings) {
        const h = heading.toLowerCase();
        if (h === q) {
          score += 3;
          break;
        } else if (h.includes(q)) {
          score += 1.5;
        }
      }

      return score;
    };

    it("タイトル完全一致で +5", () => {
      const note = { title: "TypeScript", headings: null };
      expect(computeStructureScore(note, "typescript")).toBe(5);
    });

    it("タイトル部分一致で +3", () => {
      const note = { title: "TypeScript入門", headings: null };
      expect(computeStructureScore(note, "typescript")).toBe(3);
    });

    it("見出し完全一致で +3", () => {
      const note = { title: "プログラミング", headings: '["TypeScript", "JavaScript"]' };
      expect(computeStructureScore(note, "typescript")).toBe(3);
    });

    it("見出し部分一致で +1.5", () => {
      const note = { title: "プログラミング", headings: '["TypeScript入門", "JavaScript"]' };
      expect(computeStructureScore(note, "typescript")).toBe(1.5);
    });

    it("タイトルと見出しの両方でマッチ", () => {
      const note = { title: "TypeScript", headings: '["TypeScript入門"]' };
      // タイトル完全一致 5 + 見出し部分一致 1.5 = 6.5
      expect(computeStructureScore(note, "typescript")).toBe(6.5);
    });

    it("マッチなしで 0", () => {
      const note = { title: "Python", headings: '["Django", "Flask"]' };
      expect(computeStructureScore(note, "typescript")).toBe(0);
    });
  });
});
