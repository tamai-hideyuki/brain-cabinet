import * as analyticsRepo from "../../repositories/analyticsRepo";

// ============================================
// 型定義
// ============================================

export type DateRange = {
  start: number; // Unix timestamp (seconds)
  end: number;   // Unix timestamp (seconds)
};

export type TimeUnit = "day" | "week" | "month";

export type TimelinePoint = {
  date: string;           // YYYY-MM-DD
  totalSemanticDiff: number;
  changeCount: number;
};

export type JourneyPoint = {
  date: string;           // YYYY-MM-DD
  clusterId: number | null;
  noteId: string;
  title: string;
};

export type HeatmapDay = {
  date: string;           // YYYY-MM-DD
  count: number;          // ノート作成/更新数
  level: number;          // 0-4 (GitHub風の強度)
};

export type TrendItem = {
  period: string;         // "2025-01" or "2025-W01"
  clusterId: number;
  count: number;
};

// ============================================
// ユーティリティ関数
// ============================================

/**
 * 範囲文字列をパースして DateRange に変換
 * 例: "30d" → 過去30日, "90d" → 過去90日
 */
export const parseDateRange = (range: string): DateRange => {
  const now = Math.floor(Date.now() / 1000);
  const match = range.match(/^(\d+)([dwm])$/);

  if (!match) {
    // デフォルト: 過去30日
    return { start: now - 30 * 24 * 60 * 60, end: now };
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  let seconds: number;
  switch (unit) {
    case "d":
      seconds = value * 24 * 60 * 60;
      break;
    case "w":
      seconds = value * 7 * 24 * 60 * 60;
      break;
    case "m":
      seconds = value * 30 * 24 * 60 * 60; // 概算
      break;
    default:
      seconds = 30 * 24 * 60 * 60;
  }

  return { start: now - seconds, end: now };
};

/**
 * Unix timestamp を YYYY-MM-DD 形式に変換（ローカルタイムゾーン）
 */
export const timestampToDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Unix timestamp を YYYY-MM 形式に変換
 */
export const timestampToMonth = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Unix timestamp を YYYY-Www 形式に変換（ISO週番号）
 */
export const timestampToWeek = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const weekNumber = Math.ceil(dayOfYear / 7);
  return `${year}-W${String(weekNumber).padStart(2, "0")}`;
};

/**
 * Heatmap のレベルを計算（GitHub風 0-4）
 */
export const calculateHeatmapLevel = (count: number, maxCount: number): number => {
  if (count === 0) return 0;
  if (maxCount === 0) return 0;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
};

// ============================================
// 分析関数
// ============================================

/**
 * Semantic Diff Timeline を取得
 * 日ごとの意味的変化量の推移（ノート作成・更新も含む）
 */
export const getSemanticDiffTimeline = async (range: DateRange): Promise<TimelinePoint[]> => {
  // noteHistoryから変更履歴を取得
  const historyResults = await analyticsRepo.findNoteHistoryInRange(range.start, range.end);

  // notesから作成・更新を取得
  const noteResults = await analyticsRepo.findNoteTimestampsInRange(range.start);

  // 日付ごとに集計
  const dailyMap = new Map<string, { total: number; count: number }>();

  // noteHistory（変更履歴）を集計
  for (const row of historyResults) {
    const date = timestampToDate(row.createdAt);
    const diff = row.semanticDiff ? parseFloat(row.semanticDiff) : 0;

    const existing = dailyMap.get(date) ?? { total: 0, count: 0 };
    dailyMap.set(date, {
      total: existing.total + diff,
      count: existing.count + 1,
    });
  }

  // notes（作成）を集計
  for (const row of noteResults) {
    const createdDate = timestampToDate(row.createdAt);
    if (row.createdAt >= range.start && row.createdAt <= range.end) {
      const existing = dailyMap.get(createdDate) ?? { total: 0, count: 0 };
      dailyMap.set(createdDate, {
        total: existing.total,
        count: existing.count + 1,
      });
    }

    // 更新日が作成日と異なる場合のみカウント
    if (row.updatedAt !== row.createdAt && row.updatedAt >= range.start && row.updatedAt <= range.end) {
      const updatedDate = timestampToDate(row.updatedAt);
      const existing = dailyMap.get(updatedDate) ?? { total: 0, count: 0 };
      dailyMap.set(updatedDate, {
        total: existing.total,
        count: existing.count + 1,
      });
    }
  }

  // 配列に変換してソート
  const timeline: TimelinePoint[] = [];
  for (const [date, data] of dailyMap) {
    timeline.push({
      date,
      totalSemanticDiff: Math.round(data.total * 1000) / 1000,
      changeCount: data.count,
    });
  }

  return timeline.sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Cluster Journey を取得
 * ノートのクラスタ遷移履歴
 */
export const getClusterJourney = async (range: DateRange): Promise<JourneyPoint[]> => {
  const results = await analyticsRepo.findNotesWithClusterInRange(range.start, range.end);

  return results.map((row) => ({
    date: timestampToDate(row.createdAt),
    clusterId: row.clusterId,
    noteId: row.id,
    title: row.title,
  }));
};

/**
 * Daily Activity (Heatmap用) を取得
 * 指定年の日ごとのノート活動量
 */
export const getDailyActivity = async (year: number): Promise<HeatmapDay[]> => {
  const startOfYear = Math.floor(new Date(year, 0, 1).getTime() / 1000);
  const endOfYear = Math.floor(new Date(year, 11, 31, 23, 59, 59).getTime() / 1000);

  // ノート作成日を取得
  const createdResults = await analyticsRepo.findNoteCreationsInYear(startOfYear, endOfYear);

  // 履歴（更新）を取得
  const historyResults = await analyticsRepo.findNoteHistoryInYear(startOfYear, endOfYear);

  // 日付ごとにカウント
  const dailyMap = new Map<string, number>();

  for (const row of createdResults) {
    const date = timestampToDate(row.createdAt);
    dailyMap.set(date, (dailyMap.get(date) ?? 0) + 1);
  }

  for (const row of historyResults) {
    const date = timestampToDate(row.createdAt);
    dailyMap.set(date, (dailyMap.get(date) ?? 0) + 1);
  }

  // 最大値を計算
  const maxCount = Math.max(...Array.from(dailyMap.values()), 1);

  // 年間の全日付を生成（空の日も含む）
  const heatmap: HeatmapDay[] = [];
  const current = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);

  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];
    const count = dailyMap.get(dateStr) ?? 0;
    heatmap.push({
      date: dateStr,
      count,
      level: calculateHeatmapLevel(count, maxCount),
    });
    current.setDate(current.getDate() + 1);
  }

  return heatmap;
};

/**
 * Trend Stats を取得
 * 週/月ごとのクラスタ別ノート数
 */
export const getTrendStats = async (unit: TimeUnit, range: DateRange): Promise<TrendItem[]> => {
  const results = await analyticsRepo.findNotesWithClusterInRangeForTrend(range.start, range.end);

  // 期間ごとにクラスタ別カウント
  const trendMap = new Map<string, Map<number, number>>();

  for (const row of results) {
    const period = unit === "month"
      ? timestampToMonth(row.createdAt)
      : timestampToWeek(row.createdAt);
    const clusterId = row.clusterId!;

    if (!trendMap.has(period)) {
      trendMap.set(period, new Map());
    }
    const clusterMap = trendMap.get(period)!;
    clusterMap.set(clusterId, (clusterMap.get(clusterId) ?? 0) + 1);
  }

  // 配列に変換
  const trends: TrendItem[] = [];
  for (const [period, clusterMap] of trendMap) {
    for (const [clusterId, count] of clusterMap) {
      trends.push({ period, clusterId, count });
    }
  }

  return trends.sort((a, b) => {
    const periodCompare = a.period.localeCompare(b.period);
    if (periodCompare !== 0) return periodCompare;
    return a.clusterId - b.clusterId;
  });
};

/**
 * サマリー統計を取得
 */
export const getSummaryStats = async () => {
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

  // 総ノート数
  const totalNotes = await analyticsRepo.countAllNotes();

  // 過去30日のノート数
  const recentNotes = await analyticsRepo.countNotesSince(thirtyDaysAgo);

  // 過去30日の履歴数（変更回数）
  const recentChanges = await analyticsRepo.countHistorySince(thirtyDaysAgo);

  // 過去30日の平均 semantic diff
  const avgDiff = await analyticsRepo.getAvgSemanticDiffSince(thirtyDaysAgo);

  return {
    totalNotes,
    notesLast30Days: recentNotes,
    changesLast30Days: recentChanges,
    avgSemanticDiffLast30Days: avgDiff,
  };
};
