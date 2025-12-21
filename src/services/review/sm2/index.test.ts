/**
 * SM-2 Algorithm のテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateSM2,
  getInitialSM2State,
  adjustIntervalByNoteType,
  previewNextIntervals,
  getQualityLabel,
  getEFDescription,
  formatInterval,
  type SM2State,
} from "./index";

describe("calculateSM2", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("品質 < 3 の場合（失敗）", () => {
    it("quality 0 でリセットされる", () => {
      const state: SM2State = {
        easinessFactor: 2.5,
        interval: 10,
        repetition: 5,
      };
      const result = calculateSM2(0, state);

      expect(result.newState.repetition).toBe(0);
      expect(result.newState.interval).toBe(1);
    });

    it("quality 1 でリセットされる", () => {
      const state: SM2State = {
        easinessFactor: 2.5,
        interval: 30,
        repetition: 10,
      };
      const result = calculateSM2(1, state);

      expect(result.newState.repetition).toBe(0);
      expect(result.newState.interval).toBe(1);
    });

    it("quality 2 でリセットされる", () => {
      const state: SM2State = {
        easinessFactor: 2.5,
        interval: 60,
        repetition: 15,
      };
      const result = calculateSM2(2, state);

      expect(result.newState.repetition).toBe(0);
      expect(result.newState.interval).toBe(1);
    });
  });

  describe("品質 >= 3 の場合（成功）", () => {
    it("初回成功（repetition=0）で interval=1", () => {
      const state: SM2State = {
        easinessFactor: 2.5,
        interval: 1,
        repetition: 0,
      };
      const result = calculateSM2(4, state);

      expect(result.newState.interval).toBe(1);
      expect(result.newState.repetition).toBe(1);
    });

    it("2回目成功（repetition=1）で interval=6", () => {
      const state: SM2State = {
        easinessFactor: 2.5,
        interval: 1,
        repetition: 1,
      };
      const result = calculateSM2(4, state);

      expect(result.newState.interval).toBe(6);
      expect(result.newState.repetition).toBe(2);
    });

    it("3回目以降は interval * EF で計算", () => {
      const state: SM2State = {
        easinessFactor: 2.5,
        interval: 6,
        repetition: 2,
      };
      const result = calculateSM2(4, state);

      // EF' = 2.5 + (0.1 - (5-4) * (0.08 + (5-4) * 0.02))
      //     = 2.5 + (0.1 - 1 * (0.08 + 0.02))
      //     = 2.5 + (0.1 - 0.1) = 2.5
      // interval = round(6 * 2.5) = 15
      expect(result.newState.interval).toBe(15);
      expect(result.newState.repetition).toBe(3);
    });
  });

  describe("EF (Easiness Factor) の計算", () => {
    it("quality 5 で EF が増加", () => {
      const state: SM2State = {
        easinessFactor: 2.5,
        interval: 1,
        repetition: 0,
      };
      const result = calculateSM2(5, state);

      // EF' = 2.5 + (0.1 - 0 * (0.08 + 0 * 0.02)) = 2.5 + 0.1 = 2.6
      expect(result.newState.easinessFactor).toBe(2.6);
    });

    it("quality 3 で EF が減少", () => {
      const state: SM2State = {
        easinessFactor: 2.5,
        interval: 1,
        repetition: 0,
      };
      const result = calculateSM2(3, state);

      // EF' = 2.5 + (0.1 - 2 * (0.08 + 2 * 0.02))
      //     = 2.5 + (0.1 - 2 * 0.12)
      //     = 2.5 + (0.1 - 0.24) = 2.5 - 0.14 = 2.36
      expect(result.newState.easinessFactor).toBe(2.36);
    });

    it("EF は 1.3 未満にならない", () => {
      const state: SM2State = {
        easinessFactor: 1.3,
        interval: 1,
        repetition: 0,
      };
      const result = calculateSM2(0, state);

      expect(result.newState.easinessFactor).toBeGreaterThanOrEqual(1.3);
    });
  });

  describe("nextReviewAt の計算", () => {
    it("interval 日後の Unix timestamp を返す", () => {
      const state: SM2State = {
        easinessFactor: 2.5,
        interval: 1,
        repetition: 1,
      };
      const result = calculateSM2(4, state);

      // 2024-01-01 00:00:00 + 6 days
      const expectedDate = new Date("2024-01-07T00:00:00Z");
      expect(result.nextReviewAt).toBe(Math.floor(expectedDate.getTime() / 1000));
    });
  });
});

describe("getInitialSM2State", () => {
  it("初期状態を返す", () => {
    const state = getInitialSM2State();

    expect(state.easinessFactor).toBe(2.5);
    expect(state.interval).toBe(1);
    expect(state.repetition).toBe(0);
  });
});

describe("adjustIntervalByNoteType", () => {
  it("decision ノートは間隔を 20% 短縮", () => {
    expect(adjustIntervalByNoteType(10, "decision")).toBe(8);
    expect(adjustIntervalByNoteType(5, "decision")).toBe(4);
    expect(adjustIntervalByNoteType(100, "decision")).toBe(80);
  });

  it("learning ノートは間隔を変更しない", () => {
    expect(adjustIntervalByNoteType(10, "learning")).toBe(10);
    expect(adjustIntervalByNoteType(5, "learning")).toBe(5);
  });

  it("最小間隔は 1 日", () => {
    expect(adjustIntervalByNoteType(1, "decision")).toBe(1);
  });
});

describe("previewNextIntervals", () => {
  it("全品質評価の予測を返す", () => {
    const state: SM2State = {
      easinessFactor: 2.5,
      interval: 6,
      repetition: 2,
    };
    const previews = previewNextIntervals(state);

    expect(previews).toHaveLength(6);
    expect(previews.map((p) => p.quality)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("失敗時は interval=1", () => {
    const state: SM2State = {
      easinessFactor: 2.5,
      interval: 30,
      repetition: 5,
    };
    const previews = previewNextIntervals(state);

    expect(previews[0].nextInterval).toBe(1); // quality 0
    expect(previews[1].nextInterval).toBe(1); // quality 1
    expect(previews[2].nextInterval).toBe(1); // quality 2
  });

  it("成功時は EF に基づいて間隔が増加", () => {
    const state: SM2State = {
      easinessFactor: 2.5,
      interval: 6,
      repetition: 2,
    };
    const previews = previewNextIntervals(state);

    // quality 5 が最も長い間隔
    expect(previews[5].nextInterval).toBeGreaterThan(previews[3].nextInterval);
  });
});

describe("getQualityLabel", () => {
  it("各品質評価のラベルを返す", () => {
    expect(getQualityLabel(0)).toBe("完全忘却");
    expect(getQualityLabel(1)).toBe("不正解（思い出した）");
    expect(getQualityLabel(2)).toBe("不正解（簡単に思い出せた）");
    expect(getQualityLabel(3)).toBe("正解（困難）");
    expect(getQualityLabel(4)).toBe("正解（少し躊躇）");
    expect(getQualityLabel(5)).toBe("完璧");
  });
});

describe("getEFDescription", () => {
  it("EF に基づいて説明を返す", () => {
    expect(getEFDescription(2.6)).toBe("非常に良い");
    expect(getEFDescription(2.5)).toBe("非常に良い");
    expect(getEFDescription(2.3)).toBe("良い");
    expect(getEFDescription(2.0)).toBe("普通");
    expect(getEFDescription(1.6)).toBe("やや難しい");
    expect(getEFDescription(1.3)).toBe("難しい");
  });
});

describe("formatInterval", () => {
  it("1日は「1日」", () => {
    expect(formatInterval(1)).toBe("1日");
  });

  it("7日未満は「N日」", () => {
    expect(formatInterval(3)).toBe("3日");
    expect(formatInterval(6)).toBe("6日");
  });

  it("7日以上30日未満は「約N週間」", () => {
    expect(formatInterval(7)).toBe("約1週間");
    expect(formatInterval(14)).toBe("約2週間");
    expect(formatInterval(21)).toBe("約3週間");
  });

  it("30日以上365日未満は「約Nヶ月」", () => {
    expect(formatInterval(30)).toBe("約1ヶ月");
    expect(formatInterval(60)).toBe("約2ヶ月");
    expect(formatInterval(180)).toBe("約6ヶ月");
  });

  it("365日以上は「約N年」", () => {
    expect(formatInterval(365)).toBe("約1年");
    expect(formatInterval(730)).toBe("約2年");
  });
});
