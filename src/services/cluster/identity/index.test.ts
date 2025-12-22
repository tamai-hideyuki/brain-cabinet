/**
 * Cluster Identity Service のテスト
 */

import { describe, it, expect } from "vitest";
import { extractKeywords, formatForGpt, GPT_IDENTITY_PROMPT } from "./index";
import type { ClusterIdentity } from "../../ptm/types";

describe("clusterIdentityService", () => {
  describe("extractKeywords", () => {
    it("空の配列を渡すと空の配列を返す", () => {
      const result = extractKeywords([]);
      expect(result).toEqual([]);
    });

    it("日本語のカタカナ語を抽出する", () => {
      const titles = [
        "TypeScriptの基礎",
        "TypeScriptでReact開発",
        "TypeScript入門ガイド",
      ];
      const result = extractKeywords(titles);
      expect(result).toContain("typescript");
    });

    it("漢字語を抽出する", () => {
      const titles = [
        "機械学習の基礎",
        "機械学習アルゴリズム",
        "深層学習入門",
      ];
      const result = extractKeywords(titles);
      expect(result).toContain("機械学習");
    });

    it("英語の単語を小文字に正規化して抽出する", () => {
      const titles = [
        "React Hooks Tutorial",
        "REACT Best Practices",
        "react component design",
      ];
      const result = extractKeywords(titles);
      expect(result).toContain("react");
    });

    it("ストップワードを除外する", () => {
      const titles = [
        "これはテストです",
        "テストについて",
        "テスト投稿",
      ];
      const result = extractKeywords(titles);
      expect(result).not.toContain("これ");
      expect(result).not.toContain("です");
      expect(result).not.toContain("について");
      expect(result).not.toContain("投稿");
      expect(result).toContain("テスト");
    });

    it("数字を除外する", () => {
      const titles = [
        "2024年の予測",
        "第123回ミーティング",
      ];
      const result = extractKeywords(titles);
      expect(result.some(w => /^\d+$/.test(w))).toBe(false);
    });

    it("1文字の単語を除外する", () => {
      const titles = ["A B C テスト"];
      const result = extractKeywords(titles);
      expect(result).not.toContain("a");
      expect(result).not.toContain("b");
      expect(result).not.toContain("c");
    });

    it("頻度順でソートする", () => {
      const titles = [
        "API設計",
        "API開発",
        "API テスト",
        "React コンポーネント",
        "React hooks",
      ];
      const result = extractKeywords(titles, 2);
      expect(result[0]).toBe("api");
      expect(result[1]).toBe("react");
    });

    it("maxKeywordsで結果数を制限する", () => {
      const titles = [
        "JavaScript",
        "TypeScript",
        "React",
        "Vue",
        "Angular",
        "Node",
      ];
      const result = extractKeywords(titles, 3);
      expect(result).toHaveLength(3);
    });

    it("記号と括弧を除去する", () => {
      const titles = [
        "【重要】API設計について（メモ）",
        "「React」の使い方",
        "[WIP] 開発ログ",
      ];
      const result = extractKeywords(titles);
      expect(result.some(w => /[【】「」\[\]()（）]/.test(w))).toBe(false);
    });

    it("カタカナ連続語を抽出する", () => {
      const titles = [
        "プログラミング入門",
        "プログラミング実践",
        "データサイエンス",
      ];
      const result = extractKeywords(titles);
      expect(result).toContain("プログラミング");
    });

    it("短すぎる日本語単語を除外する", () => {
      const titles = ["あ い う"];
      const result = extractKeywords(titles);
      expect(result).toHaveLength(0);
    });

    it("長すぎる単語を除外する（20文字超）", () => {
      const titles = ["superlongwordthatexceedstwentycharacters テスト"];
      const result = extractKeywords(titles);
      expect(result.some(w => w.length > 20)).toBe(false);
    });
  });

  describe("formatForGpt", () => {
    const mockIdentity: ClusterIdentity = {
      clusterId: 1,
      identity: {
        name: null,
        summary: null,
        keywords: ["typescript", "react", "開発"],
        representatives: [
          { id: "note-1", title: "TypeScript入門", category: "tech", cosine: 0.95 },
          { id: "note-2", title: "React Hooks", category: "tech", cosine: 0.88 },
        ],
        drift: {
          contribution: 0.25,
          trend: "rising",
          recentDriftSum: 1.5,
        },
        influence: {
          outDegree: 10,
          inDegree: 8,
          hubness: 0.56,
          authority: 0.44,
        },
        cohesion: 0.82,
        noteCount: 15,
      },
    };

    it("正しい構造でGptIdentityRequestを生成する", () => {
      const result = formatForGpt(mockIdentity);

      expect(result.task).toBe("cluster_identity");
      expect(result.clusterId).toBe(1);
    });

    it("identityDataにキーワードを含める", () => {
      const result = formatForGpt(mockIdentity);

      expect(result.identityData.keywords).toEqual(["typescript", "react", "開発"]);
    });

    it("representativesからid/categoryを除外してtitle/cosineのみ返す", () => {
      const result = formatForGpt(mockIdentity);

      expect(result.identityData.representatives).toHaveLength(2);
      expect(result.identityData.representatives[0]).toEqual({
        title: "TypeScript入門",
        cosine: 0.95,
      });
      expect(result.identityData.representatives[0]).not.toHaveProperty("id");
      expect(result.identityData.representatives[0]).not.toHaveProperty("category");
    });

    it("driftサマリーを正しくフォーマットする", () => {
      const result = formatForGpt(mockIdentity);

      expect(result.identityData.drift).toEqual({
        contribution: 0.25,
        trend: "rising",
        recentDriftSum: 1.5,
      });
    });

    it("influenceサマリーを正しくフォーマットする", () => {
      const result = formatForGpt(mockIdentity);

      expect(result.identityData.influence).toEqual({
        outDegree: 10,
        inDegree: 8,
        hubness: 0.56,
        authority: 0.44,
      });
    });

    it("cohesionとnoteCountを含める", () => {
      const result = formatForGpt(mockIdentity);

      expect(result.identityData.cohesion).toBe(0.82);
      expect(result.identityData.noteCount).toBe(15);
    });

    it("空のrepresentativesでも動作する", () => {
      const emptyIdentity: ClusterIdentity = {
        clusterId: 2,
        identity: {
          name: null,
          summary: null,
          keywords: [],
          representatives: [],
          drift: {
            contribution: 0,
            trend: "flat",
            recentDriftSum: 0,
          },
          influence: {
            outDegree: 0,
            inDegree: 0,
            hubness: 0,
            authority: 0,
          },
          cohesion: 0,
          noteCount: 0,
        },
      };

      const result = formatForGpt(emptyIdentity);

      expect(result.identityData.representatives).toEqual([]);
      expect(result.identityData.keywords).toEqual([]);
    });
  });

  describe("GPT_IDENTITY_PROMPT", () => {
    it("プロンプトテンプレートが定義されている", () => {
      expect(GPT_IDENTITY_PROMPT).toBeDefined();
      expect(typeof GPT_IDENTITY_PROMPT).toBe("string");
    });

    it("必要な出力フォーマット要素を含む", () => {
      expect(GPT_IDENTITY_PROMPT).toContain("clusterId");
      expect(GPT_IDENTITY_PROMPT).toContain("name");
      expect(GPT_IDENTITY_PROMPT).toContain("persona");
      expect(GPT_IDENTITY_PROMPT).toContain("identity");
      expect(GPT_IDENTITY_PROMPT).toContain("thinkingStyle");
    });

    it("Brain Cabinetへの言及を含む", () => {
      expect(GPT_IDENTITY_PROMPT).toContain("Brain Cabinet");
    });
  });
});
