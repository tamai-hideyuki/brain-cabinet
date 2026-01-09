/**
 * Thinking Report API Routes
 *
 * 思考成長レポートのAPIエンドポイント
 */

import { Hono } from "hono";
import {
  generateWeeklyReport,
  getGuideQuestions,
  checkChallengeProgress,
  PERSPECTIVES,
  PERSPECTIVE_LABELS,
  Perspective,
} from "../../services/thinkingReport";
import {
  generateAllClusterLabels,
  regenerateClusterLabel,
} from "../../services/cluster/clusterLabelService";
import { db } from "../../db/client";
import { sql } from "drizzle-orm";

export const thinkingReportRoute = new Hono();

/**
 * GET /api/thinking-report/weekly
 * 週次レポートを取得
 */
thinkingReportRoute.get("/weekly", async (c) => {
  const dateParam = c.req.query("date");
  const targetDate = dateParam ? new Date(dateParam) : undefined;

  try {
    const report = await generateWeeklyReport(targetDate);

    return c.json({
      success: true,
      report: {
        period: {
          start: report.periodStart,
          end: report.periodEnd,
        },

        // 森: 全体傾向
        forest: {
          phase: {
            current: report.forest.currentPhase,
            transition: report.forest.phaseTransition,
          },
          bias: report.forest.biasAlert,
          blindSpots: report.forest.blindSpots,
          metrics: {
            totalNotes: report.forest.totalNotes,
            notesAdded: report.forest.notesAdded,
            avgCohesion: report.forest.avgCohesion,
            changeScore: report.forest.changeScore,
          },
        },

        // 木: 詳細
        trees: {
          topGrowth: report.trees.topGrowth.map((g) => ({
            identityId: g.identityId,
            label: g.label,
            notesDelta: g.notesDelta,
            cohesionDelta: Math.round(g.cohesionDelta * 100) / 100,
            currentSize: g.currentSize,
            currentCohesion: g.currentCohesion,
          })),
          events: report.trees.events,
          newThoughts: report.trees.newThoughts,
          extinctThoughts: report.trees.extinctThoughts,
        },

        // フェーズ1.5: 他者視点の問い
        perspectiveQuestions: report.perspectiveQuestions.map((q) => ({
          perspective: q.perspective,
          perspectiveLabel: PERSPECTIVE_LABELS[q.perspective],
          question: q.question,
        })),

        // フェーズ2: 視点分布
        perspectiveDistribution: report.perspectiveDistribution
          ? Object.entries(report.perspectiveDistribution).map(
              ([perspective, percentage]) => ({
                perspective,
                perspectiveLabel:
                  PERSPECTIVE_LABELS[perspective as Perspective],
                percentage,
              })
            )
          : null,

        // フェーズ2.5: 週次チャレンジ
        weeklyChallenge: report.weeklyChallenge
          ? {
              perspective: report.weeklyChallenge.targetPerspective,
              perspectiveLabel:
                PERSPECTIVE_LABELS[report.weeklyChallenge.targetPerspective],
              question: report.weeklyChallenge.question,
              reason: report.weeklyChallenge.reason,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("[ThinkingReport] Error generating weekly report:", error);
    return c.json(
      {
        success: false,
        error: "Failed to generate weekly report",
      },
      500
    );
  }
});

/**
 * GET /api/thinking-report/perspectives
 * 利用可能な視点一覧を取得
 */
thinkingReportRoute.get("/perspectives", async (c) => {
  return c.json({
    perspectives: PERSPECTIVES.map((p) => ({
      id: p,
      label: PERSPECTIVE_LABELS[p],
    })),
  });
});

/**
 * GET /api/thinking-report/perspectives/:id/guide
 * 特定視点のガイド質問を取得（フェーズ3用）
 */
thinkingReportRoute.get("/perspectives/:id/guide", async (c) => {
  const perspectiveId = c.req.param("id") as Perspective;

  if (!PERSPECTIVES.includes(perspectiveId)) {
    return c.json({ error: "Invalid perspective ID" }, 400);
  }

  const questions = getGuideQuestions(perspectiveId);

  return c.json({
    perspective: perspectiveId,
    perspectiveLabel: PERSPECTIVE_LABELS[perspectiveId],
    guideQuestions: questions,
  });
});

/**
 * GET /api/thinking-report/challenge/progress
 * チャレンジ達成状況を取得
 */
thinkingReportRoute.get("/challenge/progress", async (c) => {
  const weekStart = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  // 前回のチャレンジを取得（簡易実装：最も不足している視点を推定）
  const targetPerspective: Perspective = "po"; // TODO: 実際のチャレンジ履歴から取得

  const progress = await checkChallengeProgress(weekStart, targetPerspective);

  return c.json({
    weekStart,
    targetPerspective,
    perspectiveLabel: PERSPECTIVE_LABELS[targetPerspective],
    ...progress,
  });
});

/**
 * GET /api/thinking-report/distribution
 * 視点分布の詳細を取得
 */
thinkingReportRoute.get("/distribution", async (c) => {
  const periodParam = c.req.query("period") || "week";
  const now = Math.floor(Date.now() / 1000);

  let startTime: number;
  switch (periodParam) {
    case "month":
      startTime = now - 30 * 24 * 60 * 60;
      break;
    case "all":
      startTime = 0;
      break;
    default:
      startTime = now - 7 * 24 * 60 * 60;
  }

  // perspective カラムの存在確認
  const hasColumn = await db.get<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM pragma_table_info('notes')
    WHERE name = 'perspective'
  `);

  if (!hasColumn || hasColumn.count === 0) {
    return c.json({
      success: true,
      hasData: false,
      period: periodParam,
      message: "perspective column not found. Please run migration.",
      distribution: null,
    });
  }

  // 視点別のノート数を集計
  const rows = await db.all<{
    perspective: string | null;
    count: number;
  }>(sql`
    SELECT perspective, COUNT(*) as count
    FROM notes
    WHERE deleted_at IS NULL
    AND (created_at >= ${startTime} OR updated_at >= ${startTime})
    GROUP BY perspective
    ORDER BY count DESC
  `);

  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const withPerspective = rows
    .filter((r) => r.perspective !== null)
    .reduce((sum, r) => sum + r.count, 0);

  const distribution = PERSPECTIVES.map((p) => {
    const row = rows.find((r) => r.perspective === p);
    const count = row?.count ?? 0;
    return {
      perspective: p,
      perspectiveLabel: PERSPECTIVE_LABELS[p],
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });

  return c.json({
    success: true,
    hasData: withPerspective > 0,
    period: periodParam,
    total,
    withPerspective,
    withoutPerspective: total - withPerspective,
    tagRate: total > 0 ? Math.round((withPerspective / total) * 100) : 0,
    distribution,
  });
});

/**
 * POST /api/thinking-report/migrate
 * perspective カラムを追加（マイグレーション）
 */
thinkingReportRoute.post("/migrate", async (c) => {
  try {
    // カラムの存在確認
    const hasColumn = await db.get<{ count: number }>(sql`
      SELECT COUNT(*) as count FROM pragma_table_info('notes')
      WHERE name = 'perspective'
    `);

    if (hasColumn && hasColumn.count > 0) {
      return c.json({
        success: true,
        message: "perspective column already exists",
        migrated: false,
      });
    }

    // カラムを追加
    await db.run(sql`ALTER TABLE notes ADD COLUMN perspective TEXT`);

    return c.json({
      success: true,
      message: "perspective column added successfully",
      migrated: true,
    });
  } catch (error) {
    console.error("[ThinkingReport] Migration error:", error);
    return c.json(
      {
        success: false,
        error: "Migration failed",
      },
      500
    );
  }
});

/**
 * POST /api/thinking-report/labels/generate
 * 全クラスタのラベルを自動生成
 * クエリパラメータ: force=true で既存ラベルも再生成
 */
thinkingReportRoute.post("/labels/generate", async (c) => {
  try {
    const forceRegenerate = c.req.query("force") === "true";
    const result = await generateAllClusterLabels(forceRegenerate);

    return c.json({
      success: true,
      message: `${result.updated} clusters labeled, ${result.failed} failed`,
      ...result,
    });
  } catch (error) {
    console.error("[ThinkingReport] Error generating cluster labels:", error);
    return c.json(
      {
        success: false,
        error: "Failed to generate cluster labels",
      },
      500
    );
  }
});

/**
 * GET /api/thinking-report/clusters/:identityId/notes
 * 特定クラスタに属するノート一覧を取得
 */
thinkingReportRoute.get("/clusters/:identityId/notes", async (c) => {
  const identityId = parseInt(c.req.param("identityId"), 10);

  if (isNaN(identityId)) {
    return c.json({ error: "Invalid identity ID" }, 400);
  }

  try {
    // クラスタに属するノートを取得（snapshot_note_assignments経由）
    let notes = await db.all<{
      id: string;
      title: string | null;
      content: string;
      created_at: number;
    }>(sql`
      SELECT DISTINCT n.id, n.title, n.content, n.created_at
      FROM notes n
      JOIN snapshot_note_assignments sna ON n.id = sna.note_id
      JOIN snapshot_clusters sc ON sna.snapshot_id = sc.snapshot_id AND sna.cluster_id = sc.id
      WHERE sc.identity_id = ${identityId}
      AND n.deleted_at IS NULL
      ORDER BY n.created_at DESC
      LIMIT 20
    `);

    // snapshot経由で見つからない場合は直接cluster_idで検索
    if (notes.length === 0) {
      notes = await db.all<{
        id: string;
        title: string | null;
        content: string;
        created_at: number;
      }>(sql`
        SELECT id, title, content, created_at
        FROM notes
        WHERE cluster_id IN (
          SELECT sc.local_id
          FROM snapshot_clusters sc
          WHERE sc.identity_id = ${identityId}
        )
        AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 20
      `);
    }

    // タイトルがない場合はcontentの最初の50文字を使用
    const formattedNotes = notes.map((n) => ({
      id: n.id,
      title: n.title || n.content.slice(0, 50) + (n.content.length > 50 ? "..." : ""),
      createdAt: n.created_at,
    }));

    return c.json({
      success: true,
      identityId,
      notes: formattedNotes,
      total: formattedNotes.length,
    });
  } catch (error) {
    console.error("[ThinkingReport] Error fetching cluster notes:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch cluster notes",
      },
      500
    );
  }
});

/**
 * POST /api/thinking-report/labels/:identityId/regenerate
 * 特定クラスタのラベルを再生成
 */
thinkingReportRoute.post("/labels/:identityId/regenerate", async (c) => {
  const identityId = parseInt(c.req.param("identityId"), 10);

  if (isNaN(identityId)) {
    return c.json({ error: "Invalid identity ID" }, 400);
  }

  try {
    const label = await regenerateClusterLabel(identityId);

    if (!label) {
      return c.json(
        {
          success: false,
          error: "Could not generate label (no notes found)",
        },
        404
      );
    }

    return c.json({
      success: true,
      identityId,
      label,
    });
  } catch (error) {
    console.error("[ThinkingReport] Error regenerating cluster label:", error);
    return c.json(
      {
        success: false,
        error: "Failed to regenerate cluster label",
      },
      500
    );
  }
});
