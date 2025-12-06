import { describe, it, expect } from "vitest";
import {
  normalizeMarkdown,
  formatForGPT,
  extractOutline,
  extractBulletPoints,
} from "./index";

describe("normalizeMarkdown", () => {
  describe("見出しの正規化", () => {
    it("#の後にスペースがない場合にスペースを追加する", () => {
      expect(normalizeMarkdown("#タイトル")).toBe("# タイトル");
      expect(normalizeMarkdown("##セクション")).toBe("## セクション");
    });

    it("正しい見出しはそのまま維持する", () => {
      expect(normalizeMarkdown("# タイトル")).toBe("# タイトル");
    });

    it("複数レベルの見出しを正規化する", () => {
      const input = "#H1\n##H2\n###H3";
      const expected = "# H1\n## H2\n### H3";
      expect(normalizeMarkdown(input)).toBe(expected);
    });
  });

  describe("箇条書きの正規化", () => {
    it("* を - に統一する", () => {
      expect(normalizeMarkdown("* 項目")).toBe("- 項目");
    });

    it("+ を - に統一する", () => {
      expect(normalizeMarkdown("+ 項目")).toBe("- 項目");
    });

    it("- はそのまま維持する", () => {
      expect(normalizeMarkdown("- 項目")).toBe("- 項目");
    });

    it("インデント付き箇条書きを正規化する（先頭インデントはtrimされる）", () => {
      // trimLinesにより先頭のインデントは削除される
      // ネストリストは親リスト内で使用する想定
      expect(normalizeMarkdown("- 親\n  * ネスト項目")).toBe("- 親\n  - ネスト項目");
    });

    it("複数の箇条書きを一括で正規化する", () => {
      const input = "* 項目1\n+ 項目2\n- 項目3";
      const expected = "- 項目1\n- 項目2\n- 項目3";
      expect(normalizeMarkdown(input)).toBe(expected);
    });
  });

  describe("コードブロックの修復", () => {
    it("閉じ忘れたコードブロックを修復する", () => {
      const input = "```typescript\nconst x = 1;";
      const result = normalizeMarkdown(input);
      expect(result).toContain("```typescript");
      expect(result.match(/```/g)?.length).toBe(2);
    });

    it("正しく閉じられたコードブロックはそのまま維持する", () => {
      const input = "```\ncode\n```";
      expect(normalizeMarkdown(input)).toBe("```\ncode\n```");
    });

    it("複数のコードブロックを処理する", () => {
      const input = "```js\na\n```\n\n```py\nb\n```";
      const result = normalizeMarkdown(input);
      expect(result.match(/```/g)?.length).toBe(4);
    });
  });

  describe("リンクの整形", () => {
    it("リンク内の余分な空白を削除する", () => {
      expect(normalizeMarkdown("[text](  url  )")).toBe("[text](url)");
    });

    it("正常なリンクはそのまま維持する", () => {
      expect(normalizeMarkdown("[text](url)")).toBe("[text](url)");
    });
  });

  describe("空行の整理", () => {
    it("3行以上の連続空行を2行に圧縮する", () => {
      const input = "段落1\n\n\n\n段落2";
      const expected = "段落1\n\n段落2";
      expect(normalizeMarkdown(input)).toBe(expected);
    });

    it("2行の空行は維持する", () => {
      const input = "段落1\n\n段落2";
      expect(normalizeMarkdown(input)).toBe(input);
    });
  });

  describe("行の整形", () => {
    it("行末の空白を削除する", () => {
      expect(normalizeMarkdown("テキスト   ")).toBe("テキスト");
    });

    it("先頭と末尾の空行を削除する", () => {
      expect(normalizeMarkdown("\n\nテキスト\n\n")).toBe("テキスト");
    });
  });

  describe("複合ケース", () => {
    it("実際のMarkdownドキュメントを正規化する", () => {
      const input = `#タイトル

* 項目1
+ 項目2


\`\`\`js
code
\`\`\`

[link](  url  )`;

      const result = normalizeMarkdown(input);
      expect(result).toContain("# タイトル");
      expect(result).toContain("- 項目1");
      expect(result).toContain("- 項目2");
      expect(result).toContain("[link](url)");
    });
  });
});

describe("formatForGPT", () => {
  describe("コードブロックの簡略化", () => {
    it("短いコードブロックはそのまま維持する", () => {
      const input = "```js\nconst x = 1;\n```";
      expect(formatForGPT(input)).toBe(input);
    });

    it("長いコードブロックを省略する", () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i}`);
      const input = "```js\n" + lines.join("\n") + "\n```";
      const result = formatForGPT(input);
      expect(result).toContain("... (");
      expect(result).toContain("lines)");
    });

    it("15行以下のコードブロックは省略しない", () => {
      const lines = Array.from({ length: 10 }, (_, i) => `line${i}`);
      const input = "```js\n" + lines.join("\n") + "\n```";
      const result = formatForGPT(input);
      expect(result).not.toContain("...");
    });
  });

  describe("基本的な正規化も適用される", () => {
    it("見出しを正規化する", () => {
      expect(formatForGPT("#タイトル")).toBe("# タイトル");
    });

    it("箇条書きを正規化する", () => {
      expect(formatForGPT("* 項目")).toBe("- 項目");
    });
  });
});

describe("extractOutline", () => {
  describe("見出し抽出", () => {
    it("h1見出しを抽出する", () => {
      const result = extractOutline("# タイトル");
      expect(result).toEqual(["- タイトル"]);
    });

    it("複数レベルの見出しをインデント付きで抽出する", () => {
      const input = "# H1\n## H2\n### H3";
      const result = extractOutline(input);
      expect(result).toEqual([
        "- H1",
        "  - H2",
        "    - H3",
      ]);
    });

    it("見出しがない場合は空配列を返す", () => {
      const result = extractOutline("本文のみ");
      expect(result).toEqual([]);
    });

    it("見出し以外のテキストを無視する", () => {
      const input = "# タイトル\n本文\n## セクション";
      const result = extractOutline(input);
      expect(result).toEqual([
        "- タイトル",
        "  - セクション",
      ]);
    });
  });

  describe("インデント計算", () => {
    it("h1は0インデント", () => {
      const result = extractOutline("# H1");
      expect(result[0]).toBe("- H1");
    });

    it("h2は2スペースインデント", () => {
      const result = extractOutline("## H2");
      expect(result[0]).toBe("  - H2");
    });

    it("h6は10スペースインデント", () => {
      const result = extractOutline("###### H6");
      expect(result[0]).toBe("          - H6");
    });
  });
});

describe("extractBulletPoints", () => {
  describe("箇条書き抽出", () => {
    it("- 記号の箇条書きを抽出する", () => {
      const result = extractBulletPoints("- 項目1\n- 項目2");
      expect(result).toEqual(["項目1", "項目2"]);
    });

    it("* 記号の箇条書きを抽出する", () => {
      const result = extractBulletPoints("* 項目");
      expect(result).toEqual(["項目"]);
    });

    it("+ 記号の箇条書きを抽出する", () => {
      const result = extractBulletPoints("+ 項目");
      expect(result).toEqual(["項目"]);
    });

    it("インデント付き箇条書きを抽出する", () => {
      const result = extractBulletPoints("  - ネスト項目");
      expect(result).toEqual(["ネスト項目"]);
    });

    it("箇条書きがない場合は空配列を返す", () => {
      const result = extractBulletPoints("本文のみ");
      expect(result).toEqual([]);
    });

    it("複数マーカー種類を混在して抽出する", () => {
      const input = "- A\n* B\n+ C";
      const result = extractBulletPoints(input);
      expect(result).toEqual(["A", "B", "C"]);
    });
  });

  describe("箇条書き以外を無視", () => {
    it("見出しを無視する", () => {
      const input = "# タイトル\n- 項目";
      const result = extractBulletPoints(input);
      expect(result).toEqual(["項目"]);
    });

    it("本文を無視する", () => {
      const input = "本文\n- 項目\nまた本文";
      const result = extractBulletPoints(input);
      expect(result).toEqual(["項目"]);
    });
  });
});
