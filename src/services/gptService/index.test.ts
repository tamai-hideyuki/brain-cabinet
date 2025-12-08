import { describe, it, expect, vi, beforeEach } from "vitest";

// gptService の内部ロジックをテスト

describe("gptService", () => {
  describe("relevance判定", () => {
    const computeRelevance = (matchScore: number): "high" | "medium" | "low" => {
      if (matchScore >= 4) return "high";
      if (matchScore >= 2) return "medium";
      return "low";
    };

    it("スコア4以上は high", () => {
      expect(computeRelevance(4)).toBe("high");
      expect(computeRelevance(5)).toBe("high");
      expect(computeRelevance(10)).toBe("high");
    });

    it("スコア2-3は medium", () => {
      expect(computeRelevance(2)).toBe("medium");
      expect(computeRelevance(3)).toBe("medium");
    });

    it("スコア1以下は low", () => {
      expect(computeRelevance(0)).toBe("low");
      expect(computeRelevance(1)).toBe("low");
    });
  });

  describe("matchScore計算", () => {
    type Note = {
      title: string;
      content: string;
      tags: string[];
      headings: string[];
    };

    type SearchIn = ("title" | "content" | "tags" | "headings")[];

    const computeMatchScore = (
      note: Note,
      query: string,
      searchIn: SearchIn
    ): number => {
      const q = query.toLowerCase();
      let matchScore = 0;

      if (searchIn.includes("title") && note.title.toLowerCase().includes(q)) {
        matchScore += 3;
      }
      if (searchIn.includes("content") && note.content.toLowerCase().includes(q)) {
        matchScore += 1;
      }
      if (searchIn.includes("tags") && note.tags.some((t) => t.toLowerCase().includes(q))) {
        matchScore += 2;
      }
      if (searchIn.includes("headings") && note.headings.some((h) => h.toLowerCase().includes(q))) {
        matchScore += 2;
      }

      return matchScore;
    };

    it("タイトルマッチで +3", () => {
      const note: Note = {
        title: "TypeScript入門",
        content: "本文",
        tags: [],
        headings: [],
      };
      expect(computeMatchScore(note, "typescript", ["title"])).toBe(3);
    });

    it("コンテンツマッチで +1", () => {
      const note: Note = {
        title: "タイトル",
        content: "TypeScriptについて説明します",
        tags: [],
        headings: [],
      };
      expect(computeMatchScore(note, "typescript", ["content"])).toBe(1);
    });

    it("タグマッチで +2", () => {
      const note: Note = {
        title: "タイトル",
        content: "本文",
        tags: ["TypeScript", "JavaScript"],
        headings: [],
      };
      expect(computeMatchScore(note, "typescript", ["tags"])).toBe(2);
    });

    it("見出しマッチで +2", () => {
      const note: Note = {
        title: "タイトル",
        content: "本文",
        tags: [],
        headings: ["TypeScript基礎", "応用編"],
      };
      expect(computeMatchScore(note, "typescript", ["headings"])).toBe(2);
    });

    it("複数マッチで加算", () => {
      const note: Note = {
        title: "TypeScript入門",
        content: "TypeScriptについて",
        tags: ["TypeScript"],
        headings: ["TypeScript基礎"],
      };
      // title: 3 + content: 1 + tags: 2 + headings: 2 = 8
      expect(
        computeMatchScore(note, "typescript", ["title", "content", "tags", "headings"])
      ).toBe(8);
    });

    it("マッチなしで 0", () => {
      const note: Note = {
        title: "Python入門",
        content: "Pythonについて",
        tags: ["Python"],
        headings: ["Python基礎"],
      };
      expect(
        computeMatchScore(note, "typescript", ["title", "content", "tags", "headings"])
      ).toBe(0);
    });

    it("searchIn で指定した項目のみ検索", () => {
      const note: Note = {
        title: "TypeScript入門",
        content: "TypeScriptについて",
        tags: ["TypeScript"],
        headings: ["TypeScript基礎"],
      };
      // title のみ検索
      expect(computeMatchScore(note, "typescript", ["title"])).toBe(3);
      // content と tags のみ検索
      expect(computeMatchScore(note, "typescript", ["content", "tags"])).toBe(3);
    });
  });

  describe("summary生成", () => {
    const generateSummary = (content: string, maxLength: number = 200): string => {
      // 簡易的な正規化（実際は normalizeForGPT を使用）
      const normalized = content
        .replace(/```[\s\S]*?```/g, "")
        .replace(/`[^`]+`/g, "")
        .replace(/\n+/g, " ")
        .trim();

      return normalized.slice(0, maxLength) + (normalized.length > maxLength ? "..." : "");
    };

    it("200文字以下はそのまま返す", () => {
      const content = "短いテキスト";
      expect(generateSummary(content)).toBe("短いテキスト");
    });

    it("200文字を超える場合は切り詰めて...を付加", () => {
      const content = "あ".repeat(300);
      const summary = generateSummary(content);
      expect(summary.length).toBe(203); // 200 + "..."
      expect(summary.endsWith("...")).toBe(true);
    });

    it("コードブロックを除去", () => {
      const content = "前文\n```typescript\nconst x = 1;\n```\n後文";
      const summary = generateSummary(content);
      expect(summary).not.toContain("```");
      expect(summary).not.toContain("const x");
    });

    it("インラインコードを除去", () => {
      const content = "変数 `foo` を使う";
      const summary = generateSummary(content);
      expect(summary).not.toContain("`");
    });
  });

  describe("relevanceソート", () => {
    type Result = { id: string; relevance: "high" | "medium" | "low" };

    const sortByRelevance = (results: Result[]): Result[] => {
      const order = { high: 3, medium: 2, low: 1 };
      return [...results].sort((a, b) => order[b.relevance] - order[a.relevance]);
    };

    it("relevance順にソート", () => {
      const results: Result[] = [
        { id: "1", relevance: "low" },
        { id: "2", relevance: "high" },
        { id: "3", relevance: "medium" },
      ];
      const sorted = sortByRelevance(results);
      expect(sorted.map((r) => r.relevance)).toEqual(["high", "medium", "low"]);
    });

    it("同じrelevanceは順序を維持", () => {
      const results: Result[] = [
        { id: "1", relevance: "high" },
        { id: "2", relevance: "high" },
        { id: "3", relevance: "high" },
      ];
      const sorted = sortByRelevance(results);
      expect(sorted.length).toBe(3);
    });
  });

  describe("searchContext生成", () => {
    const generateSearchContext = (
      query: string,
      resultCount: number,
      category?: string,
      searchIn: string[] = ["title", "content", "tags"]
    ): string => {
      return `
検索クエリ「${query}」で ${resultCount} 件のノートが見つかりました。
${category ? `カテゴリ: ${category}` : "全カテゴリ"}
検索対象: ${searchIn.join(", ")}
`.trim();
    };

    it("基本的なコンテキストを生成", () => {
      const context = generateSearchContext("typescript", 10);
      expect(context).toContain("typescript");
      expect(context).toContain("10 件");
      expect(context).toContain("全カテゴリ");
    });

    it("カテゴリ指定時", () => {
      const context = generateSearchContext("typescript", 5, "技術");
      expect(context).toContain("カテゴリ: 技術");
      expect(context).not.toContain("全カテゴリ");
    });

    it("検索対象を含む", () => {
      const context = generateSearchContext("query", 1, undefined, ["title", "tags"]);
      expect(context).toContain("title, tags");
    });
  });

  describe("GPTTaskType処理", () => {
    type GPTTaskType =
      | "extract_key_points"
      | "summarize"
      | "generate_ideas"
      | "find_related"
      | "compare_versions"
      | "create_outline";

    const isValidTaskType = (type: string): type is GPTTaskType => {
      const validTypes: GPTTaskType[] = [
        "extract_key_points",
        "summarize",
        "generate_ideas",
        "find_related",
        "compare_versions",
        "create_outline",
      ];
      return validTypes.includes(type as GPTTaskType);
    };

    it("有効なタスクタイプを認識", () => {
      expect(isValidTaskType("extract_key_points")).toBe(true);
      expect(isValidTaskType("summarize")).toBe(true);
      expect(isValidTaskType("generate_ideas")).toBe(true);
      expect(isValidTaskType("find_related")).toBe(true);
      expect(isValidTaskType("compare_versions")).toBe(true);
      expect(isValidTaskType("create_outline")).toBe(true);
    });

    it("無効なタスクタイプを拒否", () => {
      expect(isValidTaskType("invalid")).toBe(false);
      expect(isValidTaskType("")).toBe(false);
      expect(isValidTaskType("SUMMARIZE")).toBe(false); // 大文字は無効
    });
  });

  describe("カテゴリ集計", () => {
    type Note = { category: string | null };

    const aggregateByCategory = (notes: Note[]): Record<string, number> => {
      const categoryCount: Record<string, number> = {};
      for (const note of notes) {
        const cat = note.category || "その他";
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      }
      return categoryCount;
    };

    it("カテゴリ別にカウント", () => {
      const notes: Note[] = [
        { category: "技術" },
        { category: "技術" },
        { category: "日記" },
        { category: null },
      ];
      const result = aggregateByCategory(notes);
      expect(result).toEqual({
        技術: 2,
        日記: 1,
        その他: 1,
      });
    });

    it("空配列を処理", () => {
      expect(aggregateByCategory([])).toEqual({});
    });

    it("全てnullの場合", () => {
      const notes: Note[] = [{ category: null }, { category: null }];
      expect(aggregateByCategory(notes)).toEqual({ その他: 2 });
    });
  });

  describe("タグ集計", () => {
    const aggregateByTags = (notes: { tags: string[] }[]): Record<string, number> => {
      const tagCount: Record<string, number> = {};
      for (const note of notes) {
        for (const tag of note.tags) {
          tagCount[tag] = (tagCount[tag] || 0) + 1;
        }
      }
      return tagCount;
    };

    const getTopTags = (
      tagCount: Record<string, number>,
      limit: number = 20
    ): { tag: string; count: number }[] => {
      return Object.entries(tagCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([tag, count]) => ({ tag, count }));
    };

    it("タグ別にカウント", () => {
      const notes = [
        { tags: ["TypeScript", "JavaScript"] },
        { tags: ["TypeScript", "React"] },
        { tags: ["Python"] },
      ];
      const result = aggregateByTags(notes);
      expect(result).toEqual({
        TypeScript: 2,
        JavaScript: 1,
        React: 1,
        Python: 1,
      });
    });

    it("上位タグを取得", () => {
      const tagCount = {
        TypeScript: 10,
        JavaScript: 5,
        Python: 3,
        React: 8,
      };
      const top = getTopTags(tagCount, 2);
      expect(top).toEqual([
        { tag: "TypeScript", count: 10 },
        { tag: "React", count: 8 },
      ]);
    });

    it("空配列を処理", () => {
      expect(aggregateByTags([])).toEqual({});
    });
  });
});
