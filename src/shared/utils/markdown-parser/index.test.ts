import { describe, it, expect } from "vitest";
import { parseMarkdown, extractNoteData } from "./index";

describe("parseMarkdown", () => {
  describe("Frontmatterなしの場合", () => {
    it("本文のみを返す", () => {
      const input = "# タイトル\n\n本文です";
      const result = parseMarkdown(input);
      expect(result.frontmatter).toEqual({});
      expect(result.body).toBe("# タイトル\n\n本文です");
      expect(result.raw).toBe(input);
    });

    it("空文字列を処理する", () => {
      const result = parseMarkdown("");
      expect(result.frontmatter).toEqual({});
      expect(result.body).toBe("");
    });

    it("---で始まらない場合はFrontmatterなしと判断する", () => {
      const input = "通常のテキスト\n---\n区切り線";
      const result = parseMarkdown(input);
      expect(result.frontmatter).toEqual({});
      expect(result.body).toBe(input);
    });
  });

  describe("Frontmatterありの場合", () => {
    it("基本的なkey-value形式をパースする", () => {
      const input = `---
title: テストタイトル
category: 技術
---
本文`;
      const result = parseMarkdown(input);
      expect(result.frontmatter.title).toBe("テストタイトル");
      expect(result.frontmatter.category).toBe("技術");
      expect(result.body).toBe("本文");
    });

    it("配列形式をパースする", () => {
      const input = `---
tags:
  - JavaScript
  - TypeScript
---
本文`;
      const result = parseMarkdown(input);
      expect(result.frontmatter.tags).toEqual(["JavaScript", "TypeScript"]);
    });

    it("クォート付きの値を処理する", () => {
      const input = `---
title: "クォート付き"
---
本文`;
      const result = parseMarkdown(input);
      expect(result.frontmatter.title).toBe("クォート付き");
    });

    it("シングルクォート付きの値を処理する", () => {
      const input = `---
title: 'シングルクォート'
---
本文`;
      const result = parseMarkdown(input);
      expect(result.frontmatter.title).toBe("シングルクォート");
    });

    it("配列内のクォート付き値を処理する", () => {
      const input = `---
tags:
  - "tag1"
  - 'tag2'
---
本文`;
      const result = parseMarkdown(input);
      expect(result.frontmatter.tags).toEqual(["tag1", "tag2"]);
    });
  });

  describe("Frontmatterの境界", () => {
    it("閉じる---がない場合はFrontmatterなしと判断する", () => {
      const input = `---
title: テスト
本文`;
      const result = parseMarkdown(input);
      expect(result.frontmatter).toEqual({});
      expect(result.body).toBe(input.trim());
    });

    it("本文内の---は区切りとして扱わない", () => {
      const input = `---
title: テスト
---
本文

---

続き`;
      const result = parseMarkdown(input);
      expect(result.frontmatter.title).toBe("テスト");
      expect(result.body).toContain("---");
      expect(result.body).toContain("続き");
    });
  });

  describe("複合Frontmatter", () => {
    it("key-valueと配列を混在して処理する", () => {
      const input = `---
id: abc123
title: メモ
category: 技術
tags:
  - React
  - Next.js
updated_at: 2024-01-15
---
# 本文

内容`;
      const result = parseMarkdown(input);
      expect(result.frontmatter.id).toBe("abc123");
      expect(result.frontmatter.title).toBe("メモ");
      expect(result.frontmatter.category).toBe("技術");
      expect(result.frontmatter.tags).toEqual(["React", "Next.js"]);
      expect(result.frontmatter.updated_at).toBe("2024-01-15");
      expect(result.body).toContain("# 本文");
    });

    it("空のFrontmatterを処理する", () => {
      const input = `---
---
本文`;
      const result = parseMarkdown(input);
      expect(result.frontmatter).toEqual({});
      expect(result.body).toBe("本文");
    });
  });

  describe("raw プロパティ", () => {
    it("元の入力をそのまま保持する", () => {
      const input = `---
title: テスト
---
本文`;
      const result = parseMarkdown(input);
      expect(result.raw).toBe(input);
    });
  });

  describe("空白処理", () => {
    it("本文の前後の空白をトリムする", () => {
      const input = `---
title: テスト
---

  本文

`;
      const result = parseMarkdown(input);
      expect(result.body).toBe("本文");
    });

    it("Frontmatterなしでも本文をトリムする", () => {
      const input = "  本文  ";
      const result = parseMarkdown(input);
      expect(result.body).toBe("本文");
    });
  });
});

describe("extractNoteData", () => {
  describe("基本的な抽出", () => {
    it("全てのフィールドを抽出する", () => {
      const parsed = parseMarkdown(`---
id: note-123
title: サンプルノート
category: 技術
tags:
  - TypeScript
  - テスト
updated_at: 2024-01-15T10:00:00Z
---
# 本文

内容です`);
      const result = extractNoteData(parsed);
      expect(result.id).toBe("note-123");
      expect(result.title).toBe("サンプルノート");
      expect(result.category).toBe("技術");
      expect(result.tags).toEqual(["TypeScript", "テスト"]);
      expect(result.updatedAt).toBe("2024-01-15T10:00:00Z");
      expect(result.content).toContain("# 本文");
    });
  });

  describe("欠損フィールドの処理", () => {
    it("idがない場合はnullを返す", () => {
      const parsed = parseMarkdown(`---
title: テスト
---
本文`);
      const result = extractNoteData(parsed);
      expect(result.id).toBeNull();
    });

    it("titleがない場合はnullを返す", () => {
      const parsed = parseMarkdown(`---
id: abc
---
本文`);
      const result = extractNoteData(parsed);
      expect(result.title).toBeNull();
    });

    it("categoryがない場合はnullを返す", () => {
      const parsed = parseMarkdown(`---
title: テスト
---
本文`);
      const result = extractNoteData(parsed);
      expect(result.category).toBeNull();
    });

    it("tagsがない場合は空配列を返す", () => {
      const parsed = parseMarkdown(`---
title: テスト
---
本文`);
      const result = extractNoteData(parsed);
      expect(result.tags).toEqual([]);
    });

    it("updated_atがない場合はnullを返す", () => {
      const parsed = parseMarkdown(`---
title: テスト
---
本文`);
      const result = extractNoteData(parsed);
      expect(result.updatedAt).toBeNull();
    });
  });

  describe("Frontmatterなしの場合", () => {
    it("全てデフォルト値を返す", () => {
      const parsed = parseMarkdown("# タイトル\n本文");
      const result = extractNoteData(parsed);
      expect(result.id).toBeNull();
      expect(result.title).toBeNull();
      expect(result.category).toBeNull();
      expect(result.tags).toEqual([]);
      expect(result.updatedAt).toBeNull();
      expect(result.content).toBe("# タイトル\n本文");
    });
  });

  describe("content（本文）の抽出", () => {
    it("Frontmatter以外の部分を本文として抽出する", () => {
      const parsed = parseMarkdown(`---
title: テスト
---
# 見出し

段落1

段落2`);
      const result = extractNoteData(parsed);
      expect(result.content).toBe("# 見出し\n\n段落1\n\n段落2");
    });
  });
});

describe("parseMarkdown + extractNoteData 統合テスト", () => {
  it("実際のノートファイル形式を処理する", () => {
    const input = `---
id: 550e8400-e29b-41d4-a716-446655440000
title: TypeScript入門
category: 技術
tags:
  - TypeScript
  - プログラミング
  - 入門
updated_at: 2024-01-15T10:30:00Z
---
# TypeScript入門

## 概要

TypeScriptはJavaScriptのスーパーセットです。

## 特徴

- 静的型付け
- インターフェース
- ジェネリクス

\`\`\`typescript
const greeting: string = "Hello, TypeScript!";
\`\`\`
`;
    const parsed = parseMarkdown(input);
    const noteData = extractNoteData(parsed);

    expect(noteData.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(noteData.title).toBe("TypeScript入門");
    expect(noteData.category).toBe("技術");
    expect(noteData.tags).toEqual(["TypeScript", "プログラミング", "入門"]);
    expect(noteData.content).toContain("# TypeScript入門");
    expect(noteData.content).toContain("```typescript");
  });
});
