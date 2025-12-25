import { describe, it, expect } from "vitest";
import {
  tokenize,
  extractHeadings,
  countParagraphs,
  calculateVocabularyOverlap,
  calculateStructuralSimilarity,
  calculateDirectionVector,
  calculateTopicShift,
  classifyChangeType,
  analyzeSemanticChange,
  serializeChangeDetail,
  deserializeChangeDetail,
} from "./index";

describe("semanticChange", () => {
  describe("tokenize", () => {
    it("日本語トークンを抽出する", () => {
      const tokens = tokenize("これはテストです");
      expect(tokens).toContain("これはテストです");
    });

    it("英語トークンを抽出する", () => {
      const tokens = tokenize("This is a test");
      expect(tokens).toContain("this");
      expect(tokens).toContain("test");
    });

    it("日本語と英語を混合で抽出する", () => {
      const tokens = tokenize("React コンポーネント");
      expect(tokens).toContain("react");
      expect(tokens).toContain("コンポーネント");
    });

    it("1文字の英単語は除外する", () => {
      const tokens = tokenize("a b c test");
      expect(tokens).not.toContain("a");
      expect(tokens).not.toContain("b");
      expect(tokens).not.toContain("c");
      expect(tokens).toContain("test");
    });
  });

  describe("extractHeadings", () => {
    it("Markdown見出しを抽出する", () => {
      const text = `# Title
## Section 1
Some content
### Subsection
## Section 2`;
      const headings = extractHeadings(text);
      expect(headings).toEqual(["Title", "Section 1", "Subsection", "Section 2"]);
    });

    it("見出しがない場合は空配列を返す", () => {
      const headings = extractHeadings("No headings here");
      expect(headings).toEqual([]);
    });
  });

  describe("countParagraphs", () => {
    it("段落数を正しくカウントする", () => {
      const text = `First paragraph.

Second paragraph.

Third paragraph.`;
      expect(countParagraphs(text)).toBe(3);
    });

    it("単一段落の場合は1を返す", () => {
      expect(countParagraphs("Single paragraph")).toBe(1);
    });
  });

  describe("calculateVocabularyOverlap", () => {
    it("完全一致の場合は1.0を返す", () => {
      const tokens = ["test", "example"];
      expect(calculateVocabularyOverlap(tokens, tokens)).toBe(1.0);
    });

    it("完全不一致の場合は0を返す", () => {
      expect(calculateVocabularyOverlap(["a", "b"], ["c", "d"])).toBe(0);
    });

    it("部分一致の場合は正しい値を返す", () => {
      // intersection: {b}, union: {a, b, c} → 1/3
      expect(calculateVocabularyOverlap(["a", "b"], ["b", "c"])).toBeCloseTo(1 / 3);
    });

    it("空配列の場合は1.0を返す", () => {
      expect(calculateVocabularyOverlap([], [])).toBe(1.0);
    });
  });

  describe("calculateStructuralSimilarity", () => {
    it("同じ構造の場合は高い値を返す", () => {
      const text1 = `# Title
## Section 1
Content`;
      const text2 = `# Title
## Section 1
Different content`;
      const similarity = calculateStructuralSimilarity(text1, text2);
      expect(similarity).toBeGreaterThan(0.8);
    });

    it("異なる構造の場合は低い値を返す", () => {
      const text1 = `# Title
## Section 1
## Section 2`;
      const text2 = `# Different Title
## Different Section`;
      const similarity = calculateStructuralSimilarity(text1, text2);
      expect(similarity).toBeLessThan(0.5);
    });
  });

  describe("calculateDirectionVector", () => {
    it("同じベクトルの場合はゼロベクトルを返す", () => {
      const vec = [1, 0, 0];
      const direction = calculateDirectionVector(vec, vec);
      expect(direction.every((v) => v === 0)).toBe(true);
    });

    it("正規化されたベクトルを返す", () => {
      const direction = calculateDirectionVector([0, 0, 0], [3, 4, 0]);
      const norm = Math.sqrt(direction.reduce((sum, v) => sum + v * v, 0));
      expect(norm).toBeCloseTo(1.0);
    });

    it("次元が一致しない場合はエラーを投げる", () => {
      expect(() => calculateDirectionVector([1, 2], [1, 2, 3])).toThrow();
    });
  });

  describe("calculateTopicShift", () => {
    it("同一ベクトルの場合は低い値を返す", () => {
      const vec = [1, 0, 0];
      const shift = calculateTopicShift(vec, vec, 1.0);
      expect(shift).toBeLessThan(0.1);
    });

    it("直交ベクトルの場合は高い値を返す", () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      const shift = calculateTopicShift(vec1, vec2, 0.0);
      expect(shift).toBeGreaterThan(0.5);
    });
  });

  describe("classifyChangeType", () => {
    it("微小な変化はrefinementと判定する", () => {
      const result = classifyChangeType(0.03, 1.0, 0.1, 0.9, 0.9);
      expect(result.type).toBe("refinement");
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it("トピック移動が大きい場合はpivotと判定する", () => {
      const result = classifyChangeType(0.5, 1.0, 0.6, 0.3, 0.5);
      expect(result.type).toBe("pivot");
    });

    it("長さが増加した場合はexpansionと判定する", () => {
      const result = classifyChangeType(0.3, 1.5, 0.2, 0.6, 0.8);
      expect(result.type).toBe("expansion");
    });

    it("長さが減少した場合はcontractionと判定する", () => {
      const result = classifyChangeType(0.3, 0.5, 0.2, 0.6, 0.8);
      expect(result.type).toBe("contraction");
    });

    it("語彙重複が高く長さが同程度の場合はdeepeningと判定する", () => {
      const result = classifyChangeType(0.2, 1.0, 0.2, 0.8, 0.7);
      expect(result.type).toBe("deepening");
    });
  });

  describe("analyzeSemanticChange", () => {
    it("変化を正しく分析する", () => {
      const oldText = "# Test\n\nThis is a test.";
      const newText = "# Test\n\nThis is a test with more content.";
      const oldEmbedding = [1, 0, 0];
      const newEmbedding = [0.9, 0.1, 0];

      const result = analyzeSemanticChange(
        oldText,
        newText,
        oldEmbedding,
        newEmbedding
      );

      expect(result.type).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.magnitude).toBeGreaterThanOrEqual(0);
      expect(result.magnitude).toBeLessThanOrEqual(1);
      expect(result.direction).toHaveLength(3);
      expect(result.metrics.contentLengthRatio).toBeGreaterThan(1);
    });

    it("semantic_diffが渡された場合はそれを使用する", () => {
      const result = analyzeSemanticChange(
        "old",
        "new",
        [1, 0],
        [0, 1],
        0.5
      );
      expect(result.magnitude).toBe(0.5);
    });
  });

  describe("serializeChangeDetail / deserializeChangeDetail", () => {
    it("方向ベクトルを除外してシリアライズできる", () => {
      const detail = {
        type: "expansion" as const,
        confidence: 0.8,
        magnitude: 0.3,
        direction: [1, 0, 0],
        metrics: {
          contentLengthRatio: 1.5,
          topicShift: 0.2,
          vocabularyOverlap: 0.7,
          structuralSimilarity: 0.9,
        },
      };

      const json = serializeChangeDetail(detail, false);
      const parsed = JSON.parse(json);

      expect(parsed.direction).toBeUndefined();
      expect(parsed.type).toBe("expansion");
      expect(parsed.confidence).toBe(0.8);
    });

    it("方向ベクトルを含めてシリアライズできる", () => {
      const detail = {
        type: "pivot" as const,
        confidence: 0.9,
        magnitude: 0.5,
        direction: [0.5, 0.5, 0],
        metrics: {
          contentLengthRatio: 1.0,
          topicShift: 0.6,
          vocabularyOverlap: 0.3,
          structuralSimilarity: 0.4,
        },
      };

      const json = serializeChangeDetail(detail, true);
      const parsed = deserializeChangeDetail(json);

      expect(parsed.direction).toEqual([0.5, 0.5, 0]);
      expect(parsed.type).toBe("pivot");
    });
  });
});
