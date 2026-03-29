import { describe, it, expect } from "vitest";
import { slugify, slugifyPath } from "./index";

describe("slugify", () => {
  describe("文字変換", () => {
    it("スペースをハイフンに変換する", () => {
      expect(slugify("Hello World")).toBe("Hello-World");
    });

    it("アンダースコアをハイフンに変換する", () => {
      expect(slugify("hello_world")).toBe("hello-world");
    });

    it("タブは制御文字として除去される", () => {
      // \t (0x09) は制御文字範囲 (0x00-0x1f) に含まれるため除去される
      expect(slugify("hello\tworld")).toBe("helloworld");
    });

    it("改行は制御文字として除去される", () => {
      // \n (0x0a) は制御文字範囲 (0x00-0x1f) に含まれるため除去される
      expect(slugify("hello\nworld")).toBe("helloworld");
    });

    it("日本語文字をそのまま保持する", () => {
      expect(slugify("日本語タイトル")).toBe("日本語タイトル");
    });

    it("絵文字をそのまま保持する", () => {
      expect(slugify("メモ📝")).toBe("メモ📝");
    });
  });

  describe("OS非対応文字の除去", () => {
    describe("Windows禁止文字", () => {
      it.each([
        ["<", "less-than"],
        [">", "greater-than"],
        [":", "colon"],
        ['"', "double-quote"],
        ["/", "slash"],
        ["\\", "backslash"],
        ["|", "pipe"],
        ["?", "question-mark"],
        ["*", "asterisk"],
      ])("%s (%s) を除去する", (char) => {
        expect(slugify(`file${char}name`)).toBe("filename");
      });
    });

    it("制御文字 (0x00-0x1f) を除去する", () => {
      expect(slugify("hello\x00world")).toBe("helloworld");
      expect(slugify("hello\x1fworld")).toBe("helloworld");
    });

    it("複数のOS非対応文字を一度に除去する", () => {
      expect(slugify('file<>:"/\\|?*name')).toBe("filename");
    });

    it("OS非対応文字のみの入力は untitled になる", () => {
      expect(slugify("<>:\"/\\|?*")).toBe("untitled");
    });
  });

  describe("ハイフン処理", () => {
    it("連続するハイフンを1つにまとめる", () => {
      expect(slugify("hello---world")).toBe("hello-world");
    });

    it("先頭のハイフンを除去する", () => {
      expect(slugify("--hello")).toBe("hello");
    });

    it("末尾のハイフンを除去する", () => {
      expect(slugify("hello--")).toBe("hello");
    });

    it("複数のスペースを1つのハイフンに変換する", () => {
      expect(slugify("  Hello   World  ")).toBe("Hello-World");
    });

    it("スペースとアンダースコアの混在を1つのハイフンにする", () => {
      expect(slugify("hello _ _ world")).toBe("hello-world");
    });
  });

  describe("フォールバック", () => {
    it("空文字列は untitled を返す", () => {
      expect(slugify("")).toBe("untitled");
    });

    it("OS非対応文字のみは untitled を返す", () => {
      expect(slugify("***")).toBe("untitled");
    });

    it("スペースのみは untitled を返す", () => {
      expect(slugify("   ")).toBe("untitled");
    });

    it("ハイフンのみは untitled を返す", () => {
      expect(slugify("---")).toBe("untitled");
    });
  });

  describe("プロパティベーステスト", () => {
    it("出力にOS非対応文字を含まない", () => {
      const unsafePattern = /[<>:"/\\|?*\x00-\x1f]/;
      const inputs = [
        "normal text",
        "file<name>.txt",
        'path/to/file"test"',
        "hello\x00world",
        "***",
        "",
        "日本語<>テスト",
      ];

      for (const input of inputs) {
        const result = slugify(input);
        expect(result).not.toMatch(unsafePattern);
      }
    });

    it("出力が空文字列にならない（常に有効な値を返す）", () => {
      const inputs = ["", "   ", "***", "---", "<>:?*", "\x00\x1f"];

      for (const input of inputs) {
        const result = slugify(input);
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it("出力の先頭と末尾にハイフンを含まない", () => {
      const inputs = [
        "--hello--",
        "  world  ",
        "___test___",
        "-a-b-c-",
      ];

      for (const input of inputs) {
        const result = slugify(input);
        expect(result).not.toMatch(/^-|-$/);
      }
    });

    it("連続するハイフンを含まない", () => {
      const inputs = [
        "hello---world",
        "a  b  c",
        "x__y__z",
        "test - - test",
      ];

      for (const input of inputs) {
        const result = slugify(input);
        expect(result).not.toMatch(/--+/);
      }
    });
  });

  describe("実際のファイルシステムで扱うケース", () => {
    it("Markdownファイル名", () => {
      expect(slugify("TypeScript 入門ガイド")).toBe("TypeScript-入門ガイド");
    });

    it("日付を含むファイル名", () => {
      expect(slugify("2024-01-15 ミーティングメモ")).toBe("2024-01-15-ミーティングメモ");
    });

    it("バージョン番号を含むファイル名", () => {
      expect(slugify("release_v1.2.3")).toBe("release-v1.2.3");
    });

    it("括弧を含むファイル名", () => {
      expect(slugify("ドキュメント (最終版)")).toBe("ドキュメント-(最終版)");
    });

    it("長いファイル名（切り捨てはしない）", () => {
      const longName = "a".repeat(255);
      expect(slugify(longName)).toBe(longName);
    });
  });
});

describe("slugifyPath", () => {
  describe("ディレクトリ構造の維持", () => {
    it("スラッシュ区切りのパスを維持する", () => {
      expect(slugifyPath("foo/bar/baz")).toBe("foo/bar/baz");
    });

    it("各セグメントを個別にslugify処理する", () => {
      expect(slugifyPath("Hello World/Sub Dir")).toBe("Hello-World/Sub-Dir");
    });

    it("深いネストのパスを処理する", () => {
      expect(slugifyPath("a/b/c/d/e/f")).toBe("a/b/c/d/e/f");
    });
  });

  describe("セグメント内の無効文字処理", () => {
    it("各セグメントからOS非対応文字を除去する", () => {
      expect(slugifyPath("dir:one/dir<two")).toBe("dirone/dirtwo");
    });

    it("スラッシュはパス区切りとして保持される", () => {
      expect(slugifyPath("path/to/file")).toBe("path/to/file");
    });
  });

  describe("空セグメントのフォールバック", () => {
    it("先頭の空セグメント（/で始まる）は untitled になる", () => {
      // "/foo" → ["", "foo"] → ["untitled", "foo"]
      expect(slugifyPath("/foo")).toBe("untitled/foo");
    });

    it("末尾の空セグメント（/で終わる）は untitled になる", () => {
      // "foo/" → ["foo", ""] → ["foo", "untitled"]
      expect(slugifyPath("foo/")).toBe("foo/untitled");
    });

    it("中間の空セグメント（//）は untitled になる", () => {
      // "foo//bar" → ["foo", "", "bar"] → ["foo", "untitled", "bar"]
      expect(slugifyPath("foo//bar")).toBe("foo/untitled/bar");
    });

    it("複数の空セグメントを含むパス", () => {
      expect(slugifyPath("/empty/")).toBe("untitled/empty/untitled");
    });

    it("OS非対応文字のみのセグメントは untitled になる", () => {
      expect(slugifyPath("valid/***/valid")).toBe("valid/untitled/valid");
    });
  });

  describe("実際のファイルシステムで扱うケース", () => {
    it("ドキュメントディレクトリ構造", () => {
      expect(slugifyPath("docs/ガイド/はじめに")).toBe("docs/ガイド/はじめに");
    });

    it("日付ベースのディレクトリ", () => {
      expect(slugifyPath("notes/2024/01/daily memo")).toBe("notes/2024/01/daily-memo");
    });

    it("カテゴリ階層", () => {
      expect(slugifyPath("技術/TypeScript/Tips & Tricks")).toBe("技術/TypeScript/Tips-&-Tricks");
    });

    it("プロジェクト構造", () => {
      expect(slugifyPath("brain_cabinet/src/utils")).toBe("brain-cabinet/src/utils");
    });
  });
});
