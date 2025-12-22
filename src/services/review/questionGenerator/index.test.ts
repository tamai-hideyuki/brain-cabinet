/**
 * Question Generator のテスト
 */

import { describe, it, expect } from "vitest";
import {
  generateTemplateQuestions,
  toCreateQuestionInputs,
  generateContentHash,
  shouldGenerateQuestions,
  getQuestionTypeLabel,
} from "./index";

describe("questionGenerator", () => {
  describe("generateTemplateQuestions", () => {
    describe("scratchノート", () => {
      it("scratchノートには質問を生成しない（空配列ではなく最低1つのrecall質問）", () => {
        const content = "これはメモです。";
        const questions = generateTemplateQuestions(content, "scratch");

        // scratchでもrecall質問は生成される
        expect(questions.length).toBeGreaterThanOrEqual(1);
        expect(questions[0].type).toBe("recall");
      });
    });

    describe("learningノート", () => {
      it("learningノートにはrecall、concept、applicationの質問を生成する", () => {
        const content = "# TypeScript\n\nTypeScriptは静的型付けの言語です。";
        const questions = generateTemplateQuestions(content, "learning");

        expect(questions.length).toBeGreaterThanOrEqual(2);

        const types = questions.map((q) => q.type);
        expect(types).toContain("recall");
        expect(types).toContain("application");
      });

      it("見出しがある場合はconcept質問にトピックが含まれる", () => {
        const content = "# React Hooks\n\nReact Hooksは関数コンポーネントで状態を扱う仕組みです。";
        const questions = generateTemplateQuestions(content, "learning");

        const conceptQuestion = questions.find((q) => q.type === "concept");
        expect(conceptQuestion).toBeDefined();
        expect(conceptQuestion?.question).toContain("React Hooks");
      });

      it("キーワードが抽出される", () => {
        const content = "# JavaScript\n\nJavaScriptはプログラミング言語です。変数、関数、オブジェクトを使います。";
        const questions = generateTemplateQuestions(content, "learning");

        expect(questions[0].expectedKeywords.length).toBeGreaterThan(0);
      });
    });

    describe("decisionノート", () => {
      it("decisionノートにはrecallとreasoning質問を生成する", () => {
        const content = "React を採用することにした。理由は...";
        const questions = generateTemplateQuestions(content, "decision");

        const types = questions.map((q) => q.type);
        expect(types).toContain("recall");
        expect(types).toContain("reasoning");
      });

      it("比較パターンがあればcomparison質問も生成する", () => {
        const content = "React vs Vue の比較。メリットとデメリットを考えた結果...";
        const questions = generateTemplateQuestions(content, "decision");

        const types = questions.map((q) => q.type);
        expect(types).toContain("comparison");
      });

      it("比較パターンがなければcomparison質問は生成しない", () => {
        const content = "この方針に決めた。";
        const questions = generateTemplateQuestions(content, "decision");

        const types = questions.map((q) => q.type);
        expect(types).not.toContain("comparison");
      });
    });

    describe("キーワード抽出", () => {
      it("Markdownコードブロックを除去してからキーワードを抽出する", () => {
        const content = "# API設計\n\n```javascript\nconst x = 1;\n```\n\nAPIの設計について考える。";
        const questions = generateTemplateQuestions(content, "learning");

        // const, x などはキーワードに含まれないはず
        const keywords = questions[0].expectedKeywords;
        expect(keywords).not.toContain("const");
      });

      it("ストップワードを除外する", () => {
        const content = "これは the テスト of です to。";
        const questions = generateTemplateQuestions(content, "learning");

        const keywords = questions[0].expectedKeywords;
        expect(keywords).not.toContain("the");
        expect(keywords).not.toContain("of");
        expect(keywords).not.toContain("to");
      });

      it("2文字未満の単語を除外する", () => {
        const content = "a b c テスト";
        const questions = generateTemplateQuestions(content, "learning");

        const keywords = questions[0].expectedKeywords;
        expect(keywords).not.toContain("a");
        expect(keywords).not.toContain("b");
        expect(keywords).not.toContain("c");
      });
    });

    describe("トピック抽出", () => {
      it("Markdown見出しからトピックを抽出する", () => {
        const content = "# GraphQL入門\n\n詳しい説明...";
        const questions = generateTemplateQuestions(content, "learning");

        const conceptQuestion = questions.find((q) => q.type === "concept");
        expect(conceptQuestion?.question).toContain("GraphQL入門");
      });

      it("見出しがない場合は最初の文からトピックを抽出する", () => {
        const content = "Dockerについて学んだこと。設定方法は...";
        const questions = generateTemplateQuestions(content, "learning");

        const conceptQuestion = questions.find((q) => q.type === "concept");
        expect(conceptQuestion?.question).toContain("Dockerについて学んだこと");
      });

      it("トピックは50文字までに制限される", () => {
        const longHeading = "# " + "a".repeat(100);
        const content = longHeading + "\n\n内容";
        const questions = generateTemplateQuestions(content, "learning");

        const conceptQuestion = questions.find((q) => q.type === "concept");
        if (conceptQuestion) {
          // トピック部分が50文字以内に収まっている
          const topicMatch = conceptQuestion.question.match(/「(.+?)」/);
          if (topicMatch) {
            expect(topicMatch[1].length).toBeLessThanOrEqual(50);
          }
        }
      });
    });
  });

  describe("toCreateQuestionInputs", () => {
    it("GeneratedQuestionをCreateQuestionInput形式に変換する", () => {
      const questions = [
        {
          type: "recall" as const,
          question: "テスト質問",
          expectedKeywords: ["keyword1", "keyword2"],
          source: "template" as const,
        },
      ];

      const result = toCreateQuestionInputs(questions, "abc123");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        questionType: "recall",
        question: "テスト質問",
        expectedKeywords: ["keyword1", "keyword2"],
        source: "template",
        contentHash: "abc123",
      });
    });

    it("複数の質問を変換する", () => {
      const questions = [
        {
          type: "recall" as const,
          question: "質問1",
          expectedKeywords: [],
          source: "template" as const,
        },
        {
          type: "concept" as const,
          question: "質問2",
          expectedKeywords: ["key"],
          source: "template" as const,
        },
      ];

      const result = toCreateQuestionInputs(questions, "hash");

      expect(result).toHaveLength(2);
      expect(result[0].contentHash).toBe("hash");
      expect(result[1].contentHash).toBe("hash");
    });
  });

  describe("generateContentHash", () => {
    it("同じコンテンツには同じハッシュを生成する", () => {
      const content = "テストコンテンツ";
      const hash1 = generateContentHash(content);
      const hash2 = generateContentHash(content);

      expect(hash1).toBe(hash2);
    });

    it("異なるコンテンツには異なるハッシュを生成する", () => {
      const hash1 = generateContentHash("コンテンツA");
      const hash2 = generateContentHash("コンテンツB");

      expect(hash1).not.toBe(hash2);
    });

    it("空白・改行を正規化してからハッシュ化する", () => {
      const hash1 = generateContentHash("a  b\n\nc");
      const hash2 = generateContentHash("a b c");

      expect(hash1).toBe(hash2);
    });

    it("16文字のハッシュを返す", () => {
      const hash = generateContentHash("テスト");

      expect(hash.length).toBe(16);
    });

    it("16進数文字列を返す", () => {
      const hash = generateContentHash("テスト");

      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });
  });

  describe("shouldGenerateQuestions", () => {
    it("learningノートには質問を生成する", () => {
      expect(shouldGenerateQuestions("learning")).toBe(true);
    });

    it("decisionノートには質問を生成する", () => {
      expect(shouldGenerateQuestions("decision")).toBe(true);
    });

    it("scratchノートには質問を生成しない", () => {
      expect(shouldGenerateQuestions("scratch")).toBe(false);
    });
  });

  describe("getQuestionTypeLabel", () => {
    it("recallは「想起」を返す", () => {
      expect(getQuestionTypeLabel("recall")).toBe("想起");
    });

    it("conceptは「概念理解」を返す", () => {
      expect(getQuestionTypeLabel("concept")).toBe("概念理解");
    });

    it("reasoningは「推論」を返す", () => {
      expect(getQuestionTypeLabel("reasoning")).toBe("推論");
    });

    it("applicationは「応用」を返す", () => {
      expect(getQuestionTypeLabel("application")).toBe("応用");
    });

    it("comparisonは「比較」を返す", () => {
      expect(getQuestionTypeLabel("comparison")).toBe("比較");
    });
  });
});
