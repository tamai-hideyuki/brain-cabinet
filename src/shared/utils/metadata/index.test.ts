import { describe, it, expect } from "vitest";
import {
  extractHeadings,
  extractTags,
  classifyCategory,
  extractMetadata,
} from "./index";

describe("extractHeadings", () => {
  describe("基本的な見出し抽出", () => {
    it("h1見出しを抽出する", () => {
      const result = extractHeadings("# タイトル");
      expect(result).toEqual(["タイトル"]);
    });

    it("h2〜h6見出しを抽出する", () => {
      const content = `## セクション1
### サブセクション
#### 詳細
##### 補足
###### 注釈`;
      const result = extractHeadings(content);
      expect(result).toEqual(["セクション1", "サブセクション", "詳細", "補足", "注釈"]);
    });

    it("複数の見出しを順序通りに抽出する", () => {
      const content = `# 第1章
本文
## 1.1 概要
詳細
## 1.2 詳細
さらに詳細`;
      const result = extractHeadings(content);
      expect(result).toEqual(["第1章", "1.1 概要", "1.2 詳細"]);
    });
  });

  describe("見出しなしの場合", () => {
    it("見出しがない場合は空配列を返す", () => {
      const result = extractHeadings("本文のみのテキスト");
      expect(result).toEqual([]);
    });

    it("空文字列の場合は空配列を返す", () => {
      const result = extractHeadings("");
      expect(result).toEqual([]);
    });
  });

  describe("エッジケース", () => {
    it("#の後にスペースがない場合は見出しとして認識しない", () => {
      const result = extractHeadings("#タグ風テキスト");
      expect(result).toEqual([]);
    });

    it("見出しの前後の空白をトリムする", () => {
      const result = extractHeadings("#   スペース付き   ");
      expect(result).toEqual(["スペース付き"]);
    });

    it("コードブロック内の#は見出しとして認識する（現在の実装）", () => {
      // 現在の実装ではコードブロック内も処理される
      const content = "```\n# コード内\n```";
      const result = extractHeadings(content);
      expect(result).toEqual(["コード内"]);
    });
  });
});

describe("extractTags", () => {
  describe("英単語の抽出", () => {
    it("3文字以上の英単語をタグとして抽出する", () => {
      const result = extractTags("TypeScript React Node");
      expect(result).toContain("typescript");
      expect(result).toContain("react");
      expect(result).toContain("node");
    });

    it("2文字以下の英単語は除外する", () => {
      const result = extractTags("I am a developer");
      expect(result).not.toContain("i");
      expect(result).not.toContain("am");
      expect(result).not.toContain("a");
    });

    it("ストップワードを除外する", () => {
      const result = extractTags("the function and variable");
      expect(result).not.toContain("the");
      expect(result).not.toContain("and");
      expect(result).not.toContain("function");
    });
  });

  describe("カタカナ語の抽出", () => {
    it("2文字以上のカタカナ語を抽出する", () => {
      const result = extractTags("プログラミングとコーディング");
      expect(result).toContain("プログラミング");
      expect(result).toContain("コーディング");
    });

    it("1文字のカタカナは除外する", () => {
      const result = extractTags("ア イ ウ");
      expect(result).toEqual([]);
    });
  });

  describe("日本語の抽出（TinySegmenter）", () => {
    it("日本語の重要語を抽出する", () => {
      const result = extractTags("開発環境の構築について説明します");
      // TinySegmenterの分かち書き結果に依存
      expect(result.length).toBeGreaterThan(0);
    });

    it("日本語ストップワードを除外する", () => {
      const result = extractTags("これはそれについてのものです");
      expect(result).not.toContain("これ");
      expect(result).not.toContain("それ");
      expect(result).not.toContain("もの");
    });
  });

  describe("技術用語のボーナス", () => {
    it("技術用語は優先的に上位に来る", () => {
      const content = "word word word word word typescript";
      const result = extractTags(content);
      // typescriptは出現回数1だが技術用語ボーナスで上位に
      expect(result.indexOf("typescript")).toBeLessThan(result.indexOf("word"));
    });
  });

  describe("maxTags制限", () => {
    it("デフォルトで最大10個のタグを返す", () => {
      const words = Array.from({ length: 20 }, (_, i) => `word${i}`).join(" ");
      const result = extractTags(words);
      expect(result.length).toBeLessThanOrEqual(10);
    });

    it("maxTagsで返すタグ数を制限できる", () => {
      const words = Array.from({ length: 20 }, (_, i) => `word${i}`).join(" ");
      const result = extractTags(words, 5);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe("出現回数によるスコアリング", () => {
    it("出現回数が多い単語が上位に来る", () => {
      const content = "react react react vue";
      const result = extractTags(content);
      expect(result.indexOf("react")).toBeLessThan(result.indexOf("vue"));
    });
  });
});

describe("classifyCategory", () => {
  describe("技術カテゴリ", () => {
    it("TypeScriptを含む内容は技術に分類する", () => {
      const result = classifyCategory("TypeScriptの基礎", "プログラミング入門");
      expect(result).toBe("技術");
    });

    it("Reactを含む内容は技術に分類する", () => {
      const result = classifyCategory("Reactコンポーネント", "フロントエンド開発");
      expect(result).toBe("技術");
    });

    it("APIを含む内容は技術に分類する", () => {
      const result = classifyCategory("REST APIの設計", "API設計");
      expect(result).toBe("技術");
    });
  });

  describe("心理カテゴリ", () => {
    it("心理学を含む内容は心理に分類する", () => {
      const result = classifyCategory("心理学の基礎", "入門");
      expect(result).toBe("心理");
    });

    it("認知行動療法を含む内容は心理に分類する", () => {
      const result = classifyCategory("認知行動療法について", "CBT入門");
      expect(result).toBe("心理");
    });
  });

  describe("健康カテゴリ", () => {
    it("運動・食事を含む内容は健康に分類する", () => {
      const result = classifyCategory("運動と食事のバランス", "健康管理");
      expect(result).toBe("健康");
    });

    it("睡眠を含む内容は健康に分類する", () => {
      const result = classifyCategory("睡眠の質を上げる", "睡眠改善");
      expect(result).toBe("健康");
    });
  });

  describe("仕事カテゴリ", () => {
    it("キャリアを含む内容は仕事に分類する", () => {
      const result = classifyCategory("キャリアアップの方法", "転職");
      expect(result).toBe("仕事");
    });

    it("マネジメントを含む内容は仕事に分類する", () => {
      const result = classifyCategory("チームマネジメント", "リーダーシップ");
      expect(result).toBe("仕事");
    });
  });

  describe("人間関係カテゴリ", () => {
    it("コミュニケーションを含む内容は人間関係に分類する", () => {
      const result = classifyCategory("コミュニケーションスキル", "人間関係");
      expect(result).toBe("人間関係");
    });
  });

  describe("学習カテゴリ", () => {
    it("勉強・学習を含む内容は学習に分類する", () => {
      const result = classifyCategory("効率的な勉強法", "学習方法");
      expect(result).toBe("学習");
    });
  });

  describe("アイデアカテゴリ", () => {
    it("アイデアを含む内容はアイデアに分類する", () => {
      const result = classifyCategory("新しいアイデアの発想法", "アイデア");
      expect(result).toBe("アイデア");
    });
  });

  describe("走り書きカテゴリ", () => {
    it("TODOを含む内容は走り書きに分類する", () => {
      const result = classifyCategory("TODO: あとで確認", "メモ");
      expect(result).toBe("走り書き");
    });
  });

  describe("その他カテゴリ", () => {
    it("キーワードがない場合はその他に分類する", () => {
      const result = classifyCategory("あいうえお", "かきくけこ");
      expect(result).toBe("その他");
    });

    it("スコアが低い場合はその他に分類する", () => {
      const result = classifyCategory("xyz", "abc");
      expect(result).toBe("その他");
    });
  });

  describe("タイトルの重み付け", () => {
    it("タイトルにキーワードがある場合はスコアが2倍になる", () => {
      // タイトルに「TypeScript」があるのでより強く技術に分類される
      const result = classifyCategory("プログラミングの話", "TypeScript");
      expect(result).toBe("技術");
    });
  });
});

describe("extractMetadata", () => {
  describe("統合テスト", () => {
    it("見出し、タグ、カテゴリを一度に抽出する", () => {
      const content = `# TypeScript入門

## 概要

TypeScriptはJavaScriptのスーパーセットです。

## 特徴

- 静的型付け
- インターフェース`;

      const result = extractMetadata(content, "TypeScript入門");

      expect(result.headings).toContain("TypeScript入門");
      expect(result.headings).toContain("概要");
      expect(result.headings).toContain("特徴");
      expect(result.tags).toContain("typescript");
      expect(result.category).toBe("技術");
    });

    it("空のコンテンツでもエラーにならない", () => {
      const result = extractMetadata("", "タイトル");
      expect(result.headings).toEqual([]);
      expect(result.tags).toEqual([]);
      expect(result.category).toBe("その他");
    });
  });

  describe("実際のノートコンテンツ", () => {
    it("技術ドキュメントを正しく処理する", () => {
      const content = `# React Hooks入門

## useState

状態管理のためのフック。

\`\`\`typescript
const [count, setCount] = useState(0);
\`\`\`

## useEffect

副作用を処理するフック。`;

      const result = extractMetadata(content, "React Hooks入門");

      expect(result.headings).toEqual(["React Hooks入門", "useState", "useEffect"]);
      expect(result.tags).toContain("react");
      expect(result.category).toBe("技術");
    });

    it("日本語コンテンツを正しく処理する", () => {
      const content = `# 心理学メモ

認知行動療法について学んだことをまとめる。

## ポイント

- 思考パターンの認識
- 行動の変容`;

      const result = extractMetadata(content, "心理学メモ");

      expect(result.headings).toContain("心理学メモ");
      expect(result.category).toBe("心理");
    });
  });
});
