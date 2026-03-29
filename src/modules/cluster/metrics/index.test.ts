import { describe, it, expect } from "vitest";
import {
  cosineDistance,
  calculateNoteSilhouette,
  calculateAllSilhouettes,
  calculateClusterSilhouettes,
  calculateOverallSilhouette,
  calculateClusterScatter,
  calculateDaviesBouldinIndex,
  simpleKMeans,
  detectSubClusters,
  determineQualityGrade,
  generateRecommendations,
  estimateOptimalK,
  buildClusterInfo,
  type NoteEmbedding,
  type ClusterInfo,
} from "./index";

// テスト用のヘルパー関数
function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return vec.map((v) => v / norm);
}

describe("Cluster Quality Metrics", () => {
  // ============================================================
  // Basic Functions
  // ============================================================

  describe("cosineDistance", () => {
    it("同一ベクトルの距離は0", () => {
      const v = normalize([1, 0, 0]);
      expect(cosineDistance(v, v)).toBeCloseTo(0, 5);
    });

    it("直交ベクトルの距離は1", () => {
      const v1 = normalize([1, 0, 0]);
      const v2 = normalize([0, 1, 0]);
      expect(cosineDistance(v1, v2)).toBeCloseTo(1, 5);
    });

    it("反対ベクトルの距離は2", () => {
      const v1 = normalize([1, 0, 0]);
      const v2 = normalize([-1, 0, 0]);
      expect(cosineDistance(v1, v2)).toBeCloseTo(2, 5);
    });
  });

  describe("buildClusterInfo", () => {
    it("埋め込みからクラスター情報を構築", () => {
      const embeddings: NoteEmbedding[] = [
        { noteId: "n1", clusterId: 1, embedding: normalize([1, 0, 0]) },
        { noteId: "n2", clusterId: 1, embedding: normalize([0.9, 0.1, 0]) },
        { noteId: "n3", clusterId: 2, embedding: normalize([0, 1, 0]) },
      ];

      const info = buildClusterInfo(embeddings);

      expect(info.size).toBe(2);
      expect(info.get(1)?.noteCount).toBe(2);
      expect(info.get(2)?.noteCount).toBe(1);
      expect(info.get(1)?.centroid.length).toBe(3);
    });

    it("空の埋め込みリストは空のマップを返す", () => {
      const info = buildClusterInfo([]);
      expect(info.size).toBe(0);
    });
  });

  // ============================================================
  // Silhouette Coefficient
  // ============================================================

  describe("Silhouette Coefficient", () => {
    describe("calculateNoteSilhouette", () => {
      it("良く分離されたクラスターで高いシルエット係数", () => {
        // クラスター1: x軸方向
        // クラスター2: y軸方向
        const embeddings: NoteEmbedding[] = [
          { noteId: "n1", clusterId: 1, embedding: normalize([1, 0, 0]) },
          { noteId: "n2", clusterId: 1, embedding: normalize([0.95, 0.05, 0]) },
          { noteId: "n3", clusterId: 1, embedding: normalize([0.9, 0.1, 0]) },
          { noteId: "n4", clusterId: 2, embedding: normalize([0, 1, 0]) },
          { noteId: "n5", clusterId: 2, embedding: normalize([0.05, 0.95, 0]) },
          { noteId: "n6", clusterId: 2, embedding: normalize([0.1, 0.9, 0]) },
        ];

        const clusterInfo = buildClusterInfo(embeddings);
        const result = calculateNoteSilhouette(
          embeddings[0].embedding,
          1,
          clusterInfo
        );

        // 良く分離されているので正のシルエット係数
        expect(result.silhouetteScore).toBeGreaterThan(0.5);
        expect(result.a).toBeLessThan(result.b);
      });

      it("単一ノートのクラスターはシルエット係数0", () => {
        const embeddings: NoteEmbedding[] = [
          { noteId: "n1", clusterId: 1, embedding: normalize([1, 0, 0]) },
          { noteId: "n2", clusterId: 2, embedding: normalize([0, 1, 0]) },
        ];

        const clusterInfo = buildClusterInfo(embeddings);
        const result = calculateNoteSilhouette(
          embeddings[0].embedding,
          1,
          clusterInfo
        );

        expect(result.silhouetteScore).toBe(0);
      });

      it("誤分類されたノートは負のシルエット係数", () => {
        // n1 はクラスター1に属しているが、クラスター2により近い
        const embeddings: NoteEmbedding[] = [
          { noteId: "n1", clusterId: 1, embedding: normalize([0.1, 0.9, 0]) }, // 誤分類
          { noteId: "n2", clusterId: 1, embedding: normalize([1, 0, 0]) },
          { noteId: "n3", clusterId: 1, embedding: normalize([0.9, 0.1, 0]) },
          { noteId: "n4", clusterId: 2, embedding: normalize([0, 1, 0]) },
          { noteId: "n5", clusterId: 2, embedding: normalize([0.05, 0.95, 0]) },
        ];

        const clusterInfo = buildClusterInfo(embeddings);
        const result = calculateNoteSilhouette(
          embeddings[0].embedding,
          1,
          clusterInfo
        );

        // 誤分類されているので負のシルエット係数
        expect(result.silhouetteScore).toBeLessThan(0);
      });
    });

    describe("calculateAllSilhouettes", () => {
      it("全ノートのシルエット係数を計算", () => {
        const embeddings: NoteEmbedding[] = [
          { noteId: "n1", clusterId: 1, embedding: normalize([1, 0, 0]) },
          { noteId: "n2", clusterId: 1, embedding: normalize([0.9, 0.1, 0]) },
          { noteId: "n3", clusterId: 2, embedding: normalize([0, 1, 0]) },
          { noteId: "n4", clusterId: 2, embedding: normalize([0.1, 0.9, 0]) },
        ];

        const clusterInfo = buildClusterInfo(embeddings);
        const results = calculateAllSilhouettes(embeddings, clusterInfo);

        expect(results.length).toBe(4);
        expect(results.every((r) => "silhouetteScore" in r)).toBe(true);
      });
    });

    describe("calculateClusterSilhouettes", () => {
      it("クラスター別の統計を計算", () => {
        const silhouettes = [
          { noteId: "n1", clusterId: 1, silhouetteScore: 0.8, a: 0.1, b: 0.5 },
          { noteId: "n2", clusterId: 1, silhouetteScore: 0.6, a: 0.2, b: 0.5 },
          { noteId: "n3", clusterId: 2, silhouetteScore: 0.4, a: 0.2, b: 0.3 },
        ];

        const results = calculateClusterSilhouettes(silhouettes);

        expect(results.length).toBe(2);

        const cluster1 = results.find((r) => r.clusterId === 1);
        expect(cluster1?.avgSilhouette).toBeCloseTo(0.7, 2);
        expect(cluster1?.minSilhouette).toBe(0.6);
        expect(cluster1?.maxSilhouette).toBe(0.8);
      });
    });

    describe("calculateOverallSilhouette", () => {
      it("全体の平均シルエット係数を計算", () => {
        const silhouettes = [
          { noteId: "n1", clusterId: 1, silhouetteScore: 0.8, a: 0.1, b: 0.5 },
          { noteId: "n2", clusterId: 1, silhouetteScore: 0.6, a: 0.2, b: 0.5 },
          { noteId: "n3", clusterId: 2, silhouetteScore: 0.4, a: 0.2, b: 0.3 },
        ];

        const result = calculateOverallSilhouette(silhouettes);

        expect(result).toBeCloseTo(0.6, 2);
      });

      it("空リストは0を返す", () => {
        expect(calculateOverallSilhouette([])).toBe(0);
      });
    });
  });

  // ============================================================
  // Davies-Bouldin Index
  // ============================================================

  describe("Davies-Bouldin Index", () => {
    describe("calculateClusterScatter", () => {
      it("密集したクラスターは低い散布度", () => {
        const info: ClusterInfo = {
          clusterId: 1,
          centroid: normalize([1, 0, 0]),
          noteCount: 3,
          embeddings: [
            normalize([1, 0, 0]),
            normalize([0.99, 0.01, 0]),
            normalize([0.98, 0.02, 0]),
          ],
        };

        const scatter = calculateClusterScatter(info);
        expect(scatter).toBeLessThan(0.1);
      });

      it("分散したクラスターは高い散布度", () => {
        const info: ClusterInfo = {
          clusterId: 1,
          centroid: normalize([0.5, 0.5, 0]),
          noteCount: 2,
          embeddings: [
            normalize([1, 0, 0]),
            normalize([0, 1, 0]),
          ],
        };

        const scatter = calculateClusterScatter(info);
        expect(scatter).toBeGreaterThan(0.2);
      });

      it("単一ノートは散布度0", () => {
        const info: ClusterInfo = {
          clusterId: 1,
          centroid: normalize([1, 0, 0]),
          noteCount: 1,
          embeddings: [normalize([1, 0, 0])],
        };

        expect(calculateClusterScatter(info)).toBe(0);
      });
    });

    describe("calculateDaviesBouldinIndex", () => {
      it("良く分離されたクラスターは低いDBI", () => {
        const clusterInfo = new Map<number, ClusterInfo>();

        // クラスター1: x軸方向に密集
        clusterInfo.set(1, {
          clusterId: 1,
          centroid: normalize([1, 0, 0]),
          noteCount: 3,
          embeddings: [
            normalize([1, 0, 0]),
            normalize([0.99, 0.01, 0]),
            normalize([0.98, 0.02, 0]),
          ],
        });

        // クラスター2: y軸方向に密集
        clusterInfo.set(2, {
          clusterId: 2,
          centroid: normalize([0, 1, 0]),
          noteCount: 3,
          embeddings: [
            normalize([0, 1, 0]),
            normalize([0.01, 0.99, 0]),
            normalize([0.02, 0.98, 0]),
          ],
        });

        const result = calculateDaviesBouldinIndex(clusterInfo);

        expect(result.index).toBeLessThan(1.0);
        expect(result.clusterScores.length).toBe(2);
      });

      it("単一クラスターはDBI 0", () => {
        const clusterInfo = new Map<number, ClusterInfo>();
        clusterInfo.set(1, {
          clusterId: 1,
          centroid: normalize([1, 0, 0]),
          noteCount: 2,
          embeddings: [normalize([1, 0, 0]), normalize([0.9, 0.1, 0])],
        });

        const result = calculateDaviesBouldinIndex(clusterInfo);
        expect(result.index).toBe(0);
      });
    });
  });

  // ============================================================
  // Sub-cluster Detection
  // ============================================================

  describe("Sub-cluster Detection", () => {
    describe("simpleKMeans", () => {
      it("2つの明確なグループを分離", () => {
        const vectors = [
          normalize([1, 0, 0]),
          normalize([0.95, 0.05, 0]),
          normalize([0.9, 0.1, 0]),
          normalize([0, 1, 0]),
          normalize([0.05, 0.95, 0]),
          normalize([0.1, 0.9, 0]),
        ];

        const { centroids, assignments } = simpleKMeans(vectors, 2);

        expect(centroids.length).toBe(2);
        expect(assignments.length).toBe(6);

        // 最初の3つと後の3つは異なるクラスターに
        const firstCluster = assignments[0];
        expect(assignments[1]).toBe(firstCluster);
        expect(assignments[2]).toBe(firstCluster);
        expect(assignments[3]).not.toBe(firstCluster);
        expect(assignments[4]).not.toBe(firstCluster);
        expect(assignments[5]).not.toBe(firstCluster);
      });

      it("空ベクトルは空の結果", () => {
        const result = simpleKMeans([], 2);
        expect(result.centroids).toEqual([]);
        expect(result.assignments).toEqual([]);
      });

      it("k <= 0 は空の結果", () => {
        const vectors = [normalize([1, 0, 0])];
        const result = simpleKMeans(vectors, 0);
        expect(result.centroids).toEqual([]);
      });

      it("ベクトル数 <= k の場合は各ベクトルが1つのクラスター", () => {
        const vectors = [normalize([1, 0, 0]), normalize([0, 1, 0])];
        const result = simpleKMeans(vectors, 3);
        expect(result.centroids.length).toBe(2);
      });
    });

    describe("detectSubClusters", () => {
      it("明確なサブクラスターを検出", () => {
        const embeddings: NoteEmbedding[] = [
          // サブクラスター1: x軸方向
          { noteId: "n1", clusterId: 1, embedding: normalize([1, 0, 0]) },
          { noteId: "n2", clusterId: 1, embedding: normalize([0.95, 0.05, 0]) },
          // サブクラスター2: y軸方向
          { noteId: "n3", clusterId: 1, embedding: normalize([0, 1, 0]) },
          { noteId: "n4", clusterId: 1, embedding: normalize([0.05, 0.95, 0]) },
        ];

        const result = detectSubClusters(embeddings, 0.3);

        expect(result.clusterId).toBe(1);
        expect(result.hasSubClusters).toBe(true);
        expect(result.subClusters.length).toBe(2);
        expect(result.separationScore).toBeGreaterThan(0.3);
      });

      it("均質なクラスターはサブクラスターなし", () => {
        const embeddings: NoteEmbedding[] = [
          { noteId: "n1", clusterId: 1, embedding: normalize([1, 0, 0]) },
          { noteId: "n2", clusterId: 1, embedding: normalize([0.99, 0.01, 0]) },
          { noteId: "n3", clusterId: 1, embedding: normalize([0.98, 0.02, 0]) },
          { noteId: "n4", clusterId: 1, embedding: normalize([0.97, 0.03, 0]) },
        ];

        const result = detectSubClusters(embeddings, 0.3);

        expect(result.hasSubClusters).toBe(false);
        expect(result.subClusters.length).toBe(0);
      });

      it("ノート数が少ない場合はサブクラスター検出しない", () => {
        const embeddings: NoteEmbedding[] = [
          { noteId: "n1", clusterId: 1, embedding: normalize([1, 0, 0]) },
          { noteId: "n2", clusterId: 1, embedding: normalize([0, 1, 0]) },
        ];

        const result = detectSubClusters(embeddings);

        expect(result.hasSubClusters).toBe(false);
      });
    });
  });

  // ============================================================
  // Quality Grade & Recommendations
  // ============================================================

  describe("Quality Grade", () => {
    describe("determineQualityGrade", () => {
      it("高シルエット・高凝集度・サブクラスターなし → A", () => {
        expect(determineQualityGrade(0.8, 0.85, false)).toBe("A");
      });

      it("中程度のメトリクス → B", () => {
        expect(determineQualityGrade(0.6, 0.75, false)).toBe("B");
      });

      it("低めのメトリクス → C", () => {
        expect(determineQualityGrade(0.3, 0.55, false)).toBe("C");
      });

      it("シルエット正だが低い → D", () => {
        expect(determineQualityGrade(0.1, 0.4, false)).toBe("D");
      });

      it("負のシルエット → F", () => {
        expect(determineQualityGrade(-0.2, 0.3, false)).toBe("F");
      });

      it("サブクラスターがあるとグレード低下", () => {
        // サブクラスターありだとAにはならない
        expect(determineQualityGrade(0.8, 0.85, true)).toBe("B");
      });
    });
  });

  describe("Recommendations", () => {
    describe("generateRecommendations", () => {
      it("良好なクラスターは良好メッセージ", () => {
        const subClusterResult = {
          clusterId: 1,
          hasSubClusters: false,
          subClusters: [],
          separationScore: 0,
        };

        const recs = generateRecommendations(0.8, 0.9, subClusterResult, 10);

        expect(recs.some((r) => r.includes("良好"))).toBe(true);
      });

      it("負のシルエット係数は再分類を推奨", () => {
        const subClusterResult = {
          clusterId: 1,
          hasSubClusters: false,
          subClusters: [],
          separationScore: 0,
        };

        const recs = generateRecommendations(-0.1, 0.5, subClusterResult, 10);

        expect(recs.some((r) => r.includes("再分類"))).toBe(true);
      });

      it("低凝集度は分割を推奨", () => {
        const subClusterResult = {
          clusterId: 1,
          hasSubClusters: false,
          subClusters: [],
          separationScore: 0,
        };

        const recs = generateRecommendations(0.5, 0.4, subClusterResult, 10);

        expect(recs.some((r) => r.includes("分割") || r.includes("テーマ"))).toBe(true);
      });

      it("サブクラスターがある場合は分割を推奨", () => {
        const subClusterResult = {
          clusterId: 1,
          hasSubClusters: true,
          subClusters: [{} as any, {} as any],
          separationScore: 0.5,
        };

        const recs = generateRecommendations(0.5, 0.7, subClusterResult, 10);

        expect(recs.some((r) => r.includes("サブグループ"))).toBe(true);
      });

      it("ノート数が少ないと警告", () => {
        const subClusterResult = {
          clusterId: 1,
          hasSubClusters: false,
          subClusters: [],
          separationScore: 0,
        };

        const recs = generateRecommendations(0.5, 0.7, subClusterResult, 2);

        expect(recs.some((r) => r.includes("ノート数が少ない"))).toBe(true);
      });

      it("ノート数が多いと分割推奨", () => {
        const subClusterResult = {
          clusterId: 1,
          hasSubClusters: false,
          subClusters: [],
          separationScore: 0,
        };

        const recs = generateRecommendations(0.5, 0.7, subClusterResult, 60);

        expect(recs.some((r) => r.includes("細かい"))).toBe(true);
      });
    });
  });

  // ============================================================
  // Optimal K Estimation
  // ============================================================

  describe("estimateOptimalK", () => {
    it("少数のノートは適切なKを返す", () => {
      const embeddings: NoteEmbedding[] = [
        { noteId: "n1", clusterId: 1, embedding: normalize([1, 0, 0]) },
        { noteId: "n2", clusterId: 1, embedding: normalize([0, 1, 0]) },
      ];

      const k = estimateOptimalK(embeddings);

      expect(k).toBeGreaterThanOrEqual(1);
      expect(k).toBeLessThanOrEqual(2);
    });

    it("明確に分かれたデータでは適切なKを推定", () => {
      const embeddings: NoteEmbedding[] = [];

      // 3つの明確なグループ
      for (let i = 0; i < 5; i++) {
        embeddings.push({
          noteId: `n1-${i}`,
          clusterId: 1,
          embedding: normalize([1 + Math.random() * 0.1, 0, 0]),
        });
        embeddings.push({
          noteId: `n2-${i}`,
          clusterId: 2,
          embedding: normalize([0, 1 + Math.random() * 0.1, 0]),
        });
        embeddings.push({
          noteId: `n3-${i}`,
          clusterId: 3,
          embedding: normalize([0, 0, 1 + Math.random() * 0.1]),
        });
      }

      const k = estimateOptimalK(embeddings, 6);

      // 2〜4の範囲を期待
      expect(k).toBeGreaterThanOrEqual(2);
      expect(k).toBeLessThanOrEqual(5);
    });
  });

  // ============================================================
  // Integration Tests
  // ============================================================

  describe("統合テスト", () => {
    it("完全なワークフロー: 良好なクラスター構造", () => {
      // 2つの良く分離されたクラスター
      const embeddings: NoteEmbedding[] = [
        { noteId: "n1", clusterId: 1, embedding: normalize([1, 0, 0]) },
        { noteId: "n2", clusterId: 1, embedding: normalize([0.95, 0.05, 0]) },
        { noteId: "n3", clusterId: 1, embedding: normalize([0.9, 0.1, 0]) },
        { noteId: "n4", clusterId: 2, embedding: normalize([0, 1, 0]) },
        { noteId: "n5", clusterId: 2, embedding: normalize([0.05, 0.95, 0]) },
        { noteId: "n6", clusterId: 2, embedding: normalize([0.1, 0.9, 0]) },
      ];

      const clusterInfo = buildClusterInfo(embeddings);
      const silhouettes = calculateAllSilhouettes(embeddings, clusterInfo);
      const overallSilhouette = calculateOverallSilhouette(silhouettes);
      const dbi = calculateDaviesBouldinIndex(clusterInfo);

      // 良い指標を期待
      expect(overallSilhouette).toBeGreaterThan(0.3);
      expect(dbi.index).toBeLessThan(2);
    });

    it("完全なワークフロー: 問題のあるクラスター構造", () => {
      // 重複したクラスター
      const embeddings: NoteEmbedding[] = [
        { noteId: "n1", clusterId: 1, embedding: normalize([0.5, 0.5, 0]) },
        { noteId: "n2", clusterId: 1, embedding: normalize([0.6, 0.4, 0]) },
        { noteId: "n3", clusterId: 2, embedding: normalize([0.55, 0.45, 0]) },
        { noteId: "n4", clusterId: 2, embedding: normalize([0.45, 0.55, 0]) },
      ];

      const clusterInfo = buildClusterInfo(embeddings);
      const silhouettes = calculateAllSilhouettes(embeddings, clusterInfo);
      const overallSilhouette = calculateOverallSilhouette(silhouettes);

      // 低い（または負の）シルエット係数を期待
      expect(overallSilhouette).toBeLessThan(0.3);
    });
  });
});
