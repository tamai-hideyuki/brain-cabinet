/**
 * v5.12 CacheService Unit Tests
 *
 * generateCacheKeyとDEFAULT_TTLの純粋関数テスト
 * DB操作を含む関数は統合テストで検証
 */

import { describe, it, expect } from "vitest";
import { generateCacheKey, DEFAULT_TTL } from "./index";

describe("CacheService", () => {
  describe("generateCacheKey", () => {
    it("should generate consistent cache keys", () => {
      const key1 = generateCacheKey("analytics_timescale", { clusterId: 1 });
      const key2 = generateCacheKey("analytics_timescale", { clusterId: 1 });
      expect(key1).toBe(key2);
    });

    it("should generate different keys for different params", () => {
      const key1 = generateCacheKey("analytics_timescale", { clusterId: 1 });
      const key2 = generateCacheKey("analytics_timescale", { clusterId: 2 });
      expect(key1).not.toBe(key2);
    });

    it("should sort params for consistent ordering", () => {
      const key1 = generateCacheKey("drift_flows", { a: 1, b: 2 });
      const key2 = generateCacheKey("drift_flows", { b: 2, a: 1 });
      expect(key1).toBe(key2);
    });

    it("should handle empty params", () => {
      const key = generateCacheKey("clusters_quality", {});
      expect(key).toBe("clusters_quality:{}");
    });

    it("should handle complex nested params", () => {
      const key = generateCacheKey("analytics_timescale", {
        range: { start: 100, end: 200 },
        filters: ["a", "b"],
      });
      expect(key).toContain("analytics_timescale:");
      expect(key).toContain("range");
      expect(key).toContain("filters");
    });

    it("should produce deterministic keys for identical inputs", () => {
      const inputs = [
        { type: "analytics_timescale" as const, params: {} },
        { type: "drift_flows" as const, params: { rangeDays: 90 } },
        { type: "clusters_quality" as const, params: { id: 1, version: "v2" } },
      ];

      for (const input of inputs) {
        const key1 = generateCacheKey(input.type, input.params);
        const key2 = generateCacheKey(input.type, input.params);
        expect(key1).toBe(key2);
      }
    });

    it("should include keyType in the cache key", () => {
      const key = generateCacheKey("influence_causal_summary", { note: "abc" });
      expect(key.startsWith("influence_causal_summary:")).toBe(true);
    });

    it("should handle number, string and boolean values", () => {
      const key = generateCacheKey("gpt_context", {
        num: 42,
        str: "hello",
        bool: true,
      });
      expect(key).toContain("42");
      expect(key).toContain("hello");
      expect(key).toContain("true");
    });

    it("should handle null and undefined values", () => {
      const key1 = generateCacheKey("analytics_timescale", { a: null });
      const key2 = generateCacheKey("analytics_timescale", { a: undefined });
      // null と undefined は異なるキーになる
      expect(key1).not.toBe(key2);
    });

    it("should handle arrays in params", () => {
      const key = generateCacheKey("drift_flows", { ids: [1, 2, 3] });
      expect(key).toContain("[1,2,3]");
    });
  });

  describe("DEFAULT_TTL", () => {
    it("should have TTL defined for all cache types", () => {
      expect(DEFAULT_TTL.analytics_timescale).toBe(3600);       // 1時間
      expect(DEFAULT_TTL.analytics_timescale_cluster).toBe(3600); // 1時間
      expect(DEFAULT_TTL.influence_causal_summary).toBe(1800);  // 30分
      expect(DEFAULT_TTL.drift_flows).toBe(1800);               // 30分
      expect(DEFAULT_TTL.clusters_quality).toBe(7200);          // 2時間
      expect(DEFAULT_TTL.gpt_context).toBe(900);                // 15分
    });

    it("should have all values greater than 0", () => {
      for (const [, value] of Object.entries(DEFAULT_TTL)) {
        expect(value).toBeGreaterThan(0);
      }
    });

    it("should have reasonable TTL ranges", () => {
      // 最小15分、最大2時間の範囲内
      for (const [, value] of Object.entries(DEFAULT_TTL)) {
        expect(value).toBeGreaterThanOrEqual(900);   // 15分以上
        expect(value).toBeLessThanOrEqual(7200);     // 2時間以下
      }
    });
  });
});
