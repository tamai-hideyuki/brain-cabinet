import { describe, it, expect } from "vitest";

// PTM Engine の内部ロジックをテスト

describe("PTM Engine", () => {
  describe("determineClusterRole（クラスタ役割判定）", () => {
    type ClusterIdentity = {
      clusterId: number;
      identity: {
        drift: { contribution: number; trend: string };
        influence: { hubness: number; authority: number };
        cohesion: number;
      };
    };

    type ClusterInteraction = {
      source: number;
      target: number;
      weight: number;
    };

    type ClusterRole = "driver" | "stabilizer" | "bridge" | "isolated";

    const determineClusterRole = (
      identity: ClusterIdentity,
      interactions: ClusterInteraction[]
    ): ClusterRole => {
      const { drift, influence, cohesion } = identity.identity;

      // Driver: drift contribution が高い（成長の主要源）
      if (drift.contribution > 0.3) {
        return "driver";
      }

      // Stabilizer: cohesion が高く、drift が低い（安定した基盤）
      if (cohesion > 0.8 && drift.contribution < 0.1 && influence.hubness > 0.5) {
        return "stabilizer";
      }

      // Bridge: 他クラスタへの影響と受ける影響の両方が存在
      const outgoing = interactions.filter((i) => i.source === identity.clusterId);
      const incoming = interactions.filter((i) => i.target === identity.clusterId);
      if (outgoing.length > 0 && incoming.length > 0) {
        return "bridge";
      }

      // Isolated: 相互作用が少ない
      return "isolated";
    };

    it("高いdrift contributionはdriver", () => {
      const identity: ClusterIdentity = {
        clusterId: 1,
        identity: {
          drift: { contribution: 0.5, trend: "rising" },
          influence: { hubness: 0.3, authority: 0.3 },
          cohesion: 0.6,
        },
      };
      expect(determineClusterRole(identity, [])).toBe("driver");
    });

    it("高いcohesionと低いdriftはstabilizer", () => {
      const identity: ClusterIdentity = {
        clusterId: 1,
        identity: {
          drift: { contribution: 0.05, trend: "flat" },
          influence: { hubness: 0.7, authority: 0.6 },
          cohesion: 0.9,
        },
      };
      expect(determineClusterRole(identity, [])).toBe("stabilizer");
    });

    it("双方向の相互作用がある場合はbridge", () => {
      const identity: ClusterIdentity = {
        clusterId: 2,
        identity: {
          drift: { contribution: 0.1, trend: "flat" },
          influence: { hubness: 0.3, authority: 0.3 },
          cohesion: 0.5,
        },
      };
      const interactions: ClusterInteraction[] = [
        { source: 2, target: 3, weight: 0.5 },
        { source: 1, target: 2, weight: 0.4 },
      ];
      expect(determineClusterRole(identity, interactions)).toBe("bridge");
    });

    it("相互作用がない場合はisolated", () => {
      const identity: ClusterIdentity = {
        clusterId: 1,
        identity: {
          drift: { contribution: 0.1, trend: "flat" },
          influence: { hubness: 0.2, authority: 0.2 },
          cohesion: 0.5,
        },
      };
      expect(determineClusterRole(identity, [])).toBe("isolated");
    });

    it("片方向の相互作用のみはisolated", () => {
      const identity: ClusterIdentity = {
        clusterId: 1,
        identity: {
          drift: { contribution: 0.1, trend: "flat" },
          influence: { hubness: 0.2, authority: 0.2 },
          cohesion: 0.5,
        },
      };
      const interactions: ClusterInteraction[] = [
        { source: 1, target: 2, weight: 0.5 },
        // incoming なし
      ];
      expect(determineClusterRole(identity, interactions)).toBe("isolated");
    });
  });

  describe("generateCoachAdvice（コーチアドバイス生成）", () => {
    type CoachAdvice = {
      today: string;
      tomorrow: string;
      balance: string;
      warning: string | null;
    };

    type ClusterPersonaSummary = {
      clusterId: number;
      keywords: string[];
      role: "driver" | "stabilizer" | "bridge" | "isolated";
    };

    type Snapshot = {
      mode: "exploration" | "consolidation" | "refactoring" | "rest";
      season: "deep_focus" | "broad_search" | "structuring" | "balanced";
      state: "stable" | "overheat" | "stagnation";
      trend: "rising" | "falling" | "flat";
      growthAngle: number;
    };

    const generateCoachAdvice = (
      snapshot: Snapshot,
      topClusters: ClusterPersonaSummary[]
    ): CoachAdvice => {
      const { mode, season, state, trend, growthAngle } = snapshot;

      // Today's advice
      let today = "";
      if (state === "overheat") {
        today = "思考が過熱状態です。一度立ち止まって整理する時間を取りましょう。";
      } else if (state === "stagnation") {
        today = "思考が停滞しています。新しいテーマに触れてみましょう。";
      } else if (mode === "exploration" && season === "broad_search") {
        today = "探索が広がっています。気になったテーマを1つ選んで深掘りしてみましょう。";
      } else if (trend === "rising") {
        today = "良い成長リズムです。この調子で続けましょう。";
      } else {
        today = "安定した成長を続けています。";
      }

      // Tomorrow's advice
      let tomorrow = "";
      if (trend === "rising" && growthAngle > 15) {
        tomorrow = "成長角度が高いです。明日は少しペースを落として整理の時間を取ると良いでしょう。";
      } else if (trend === "falling") {
        tomorrow = "成長ペースが落ち着いています。明日は新しい刺激を取り入れてみましょう。";
      } else {
        tomorrow = "明日は思考の整理に時間を使うと効果的です。";
      }

      // Balance advice
      let balance = "";
      const driverCount = topClusters.filter((c) => c.role === "driver").length;
      const stabilizerCount = topClusters.filter((c) => c.role === "stabilizer").length;

      if (driverCount > 2 && stabilizerCount === 0) {
        balance = "成長に偏りがあります。基盤となる安定したクラスタを育てることも大切です。";
      } else if (stabilizerCount > 2 && driverCount === 0) {
        balance = "安定していますが、新しい成長領域を開拓しましょう。";
      } else {
        balance = "成長と安定のバランスが取れています。";
      }

      // Warning
      let warning: string | null = null;
      if (state === "overheat") {
        warning = "過熱状態：情報摂取を控え、既存の知識を整理することを推奨します。";
      } else if (state === "stagnation") {
        warning = "停滞状態：新しい刺激が必要です。";
      }

      return { today, tomorrow, balance, warning };
    };

    it("過熱状態で警告アドバイス", () => {
      const snapshot: Snapshot = {
        mode: "exploration",
        season: "broad_search",
        state: "overheat",
        trend: "rising",
        growthAngle: 20,
      };
      const advice = generateCoachAdvice(snapshot, []);
      expect(advice.today).toContain("過熱");
      expect(advice.warning).toContain("過熱");
    });

    it("停滞状態で刺激アドバイス", () => {
      const snapshot: Snapshot = {
        mode: "rest",
        season: "balanced",
        state: "stagnation",
        trend: "falling",
        growthAngle: 0,
      };
      const advice = generateCoachAdvice(snapshot, []);
      expect(advice.today).toContain("停滞");
      expect(advice.warning).toContain("停滞");
    });

    it("探索モード+広範囲検索で深掘りアドバイス", () => {
      const snapshot: Snapshot = {
        mode: "exploration",
        season: "broad_search",
        state: "stable",
        trend: "flat",
        growthAngle: 5,
      };
      const advice = generateCoachAdvice(snapshot, []);
      expect(advice.today).toContain("深掘り");
    });

    it("高い成長角度でペースダウンアドバイス", () => {
      const snapshot: Snapshot = {
        mode: "consolidation",
        season: "deep_focus",
        state: "stable",
        trend: "rising",
        growthAngle: 20,
      };
      const advice = generateCoachAdvice(snapshot, []);
      expect(advice.tomorrow).toContain("ペースを落として");
    });

    it("driverに偏ったクラスタでバランスアドバイス", () => {
      const snapshot: Snapshot = {
        mode: "consolidation",
        season: "balanced",
        state: "stable",
        trend: "flat",
        growthAngle: 5,
      };
      const clusters: ClusterPersonaSummary[] = [
        { clusterId: 1, keywords: ["a"], role: "driver" },
        { clusterId: 2, keywords: ["b"], role: "driver" },
        { clusterId: 3, keywords: ["c"], role: "driver" },
      ];
      const advice = generateCoachAdvice(snapshot, clusters);
      expect(advice.balance).toContain("偏り");
    });

    it("バランスの取れたクラスタ", () => {
      const snapshot: Snapshot = {
        mode: "consolidation",
        season: "balanced",
        state: "stable",
        trend: "flat",
        growthAngle: 5,
      };
      const clusters: ClusterPersonaSummary[] = [
        { clusterId: 1, keywords: ["a"], role: "driver" },
        { clusterId: 2, keywords: ["b"], role: "stabilizer" },
      ];
      const advice = generateCoachAdvice(snapshot, clusters);
      expect(advice.balance).toContain("バランスが取れています");
    });
  });

  describe("convertToInteractions（相互作用変換）", () => {
    type FlowData = { source: number; target: number; weight: number };
    type ClusterInteraction = {
      source: number;
      target: number;
      weight: number;
      type: "strong" | "moderate" | "weak";
    };

    const convertToInteractions = (flowData: FlowData[]): ClusterInteraction[] => {
      return flowData.map((flow) => ({
        source: flow.source,
        target: flow.target,
        weight: flow.weight,
        type: flow.weight > 1.0 ? "strong" : flow.weight > 0.3 ? "moderate" : "weak",
      }));
    };

    it("強い相互作用を分類", () => {
      const flows: FlowData[] = [{ source: 1, target: 2, weight: 1.5 }];
      const result = convertToInteractions(flows);
      expect(result[0].type).toBe("strong");
    });

    it("中程度の相互作用を分類", () => {
      const flows: FlowData[] = [{ source: 1, target: 2, weight: 0.5 }];
      const result = convertToInteractions(flows);
      expect(result[0].type).toBe("moderate");
    });

    it("弱い相互作用を分類", () => {
      const flows: FlowData[] = [{ source: 1, target: 2, weight: 0.2 }];
      const result = convertToInteractions(flows);
      expect(result[0].type).toBe("weak");
    });

    it("境界値を正しく処理", () => {
      const flows: FlowData[] = [
        { source: 1, target: 2, weight: 1.0 }, // moderate (not > 1.0)
        { source: 2, target: 3, weight: 0.3 }, // weak (not > 0.3)
      ];
      const result = convertToInteractions(flows);
      expect(result[0].type).toBe("moderate");
      expect(result[1].type).toBe("weak");
    });

    it("空配列を処理", () => {
      expect(convertToInteractions([])).toEqual([]);
    });
  });

  describe("クラスタソート（contribution順）", () => {
    type ClusterSummary = {
      clusterId: number;
      drift: { contribution: number };
    };

    const sortByContribution = (clusters: ClusterSummary[]): ClusterSummary[] => {
      return [...clusters].sort((a, b) => b.drift.contribution - a.drift.contribution);
    };

    it("contributionの高い順にソート", () => {
      const clusters: ClusterSummary[] = [
        { clusterId: 1, drift: { contribution: 0.2 } },
        { clusterId: 2, drift: { contribution: 0.5 } },
        { clusterId: 3, drift: { contribution: 0.1 } },
      ];
      const sorted = sortByContribution(clusters);
      expect(sorted.map((c) => c.clusterId)).toEqual([2, 1, 3]);
    });

    it("同じcontributionの場合は順序を維持", () => {
      const clusters: ClusterSummary[] = [
        { clusterId: 1, drift: { contribution: 0.3 } },
        { clusterId: 2, drift: { contribution: 0.3 } },
      ];
      const sorted = sortByContribution(clusters);
      expect(sorted.length).toBe(2);
    });

    it("空配列を処理", () => {
      expect(sortByContribution([])).toEqual([]);
    });
  });
});
