/**
 * GPT Voice Evaluation Route
 *
 * GPT が生成した人格化出力を評価・保存するエンドポイント
 */

import { Hono } from "hono";
import {
  evaluate,
  type ClusterPersonaOutput,
} from "../../services/voiceEvaluation";
import { db } from "../../db/client";
import { voiceEvaluationLogs } from "../../db/schema";

export const voiceEvaluationRoute = new Hono();

/**
 * POST /api/gpt/voice-evaluation
 *
 * GPT が生成した人格化出力を評価して保存
 *
 * Request Body:
 *   - output: ClusterPersonaOutput (GPT が生成した人格化出力)
 *   - promptVersion?: string (使用したプロンプトのバージョン)
 */
voiceEvaluationRoute.post("/voice-evaluation", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  if (!body.output) {
    return c.json({ error: "output is required" }, 400);
  }

  const output = body.output as ClusterPersonaOutput;
  const promptVersion = body.promptVersion ?? "v7.1.0-observer";

  // 必須フィールドの検証
  if (
    typeof output.clusterId !== "number" ||
    typeof output.name !== "string" ||
    !output.persona
  ) {
    return c.json(
      {
        error: "Invalid output format. Required: clusterId (number), name (string), persona (object)",
      },
      400
    );
  }

  const { markdown, result } = evaluate(output, promptVersion);

  // DBに保存
  await db.insert(voiceEvaluationLogs).values({
    clusterId: result.clusterId,
    clusterName: result.clusterName,
    promptVersion: result.promptVersion,
    totalSentences: result.totalSentences,
    assertionCount: result.assertionCount,
    causalCount: result.causalCount,
    assertionRate: result.assertionRate,
    causalRate: result.causalRate,
    structureSeparated: result.structureSeparated ? 1 : 0,
    detectedExpressions: JSON.stringify({
      assertions: result.detectedAssertions,
      causals: result.detectedCausals,
    }),
    rawOutput: JSON.stringify(result.rawOutput),
  });

  return c.json({
    message: "Voice evaluation saved successfully",
    summary: {
      clusterId: result.clusterId,
      clusterName: result.clusterName,
      assertionRate: result.assertionRate,
      causalRate: result.causalRate,
      structureSeparated: result.structureSeparated,
    },
    markdown,
  });
});
