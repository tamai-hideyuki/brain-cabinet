import { describe, it, expect } from "vitest";
import { isValidDate, isValidLabel } from "./driftAnnotation";
import { DRIFT_ANNOTATION_LABELS } from "../../db/schema";

// ============================================================
// v7.3: Drift Annotation のテスト
// ============================================================

describe("DriftAnnotation (v7.3)", () => {
  describe("isValidDate", () => {
    it("有効な日付形式を受け入れる", () => {
      expect(isValidDate("2024-01-15")).toBe(true);
      expect(isValidDate("2024-12-31")).toBe(true);
      expect(isValidDate("2025-06-01")).toBe(true);
    });

    it("無効な日付形式を拒否する", () => {
      expect(isValidDate("2024/01/15")).toBe(false);
      expect(isValidDate("01-15-2024")).toBe(false);
      expect(isValidDate("2024-1-15")).toBe(false);
      expect(isValidDate("2024-01-5")).toBe(false);
      expect(isValidDate("20240115")).toBe(false);
      expect(isValidDate("")).toBe(false);
      expect(isValidDate("invalid")).toBe(false);
    });

    it("境界日付を正しく判定する", () => {
      expect(isValidDate("2024-12-31")).toBe(true); // 年末
      expect(isValidDate("2024-01-01")).toBe(true); // 年初
      expect(isValidDate("2024-02-29")).toBe(true); // うるう年
    });
  });

  describe("isValidLabel", () => {
    it("有効なラベルを受け入れる", () => {
      expect(isValidLabel("breakthrough")).toBe(true);
      expect(isValidLabel("exploration")).toBe(true);
      expect(isValidLabel("deepening")).toBe(true);
      expect(isValidLabel("confusion")).toBe(true);
      expect(isValidLabel("rest")).toBe(true);
      expect(isValidLabel("routine")).toBe(true);
    });

    it("無効なラベルを拒否する", () => {
      expect(isValidLabel("invalid")).toBe(false);
      expect(isValidLabel("")).toBe(false);
      expect(isValidLabel("BREAKTHROUGH")).toBe(false);
      expect(isValidLabel("creation")).toBe(false); // phaseの値
      expect(isValidLabel("destruction")).toBe(false); // phaseの値
    });
  });

  describe("DRIFT_ANNOTATION_LABELS", () => {
    it("6種類のラベルが定義されている", () => {
      expect(DRIFT_ANNOTATION_LABELS).toHaveLength(6);
    });

    it("全てのラベルが文字列である", () => {
      for (const label of DRIFT_ANNOTATION_LABELS) {
        expect(typeof label).toBe("string");
        expect(label.length).toBeGreaterThan(0);
      }
    });

    it("期待されるラベルが含まれている", () => {
      const expected = [
        "breakthrough",
        "exploration",
        "deepening",
        "confusion",
        "rest",
        "routine",
      ];
      for (const label of expected) {
        expect(DRIFT_ANNOTATION_LABELS).toContain(label);
      }
    });
  });

  describe("ラベルとphaseの対応", () => {
    type DriftPhase = "creation" | "destruction" | "neutral";
    type DriftAnnotationLabel =
      | "breakthrough"
      | "exploration"
      | "deepening"
      | "confusion"
      | "rest"
      | "routine";

    const checkPhaseMatch = (
      label: DriftAnnotationLabel,
      autoPhase: DriftPhase
    ): boolean => {
      const labelToExpectedPhase: Record<DriftAnnotationLabel, DriftPhase[]> = {
        breakthrough: ["creation"],
        exploration: ["creation", "neutral"],
        deepening: ["destruction", "neutral"],
        confusion: ["creation", "destruction"],
        rest: ["neutral"],
        routine: ["neutral"],
      };

      return labelToExpectedPhase[label].includes(autoPhase);
    };

    it("breakthrough は creation にマッチ", () => {
      expect(checkPhaseMatch("breakthrough", "creation")).toBe(true);
      expect(checkPhaseMatch("breakthrough", "destruction")).toBe(false);
      expect(checkPhaseMatch("breakthrough", "neutral")).toBe(false);
    });

    it("exploration は creation と neutral にマッチ", () => {
      expect(checkPhaseMatch("exploration", "creation")).toBe(true);
      expect(checkPhaseMatch("exploration", "neutral")).toBe(true);
      expect(checkPhaseMatch("exploration", "destruction")).toBe(false);
    });

    it("deepening は destruction と neutral にマッチ", () => {
      expect(checkPhaseMatch("deepening", "destruction")).toBe(true);
      expect(checkPhaseMatch("deepening", "neutral")).toBe(true);
      expect(checkPhaseMatch("deepening", "creation")).toBe(false);
    });

    it("confusion は creation と destruction にマッチ", () => {
      expect(checkPhaseMatch("confusion", "creation")).toBe(true);
      expect(checkPhaseMatch("confusion", "destruction")).toBe(true);
      expect(checkPhaseMatch("confusion", "neutral")).toBe(false);
    });

    it("rest は neutral にマッチ", () => {
      expect(checkPhaseMatch("rest", "neutral")).toBe(true);
      expect(checkPhaseMatch("rest", "creation")).toBe(false);
      expect(checkPhaseMatch("rest", "destruction")).toBe(false);
    });

    it("routine は neutral にマッチ", () => {
      expect(checkPhaseMatch("routine", "neutral")).toBe(true);
      expect(checkPhaseMatch("routine", "creation")).toBe(false);
      expect(checkPhaseMatch("routine", "destruction")).toBe(false);
    });
  });

  describe("統計計算", () => {
    type DriftPhase = "creation" | "destruction" | "neutral";
    type DriftAnnotationLabel =
      | "breakthrough"
      | "exploration"
      | "deepening"
      | "confusion"
      | "rest"
      | "routine";

    type Annotation = {
      label: DriftAnnotationLabel;
      autoPhase: DriftPhase | null;
    };

    const checkPhaseMatch = (
      label: DriftAnnotationLabel,
      autoPhase: DriftPhase
    ): boolean => {
      const labelToExpectedPhase: Record<DriftAnnotationLabel, DriftPhase[]> = {
        breakthrough: ["creation"],
        exploration: ["creation", "neutral"],
        deepening: ["destruction", "neutral"],
        confusion: ["creation", "destruction"],
        rest: ["neutral"],
        routine: ["neutral"],
      };
      return labelToExpectedPhase[label].includes(autoPhase);
    };

    const calcStats = (annotations: Annotation[]) => {
      const byLabel: Record<DriftAnnotationLabel, number> = {
        breakthrough: 0,
        exploration: 0,
        deepening: 0,
        confusion: 0,
        rest: 0,
        routine: 0,
      };

      let matched = 0;
      let mismatched = 0;
      let unknown = 0;

      for (const ann of annotations) {
        byLabel[ann.label]++;

        if (!ann.autoPhase) {
          unknown++;
        } else {
          if (checkPhaseMatch(ann.label, ann.autoPhase)) {
            matched++;
          } else {
            mismatched++;
          }
        }
      }

      return {
        total: annotations.length,
        byLabel,
        phaseMatch: { matched, mismatched, unknown },
      };
    };

    it("空配列は全て0を返す", () => {
      const stats = calcStats([]);
      expect(stats.total).toBe(0);
      expect(stats.phaseMatch.matched).toBe(0);
      expect(stats.phaseMatch.mismatched).toBe(0);
      expect(stats.phaseMatch.unknown).toBe(0);
    });

    it("autoPhaseがnullの場合はunknownにカウント", () => {
      const stats = calcStats([
        { label: "breakthrough", autoPhase: null },
        { label: "routine", autoPhase: null },
      ]);
      expect(stats.phaseMatch.unknown).toBe(2);
      expect(stats.phaseMatch.matched).toBe(0);
    });

    it("マッチするケースを正しくカウント", () => {
      const stats = calcStats([
        { label: "breakthrough", autoPhase: "creation" }, // matched
        { label: "routine", autoPhase: "neutral" }, // matched
        { label: "deepening", autoPhase: "destruction" }, // matched
      ]);
      expect(stats.phaseMatch.matched).toBe(3);
      expect(stats.phaseMatch.mismatched).toBe(0);
    });

    it("ミスマッチするケースを正しくカウント", () => {
      const stats = calcStats([
        { label: "breakthrough", autoPhase: "neutral" }, // mismatched
        { label: "rest", autoPhase: "creation" }, // mismatched
      ]);
      expect(stats.phaseMatch.mismatched).toBe(2);
      expect(stats.phaseMatch.matched).toBe(0);
    });

    it("混合ケースを正しく集計", () => {
      const stats = calcStats([
        { label: "breakthrough", autoPhase: "creation" }, // matched
        { label: "breakthrough", autoPhase: "destruction" }, // mismatched
        { label: "routine", autoPhase: null }, // unknown
        { label: "confusion", autoPhase: "creation" }, // matched (confusion matches both)
        { label: "confusion", autoPhase: "neutral" }, // mismatched
      ]);
      expect(stats.total).toBe(5);
      expect(stats.phaseMatch.matched).toBe(2);
      expect(stats.phaseMatch.mismatched).toBe(2);
      expect(stats.phaseMatch.unknown).toBe(1);
      expect(stats.byLabel.breakthrough).toBe(2);
      expect(stats.byLabel.confusion).toBe(2);
      expect(stats.byLabel.routine).toBe(1);
    });
  });
});
