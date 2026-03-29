/**
 * inferNoteType のテスト
 */

import { describe, it, expect } from "vitest";
import { inferNoteType, type InferenceResult } from "./index";

describe("inferNoteType", () => {
  describe("タイプ推論", () => {
    describe("decision 判定", () => {
      it("「にした」で終わるテキストは decision", () => {
        const result = inferNoteType("React を使うことにした");
        expect(result.type).toBe("decision");
      });

      it("「を採用」を含むテキストは decision", () => {
        const result = inferNoteType("TypeScript を採用する");
        expect(result.type).toBe("decision");
      });

      it("「方針」を含むテキストは decision", () => {
        const result = inferNoteType("チームの方針として");
        expect(result.type).toBe("decision");
      });

      it("「と判断」を含むテキストは decision", () => {
        const result = inferNoteType("これが最適と判断した");
        expect(result.type).toBe("decision");
      });
    });

    describe("learning 判定", () => {
      it("「とは」で終わるテキストは learning", () => {
        const result = inferNoteType("クロージャとは");
        expect(result.type).toBe("learning");
      });

      it("「メリット」を含むテキストは learning", () => {
        const result = inferNoteType("TypeScriptのメリットについて");
        expect(result.type).toBe("learning");
      });

      it("「パターン」を含むテキストは learning", () => {
        const result = inferNoteType("Observerパターンの解説");
        expect(result.type).toBe("learning");
      });

      it("「ベストプラクティス」を含むテキストは learning", () => {
        const result = inferNoteType("テストのベストプラクティス");
        expect(result.type).toBe("learning");
      });
    });

    describe("emotion 判定", () => {
      it("「疲れ」を含むテキストは emotion", () => {
        const result = inferNoteType("今日はとても疲れた");
        expect(result.type).toBe("emotion");
      });

      it("「嬉しい」を含むテキストは emotion", () => {
        const result = inferNoteType("機能がリリースできて嬉しい");
        expect(result.type).toBe("emotion");
      });

      it("「不安」を含むテキストは emotion", () => {
        const result = inferNoteType("この設計に不安がある");
        expect(result.type).toBe("emotion");
      });
    });

    describe("log 判定", () => {
      it("時刻パターンを含むテキストは log", () => {
        const result = inferNoteType("10:00 ミーティング開始");
        expect(result.type).toBe("log");
      });

      it("「完了」で終わるテキストは log", () => {
        const result = inferNoteType("タスク完了");
        expect(result.type).toBe("log");
      });

      it("「MTG」を含むテキストは log", () => {
        const result = inferNoteType("チームMTGに参加");
        expect(result.type).toBe("log");
      });
    });

    describe("scratch 判定", () => {
      it("「迷」を含むテキストは scratch", () => {
        const result = inferNoteType("どうしようか迷っている");
        expect(result.type).toBe("scratch");
      });

      it("「？」で終わるテキストは scratch", () => {
        const result = inferNoteType("これでいいのか？");
        expect(result.type).toBe("scratch");
      });

      it("「TODO」を含むテキストは scratch", () => {
        const result = inferNoteType("TODO: 後で調べる");
        expect(result.type).toBe("scratch");
      });

      it("パターンがマッチしない場合は scratch", () => {
        const result = inferNoteType("単なるテキスト");
        expect(result.type).toBe("scratch");
      });
    });
  });

  describe("intent 推論", () => {
    it("アーキテクチャ関連キーワードで architecture", () => {
      const result = inferNoteType("アーキテクチャの責務分離について");
      expect(result.intent).toBe("architecture");
    });

    it("設計関連キーワードで design", () => {
      const result = inferNoteType("API設計の仕様を決める");
      expect(result.intent).toBe("design");
    });

    it("実装関連キーワードで implementation", () => {
      const result = inferNoteType("コードのリファクタリング");
      expect(result.intent).toBe("implementation");
    });

    it("レビュー関連キーワードで review", () => {
      const result = inferNoteType("PRのコードレビュー");
      expect(result.intent).toBe("review");
    });

    it("プロセス関連キーワードで process", () => {
      const result = inferNoteType("開発フローの進め方");
      expect(result.intent).toBe("process");
    });

    it("人関連キーワードで people", () => {
      const result = inferNoteType("チームのコミュニケーション");
      expect(result.intent).toBe("people");
    });

    it("マッチしない場合は unknown", () => {
      const result = inferNoteType("単なるメモ");
      expect(result.intent).toBe("unknown");
    });
  });

  describe("confidence 計算", () => {
    it("パターンマッチが多いほど confidence が高い", () => {
      const lowMatch = inferNoteType("単なるテキスト");
      const highMatch = inferNoteType("方針として採用にした。結論としてこれを選ぶ");

      expect(highMatch.confidence).toBeGreaterThan(lowMatch.confidence);
    });

    it("confidence は最大 0.95（v5.0改修）", () => {
      const result = inferNoteType(
        "方針として採用にした。結論としてこれを選ぶ。なぜならこれが最適だから。"
      );
      expect(result.confidence).toBeLessThanOrEqual(0.95);
    });

    it("パターンなしでも最低 0.3", () => {
      const result = inferNoteType("abc");
      expect(result.confidence).toBeGreaterThanOrEqual(0.3);
    });
  });

  describe("confidenceDetail", () => {
    it("断定パターンで structural が高くなる", () => {
      const result = inferNoteType("Reactを採用にした。これを選んだ。");
      expect(result.confidenceDetail.structural).toBeGreaterThan(0);
    });

    it("比較パターンで structural が高くなる", () => {
      const result = inferNoteType("VueよりReactの方が良い");
      expect(result.confidenceDetail.structural).toBeGreaterThan(0);
    });

    it("experiential は現在 0", () => {
      const result = inferNoteType("任意のテキスト");
      expect(result.confidenceDetail.experiential).toBe(0);
    });

    it("temporal は現在 0", () => {
      const result = inferNoteType("任意のテキスト");
      expect(result.confidenceDetail.temporal).toBe(0);
    });
  });

  describe("decayProfile 推論", () => {
    it("「暫定」を含むと situational", () => {
      const result = inferNoteType("暫定対応として");
      expect(result.decayProfile).toBe("situational");
    });

    it("「一旦」を含むと situational", () => {
      const result = inferNoteType("一旦これで進める");
      expect(result.decayProfile).toBe("situational");
    });

    it("「原則」を含むと stable", () => {
      const result = inferNoteType("原則としてこうする");
      expect(result.decayProfile).toBe("stable");
    });

    it("「常に」を含むと stable", () => {
      const result = inferNoteType("常にこのルールに従う");
      expect(result.decayProfile).toBe("stable");
    });

    it("architecture intent は stable", () => {
      const result = inferNoteType("アーキテクチャの責務分離");
      expect(result.decayProfile).toBe("stable");
    });

    it("implementation intent は exploratory", () => {
      const result = inferNoteType("コードの実装について");
      expect(result.decayProfile).toBe("exploratory");
    });
  });

  describe("reasoning 生成", () => {
    it("検出パターンを含む", () => {
      const result = inferNoteType("方針として採用する");
      expect(result.reasoning).toContain("検出:");
      expect(result.reasoning).toContain("判断表現");
    });

    it("パターンなしの場合のメッセージ", () => {
      const result = inferNoteType("abc");
      expect(result.reasoning).toBe("パターン検出なし（デフォルト: scratch）");
    });

    it("複数パターンを列挙する", () => {
      const result = inferNoteType("疲れた。迷っている");
      expect(result.reasoning).toContain("感情表現");
      expect(result.reasoning).toContain("未整理表現");
    });
  });

  describe("InferenceResult 型", () => {
    it("必要なプロパティをすべて含む", () => {
      const result = inferNoteType("テスト");

      expect(result).toHaveProperty("type");
      expect(result).toHaveProperty("intent");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("confidenceDetail");
      expect(result).toHaveProperty("decayProfile");
      expect(result).toHaveProperty("reasoning");
    });

    it("confidenceDetail は structural, experiential, temporal を含む", () => {
      const result = inferNoteType("テスト");

      expect(result.confidenceDetail).toHaveProperty("structural");
      expect(result.confidenceDetail).toHaveProperty("experiential");
      expect(result.confidenceDetail).toHaveProperty("temporal");
    });
  });
});
