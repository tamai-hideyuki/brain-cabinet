/**
 * Rule Engine のテスト
 */

import { describe, it, expect } from "vitest";
import {
  classify,
  getTypeWeight,
  getSearchPriority,
  needsReinference,
} from "./index";
import type { InferenceResult } from "../inferNoteType";

// テスト用ヘルパー
const createInference = (
  overrides: Partial<InferenceResult>
): InferenceResult => ({
  type: "scratch",
  intent: "unknown",
  confidence: 0.5,
  confidenceDetail: { structural: 0.5, experiential: 0.5, temporal: 0.5 },
  decayProfile: "exploratory",
  reasoning: "",
  ...overrides,
});

describe("classify", () => {
  describe("decision ルール", () => {
    it("confidence >= 0.7 で high reliability の decision", () => {
      const inference = createInference({ type: "decision", confidence: 0.8 });
      const result = classify(inference);

      expect(result.primaryType).toBe("decision");
      expect(result.secondaryTypes).toEqual([]);
      expect(result.reliability).toBe("high");
    });

    it("0.4 <= confidence < 0.7 で mid reliability の decision", () => {
      const inference = createInference({ type: "decision", confidence: 0.5 });
      const result = classify(inference);

      expect(result.primaryType).toBe("decision");
      expect(result.secondaryTypes).toContain("scratch");
      expect(result.reliability).toBe("mid");
    });

    it("confidence < 0.4 で low reliability の scratch にフォールバック", () => {
      const inference = createInference({ type: "decision", confidence: 0.3 });
      const result = classify(inference);

      expect(result.primaryType).toBe("scratch");
      expect(result.reliability).toBe("low");
    });
  });

  describe("learning ルール", () => {
    it("confidence >= 0.6 で high reliability の learning", () => {
      const inference = createInference({ type: "learning", confidence: 0.7 });
      const result = classify(inference);

      expect(result.primaryType).toBe("learning");
      expect(result.reliability).toBe("high");
    });

    it("0.4 <= confidence < 0.6 で scratch 主体 + learning 副次", () => {
      const inference = createInference({ type: "learning", confidence: 0.5 });
      const result = classify(inference);

      expect(result.primaryType).toBe("scratch");
      expect(result.secondaryTypes).toContain("learning");
      expect(result.reliability).toBe("mid");
    });

    it("confidence < 0.4 で low reliability の scratch", () => {
      const inference = createInference({ type: "learning", confidence: 0.3 });
      const result = classify(inference);

      expect(result.primaryType).toBe("scratch");
      expect(result.reliability).toBe("low");
    });
  });

  describe("emotion ルール", () => {
    it("confidence >= 0.4 で mid reliability の emotion", () => {
      const inference = createInference({ type: "emotion", confidence: 0.5 });
      const result = classify(inference);

      expect(result.primaryType).toBe("emotion");
      expect(result.reliability).toBe("mid");
    });

    it("confidence < 0.4 で scratch にフォールバック", () => {
      const inference = createInference({ type: "emotion", confidence: 0.3 });
      const result = classify(inference);

      expect(result.primaryType).toBe("scratch");
    });
  });

  describe("log ルール", () => {
    it("confidence >= 0.4 で mid reliability の log", () => {
      const inference = createInference({ type: "log", confidence: 0.5 });
      const result = classify(inference);

      expect(result.primaryType).toBe("log");
      expect(result.reliability).toBe("mid");
    });

    it("confidence < 0.4 で scratch にフォールバック", () => {
      const inference = createInference({ type: "log", confidence: 0.3 });
      const result = classify(inference);

      expect(result.primaryType).toBe("scratch");
    });
  });

  describe("scratch ルール", () => {
    it("scratch タイプは常に low reliability", () => {
      const inference = createInference({ type: "scratch", confidence: 0.9 });
      const result = classify(inference);

      expect(result.primaryType).toBe("scratch");
      expect(result.reliability).toBe("low");
    });
  });
});

describe("getTypeWeight", () => {
  it("decision は最高の重み 1.0", () => {
    expect(getTypeWeight("decision")).toBe(1.0);
  });

  it("learning は 0.6", () => {
    expect(getTypeWeight("learning")).toBe(0.6);
  });

  it("scratch は 0.2", () => {
    expect(getTypeWeight("scratch")).toBe(0.2);
  });

  it("emotion は 0.1", () => {
    expect(getTypeWeight("emotion")).toBe(0.1);
  });

  it("log は 0.1", () => {
    expect(getTypeWeight("log")).toBe(0.1);
  });
});

describe("getSearchPriority", () => {
  it("decision + high で最高スコア 100", () => {
    const score = getSearchPriority("decision", "high");
    expect(score).toBe(100);
  });

  it("decision + mid で 70", () => {
    const score = getSearchPriority("decision", "mid");
    expect(score).toBe(70);
  });

  it("decision + low で 40", () => {
    const score = getSearchPriority("decision", "low");
    expect(score).toBe(40);
  });

  it("learning + high で 60", () => {
    const score = getSearchPriority("learning", "high");
    expect(score).toBe(60);
  });

  it("learning + mid で 42", () => {
    const score = getSearchPriority("learning", "mid");
    expect(score).toBe(42);
  });

  it("scratch + high で 20", () => {
    const score = getSearchPriority("scratch", "high");
    expect(score).toBe(20);
  });

  it("emotion + mid で 7", () => {
    const score = getSearchPriority("emotion", "mid");
    expect(score).toBe(7);
  });
});

describe("needsReinference", () => {
  it("confidence < 0.6 で再推論が必要", () => {
    const inference = createInference({ confidence: 0.5 });
    const classification = classify(inference);

    expect(needsReinference(inference, classification)).toBe(true);
  });

  it("confidence >= 0.6 で通常は再推論不要", () => {
    const inference = createInference({ type: "learning", confidence: 0.7 });
    const classification = classify(inference);

    expect(needsReinference(inference, classification)).toBe(false);
  });

  it("decision で mid reliability の場合は再推論が必要", () => {
    const inference = createInference({ type: "decision", confidence: 0.6 });
    const classification = classify(inference);

    // mid reliability の decision
    expect(classification.primaryType).toBe("decision");
    expect(classification.reliability).toBe("mid");
    expect(needsReinference(inference, classification)).toBe(true);
  });

  it("decision で high reliability の場合は再推論不要", () => {
    const inference = createInference({ type: "decision", confidence: 0.8 });
    const classification = classify(inference);

    expect(classification.reliability).toBe("high");
    expect(needsReinference(inference, classification)).toBe(false);
  });
});
