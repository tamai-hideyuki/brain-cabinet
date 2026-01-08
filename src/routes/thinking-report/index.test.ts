/**
 * Thinking Report API Tests
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import { thinkingReportRoute } from "./index";
import { db } from "../../db/client";
import { sql } from "drizzle-orm";

const app = new Hono();
app.route("/api/thinking-report", thinkingReportRoute);

describe("Thinking Report API", () => {
  beforeAll(async () => {
    // テスト用のデータ準備（必要に応じて）
  });

  afterAll(async () => {
    // クリーンアップ（必要に応じて）
  });

  describe("GET /api/thinking-report/perspectives", () => {
    it("should return all available perspectives", async () => {
      const res = await app.request("/api/thinking-report/perspectives");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.perspectives).toBeDefined();
      expect(data.perspectives.length).toBe(6);

      // 全ての視点が含まれていることを確認
      const perspectiveIds = data.perspectives.map((p: any) => p.id);
      expect(perspectiveIds).toContain("engineer");
      expect(perspectiveIds).toContain("po");
      expect(perspectiveIds).toContain("user");
      expect(perspectiveIds).toContain("cto");
      expect(perspectiveIds).toContain("team");
      expect(perspectiveIds).toContain("stakeholder");
    });
  });

  describe("GET /api/thinking-report/perspectives/:id/guide", () => {
    it("should return guide questions for a valid perspective", async () => {
      const res = await app.request("/api/thinking-report/perspectives/engineer/guide");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.perspective).toBe("engineer");
      expect(data.perspectiveLabel).toBe("技術者");
      expect(data.guideQuestions).toBeDefined();
      expect(data.guideQuestions.length).toBeGreaterThan(0);
    });

    it("should return 400 for invalid perspective", async () => {
      const res = await app.request("/api/thinking-report/perspectives/invalid/guide");
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/thinking-report/weekly", () => {
    it("should return a weekly report", async () => {
      const res = await app.request("/api/thinking-report/weekly");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.report).toBeDefined();

      // レポート構造の確認
      expect(data.report.period).toBeDefined();
      expect(data.report.forest).toBeDefined();
      expect(data.report.trees).toBeDefined();
      expect(data.report.perspectiveQuestions).toBeDefined();

      // 森の構造確認
      expect(data.report.forest.phase).toBeDefined();
      expect(data.report.forest.metrics).toBeDefined();

      // 木の構造確認
      expect(data.report.trees.topGrowth).toBeDefined();
      expect(data.report.trees.events).toBeDefined();
    });
  });

  describe("GET /api/thinking-report/distribution", () => {
    it("should return perspective distribution", async () => {
      const res = await app.request("/api/thinking-report/distribution");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      // distribution は null または配列
      if (data.hasData) {
        expect(data.distribution).toBeDefined();
        expect(Array.isArray(data.distribution)).toBe(true);
      }
    });

    it("should accept period parameter", async () => {
      const res = await app.request("/api/thinking-report/distribution?period=month");
      expect(res.status).toBe(200);

      const data = await res.json();
      // hasData がある場合のみ period を返す
      if (data.hasData) {
        expect(data.period).toBe("month");
      } else {
        expect(data.success).toBe(true);
      }
    });
  });

  describe("POST /api/thinking-report/migrate", () => {
    it("should handle migration", async () => {
      const res = await app.request("/api/thinking-report/migrate", {
        method: "POST",
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe("GET /api/thinking-report/challenge/progress", () => {
    it("should return challenge progress", async () => {
      const res = await app.request("/api/thinking-report/challenge/progress");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.weekStart).toBeDefined();
      expect(data.targetPerspective).toBeDefined();
      expect(data.targetCount).toBeDefined();
      expect(data.achievedCount).toBeDefined();
      expect(data.isCompleted).toBeDefined();
    });
  });
});
