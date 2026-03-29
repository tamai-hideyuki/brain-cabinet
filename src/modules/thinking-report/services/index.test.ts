/**
 * Thinking Report Service Tests
 */

import { describe, it, expect } from "vitest";
import {
  generatePerspectiveQuestions,
  getGuideQuestions,
  generateWeeklyChallenge,
  PERSPECTIVES,
  PERSPECTIVE_LABELS,
  Perspective,
} from "./index";

describe("Thinking Report Service", () => {
  describe("generatePerspectiveQuestions", () => {
    it("should generate questions for missing perspectives", () => {
      const distribution: Record<Perspective, number> = {
        engineer: 80,
        po: 5,
        user: 5,
        cto: 5,
        team: 3,
        stakeholder: 2,
      };

      const questions = generatePerspectiveQuestions([], distribution);

      expect(questions.length).toBe(3);
      // 最も不足している視点から問いが生成されること
      const perspectives = questions.map((q) => q.perspective);
      expect(perspectives).toContain("stakeholder");
    });

    it("should generate topic-related questions when topics are provided", () => {
      const questions = generatePerspectiveQuestions(["OAuth認証"], null);

      expect(questions.length).toBe(3);
      // トピックが含まれていること
      expect(questions.some((q) => q.question.includes("OAuth認証"))).toBe(true);
    });

    it("should return 3 questions", () => {
      const questions = generatePerspectiveQuestions([], null);
      expect(questions.length).toBe(3);
    });
  });

  describe("getGuideQuestions", () => {
    it("should return guide questions for each perspective", () => {
      for (const perspective of PERSPECTIVES) {
        const questions = getGuideQuestions(perspective);
        expect(questions.length).toBeGreaterThan(0);
        expect(questions.every((q) => typeof q === "string")).toBe(true);
      }
    });

    it("should return questions for engineer perspective", () => {
      const questions = getGuideQuestions("engineer");
      expect(questions.length).toBeGreaterThan(0);
      // 技術的な内容を含むこと
      expect(
        questions.some(
          (q) => q.includes("技術") || q.includes("パフォーマンス") || q.includes("設計")
        )
      ).toBe(true);
    });
  });

  describe("generateWeeklyChallenge", () => {
    it("should generate a challenge when a perspective is missing", () => {
      const distribution: Record<Perspective, number> = {
        engineer: 80,
        po: 5,
        user: 5,
        cto: 5,
        team: 3,
        stakeholder: 2,
      };

      const challenge = generateWeeklyChallenge(distribution);

      expect(challenge).not.toBeNull();
      expect(challenge?.targetPerspective).toBe("stakeholder");
      expect(challenge?.question).toBeDefined();
      expect(challenge?.reason).toBeDefined();
    });

    it("should return null when all perspectives are balanced", () => {
      const distribution: Record<Perspective, number> = {
        engineer: 20,
        po: 15,
        user: 15,
        cto: 15,
        team: 15,
        stakeholder: 20,
      };

      const challenge = generateWeeklyChallenge(distribution);
      expect(challenge).toBeNull();
    });

    it("should return default PO challenge when no distribution data", () => {
      const challenge = generateWeeklyChallenge(null);

      expect(challenge).not.toBeNull();
      expect(challenge?.targetPerspective).toBe("po");
    });
  });

  describe("PERSPECTIVES and PERSPECTIVE_LABELS", () => {
    it("should have labels for all perspectives", () => {
      for (const perspective of PERSPECTIVES) {
        expect(PERSPECTIVE_LABELS[perspective]).toBeDefined();
        expect(typeof PERSPECTIVE_LABELS[perspective]).toBe("string");
      }
    });

    it("should have 6 perspectives", () => {
      expect(PERSPECTIVES.length).toBe(6);
    });
  });
});
