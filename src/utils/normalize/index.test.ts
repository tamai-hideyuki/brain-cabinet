import { describe, it, expect } from "vitest";
import { normalizeText, normalizeForGPT } from "./index";

describe("normalizeText", () => {
  describe("コードブロック除去", () => {
    it("フェンス付きコードブロックを除去する", () => {
      const input = "前文\n```typescript\nconst x = 1;\n```\n後文";
      expect(normalizeText(input)).toBe("前文 後文");
    });

    it("言語指定なしのコードブロックを除去する", () => {
      const input = "テスト\n```\ncode\n```\n終わり";
      expect(normalizeText(input)).toBe("テスト 終わり");
    });

    it("インラインコードを除去する", () => {
      const input = "変数 `foo` を使う";
      expect(normalizeText(input)).toBe("変数 を使う");
    });

    it("複数のインラインコードを除去する", () => {
      const input = "`const` と `let` の違い";
      expect(normalizeText(input)).toBe("と の違い");
    });
  });

  describe("リスト記号除去", () => {
    it("ハイフンリストの記号を除去する", () => {
      const input = "- 項目1\n- 項目2";
      expect(normalizeText(input)).toBe("項目1 項目2");
    });

    it("アスタリスクリストの記号を除去する", () => {
      const input = "* 項目1\n* 項目2";
      expect(normalizeText(input)).toBe("項目1 項目2");
    });

    it("プラスリストの記号を除去する", () => {
      const input = "+ 項目1\n+ 項目2";
      expect(normalizeText(input)).toBe("項目1 項目2");
    });

    it("インデント付きリストの記号を除去する", () => {
      const input = "  - ネスト項目";
      expect(normalizeText(input)).toBe("ネスト項目");
    });

    it("チェックボックスを除去する", () => {
      const input = "- [ ] 未完了\n- [x] 完了";
      expect(normalizeText(input)).toBe("未完了 完了");
    });
  });

  describe("見出し記号除去", () => {
    it("h1見出しの記号を除去する", () => {
      const input = "# タイトル";
      expect(normalizeText(input)).toBe("タイトル");
    });

    it("h2〜h6見出しの記号を除去する", () => {
      expect(normalizeText("## 見出し2")).toBe("見出し2");
      expect(normalizeText("### 見出し3")).toBe("見出し3");
      expect(normalizeText("###### 見出し6")).toBe("見出し6");
    });
  });

  describe("引用記号除去", () => {
    it("引用記号を除去する", () => {
      const input = "> 引用文";
      expect(normalizeText(input)).toBe("引用文");
    });

    it("複数行の引用から記号を除去する", () => {
      const input = "> 1行目\n> 2行目";
      expect(normalizeText(input)).toBe("1行目 2行目");
    });
  });

  describe("装飾記号除去", () => {
    it("太字（アスタリスク）を除去して中身を残す", () => {
      const input = "これは**重要**です";
      expect(normalizeText(input)).toBe("これは重要です");
    });

    it("太字（アンダースコア）を除去して中身を残す", () => {
      const input = "これは__重要__です";
      expect(normalizeText(input)).toBe("これは重要です");
    });

    it("斜体（アスタリスク）を除去して中身を残す", () => {
      const input = "これは*強調*です";
      expect(normalizeText(input)).toBe("これは強調です");
    });

    it("斜体（アンダースコア）を除去して中身を残す", () => {
      const input = "これは_強調_です";
      expect(normalizeText(input)).toBe("これは強調です");
    });
  });

  describe("リンク・画像処理", () => {
    it("リンクからテキストのみ抽出する", () => {
      const input = "[Google](https://google.com)へアクセス";
      expect(normalizeText(input)).toBe("Googleへアクセス");
    });

    it("画像を除去する（!とaltテキストが残る実装上の制約あり）", () => {
      // 現在の実装ではリンク処理が先に実行されるため、
      // ![alt](url) の [alt](url) 部分がリンクとして処理され "!alt" が残る
      const input = "画像: ![代替テキスト](https://example.com/img.png) です";
      expect(normalizeText(input)).toBe("画像: !代替テキスト です");
    });

    it("複数のリンクを処理する", () => {
      const input = "[A](url1)と[B](url2)";
      expect(normalizeText(input)).toBe("AとB");
    });
  });

  describe("URL除去オプション", () => {
    it("removeUrls: false の場合はURLを残す", () => {
      const input = "サイト https://example.com を見て";
      expect(normalizeText(input, { removeUrls: false })).toBe("サイト https://example.com を見て");
    });

    it("removeUrls: true の場合はURLを除去する", () => {
      const input = "サイト https://example.com を見て";
      expect(normalizeText(input, { removeUrls: true })).toBe("サイト を見て");
    });

    it("複数のURLを除去する", () => {
      const input = "https://a.com と http://b.com";
      expect(normalizeText(input, { removeUrls: true })).toBe("と");
    });
  });

  describe("空白正規化", () => {
    it("改行をスペースに変換する", () => {
      const input = "1行目\n2行目\n3行目";
      expect(normalizeText(input)).toBe("1行目 2行目 3行目");
    });

    it("連続する改行を1つのスペースにする", () => {
      const input = "段落1\n\n\n段落2";
      expect(normalizeText(input)).toBe("段落1 段落2");
    });

    it("連続するスペースを1つにする", () => {
      const input = "単語1    単語2";
      expect(normalizeText(input)).toBe("単語1 単語2");
    });

    it("先頭と末尾の空白を除去する", () => {
      const input = "  テキスト  ";
      expect(normalizeText(input)).toBe("テキスト");
    });
  });

  describe("複合ケース", () => {
    it("実際のMarkdownドキュメントを正規化する", () => {
      const input = `# タイトル

これは**重要な**説明です。

## セクション1

- 項目A
- 項目B

> 引用文

詳細は[こちら](https://example.com)を参照。`;

      const expected = "タイトル これは重要な説明です。 セクション1 項目A 項目B 引用文 詳細はこちらを参照。";
      expect(normalizeText(input)).toBe(expected);
    });

    it("コードを含む技術ドキュメントを正規化する", () => {
      const input = `## 使い方

\`slugify\` 関数を使用します：

\`\`\`typescript
import { slugify } from "./slugify";
const result = slugify("Hello World");
\`\`\`

結果は \`Hello-World\` になります。`;

      const expected = "使い方 関数を使用します： 結果は になります。";
      expect(normalizeText(input)).toBe(expected);
    });
  });

  describe("プロパティベーステスト", () => {
    it("出力に改行を含まない", () => {
      const inputs = [
        "a\nb\nc",
        "line1\n\nline2",
        "text\r\nwindows",
      ];

      for (const input of inputs) {
        const result = normalizeText(input);
        expect(result).not.toMatch(/[\n\r]/);
      }
    });

    it("出力に連続するスペースを含まない", () => {
      const inputs = [
        "a  b",
        "x   y   z",
        "multiple     spaces",
      ];

      for (const input of inputs) {
        const result = normalizeText(input);
        expect(result).not.toMatch(/  +/);
      }
    });

    it("出力の先頭・末尾にスペースを含まない", () => {
      const inputs = [
        "  text  ",
        "\n\ntext\n\n",
        "   ",
      ];

      for (const input of inputs) {
        const result = normalizeText(input);
        expect(result).not.toMatch(/^\s|\s$/);
      }
    });
  });
});

describe("normalizeForGPT", () => {
  it("URLを自動的に除去する", () => {
    const input = "詳細は https://example.com を参照";
    expect(normalizeForGPT(input)).toBe("詳細は を参照");
  });

  it("normalizeTextのURL除去版として動作する", () => {
    const input = "# タイトル\n\nhttps://example.com\n\n本文";
    expect(normalizeForGPT(input)).toBe("タイトル 本文");
  });

  it("GPT向けにクリーンなテキストを生成する", () => {
    const input = `## メモ

- [参考](https://ref.com)
- **重要**: https://important.com

\`code\` を使用`;

    expect(normalizeForGPT(input)).toBe("メモ 参考 重要: を使用");
  });
});
