/**
 * Voice Evaluation Service
 *
 * クラスタ人格化出力の「観測者ルール」遵守度を評価する
 */

// ============================================================
// 型定義
// ============================================================

export interface ClusterPersonaOutput {
  clusterId: number;
  name: string;
  oneLiner: string;
  persona: {
    identity: {
      observation: string;
      voice: string;
    };
    thinkingStyle: string;
    motivation: string;
    strength: string;
    risk: string;
    roleInGrowth: string;
    currentState: {
      trend: string;
      driftContribution: number;
      cohesion: number;
    };
    future: string;
  };
}

export interface DetectedExpression {
  field: string;
  text: string;
  pattern: string;
  isAllowed: boolean; // voice フィールドは許容
}

export interface FieldEvaluation {
  field: string;
  assertionCount: number;
  causalCount: number;
  isVoiceField: boolean;
}

export interface EvaluationResult {
  clusterId: number;
  clusterName: string;
  evaluatedAt: string;
  promptVersion: string;

  // スコア
  totalSentences: number;
  assertionCount: number;
  causalCount: number;
  assertionRate: number; // 0-100
  causalRate: number; // 0-100
  structureSeparated: boolean;

  // 詳細
  detectedAssertions: DetectedExpression[];
  detectedCausals: DetectedExpression[];
  fieldEvaluations: FieldEvaluation[];

  // 生データ
  rawOutput: ClusterPersonaOutput;
}

export interface EvaluationReport {
  markdown: string;
  result: EvaluationResult;
}

// ============================================================
// パターン定義
// ============================================================

// 断定表現パターン
const ASSERTION_PATTERNS = [
  { pattern: /である[。、]?$/, label: "である" },
  { pattern: /だ[。、]?$/, label: "だ" },
  { pattern: /になる[。、]?$/, label: "になる" },
  { pattern: /を担う/, label: "を担う" },
  { pattern: /が中心/, label: "が中心" },
  { pattern: /を求める/, label: "を求める" },
  { pattern: /が鍵だ/, label: "が鍵だ" },
  { pattern: /は.*だ[。]?$/, label: "は〜だ" },
];

// 因果表現パターン
const CAUSAL_PATTERNS = [
  { pattern: /なぜなら/, label: "なぜなら" },
  { pattern: /だから/, label: "だから" },
  { pattern: /そのため/, label: "そのため" },
  { pattern: /ために/, label: "ために" },
  { pattern: /ので[、。]/, label: "ので" },
  { pattern: /によって/, label: "によって" },
  { pattern: /の結果/, label: "の結果" },
];

// voice フィールド（断定を許容）
const VOICE_FIELDS = ["identity.voice"];

// ============================================================
// 評価ロジック
// ============================================================

/**
 * テキストを文に分割
 */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/[。！？\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * フィールドから値を抽出（ネストしたフィールドに対応）
 */
function extractFieldValues(
  output: ClusterPersonaOutput
): Array<{ field: string; value: string }> {
  const results: Array<{ field: string; value: string }> = [];

  // トップレベル
  results.push({ field: "name", value: output.name });
  results.push({ field: "oneLiner", value: output.oneLiner });

  // persona 配下
  const persona = output.persona;
  if (persona.identity) {
    results.push({
      field: "identity.observation",
      value: persona.identity.observation || "",
    });
    results.push({
      field: "identity.voice",
      value: persona.identity.voice || "",
    });
  }
  results.push({ field: "thinkingStyle", value: persona.thinkingStyle || "" });
  results.push({ field: "motivation", value: persona.motivation || "" });
  results.push({ field: "strength", value: persona.strength || "" });
  results.push({ field: "risk", value: persona.risk || "" });
  results.push({ field: "roleInGrowth", value: persona.roleInGrowth || "" });
  results.push({ field: "future", value: persona.future || "" });

  return results.filter((r) => r.value.length > 0);
}

/**
 * 断定表現を検出
 */
function detectAssertions(
  text: string,
  field: string
): DetectedExpression[] {
  const detected: DetectedExpression[] = [];
  const sentences = splitIntoSentences(text);
  const isVoiceField = VOICE_FIELDS.includes(field);

  for (const sentence of sentences) {
    for (const { pattern, label } of ASSERTION_PATTERNS) {
      if (pattern.test(sentence)) {
        detected.push({
          field,
          text: sentence,
          pattern: label,
          isAllowed: isVoiceField,
        });
        break; // 1文に複数パターンがあっても1回だけカウント
      }
    }
  }

  return detected;
}

/**
 * 因果表現を検出
 */
function detectCausals(
  text: string,
  field: string
): DetectedExpression[] {
  const detected: DetectedExpression[] = [];
  const sentences = splitIntoSentences(text);
  const isVoiceField = VOICE_FIELDS.includes(field);

  for (const sentence of sentences) {
    for (const { pattern, label } of CAUSAL_PATTERNS) {
      if (pattern.test(sentence)) {
        detected.push({
          field,
          text: sentence,
          pattern: label,
          isAllowed: isVoiceField,
        });
        break;
      }
    }
  }

  return detected;
}

/**
 * 構造分離の確認（identity が observation/voice に分かれているか）
 */
function checkStructureSeparation(output: ClusterPersonaOutput): boolean {
  const identity = output.persona?.identity;
  if (!identity) return false;

  return (
    typeof identity === "object" &&
    "observation" in identity &&
    "voice" in identity &&
    typeof identity.observation === "string" &&
    typeof identity.voice === "string"
  );
}

/**
 * クラスタ人格化出力を評価
 */
export function evaluatePersonaOutput(
  output: ClusterPersonaOutput,
  promptVersion: string = "unknown"
): EvaluationResult {
  const fieldValues = extractFieldValues(output);

  let totalSentences = 0;
  const allAssertions: DetectedExpression[] = [];
  const allCausals: DetectedExpression[] = [];
  const fieldEvaluations: FieldEvaluation[] = [];

  for (const { field, value } of fieldValues) {
    const sentences = splitIntoSentences(value);
    const assertions = detectAssertions(value, field);
    const causals = detectCausals(value, field);
    const isVoiceField = VOICE_FIELDS.includes(field);

    totalSentences += sentences.length;
    allAssertions.push(...assertions);
    allCausals.push(...causals);

    fieldEvaluations.push({
      field,
      assertionCount: assertions.length,
      causalCount: causals.length,
      isVoiceField,
    });
  }

  // voice フィールド以外の断定をカウント
  const nonAllowedAssertions = allAssertions.filter((a) => !a.isAllowed);
  const nonAllowedCausals = allCausals.filter((c) => !c.isAllowed);

  const assertionRate =
    totalSentences > 0
      ? Math.round((nonAllowedAssertions.length / totalSentences) * 100)
      : 0;
  const causalRate =
    totalSentences > 0
      ? Math.round((nonAllowedCausals.length / totalSentences) * 100)
      : 0;

  return {
    clusterId: output.clusterId,
    clusterName: output.name,
    evaluatedAt: new Date().toISOString(),
    promptVersion,

    totalSentences,
    assertionCount: nonAllowedAssertions.length,
    causalCount: nonAllowedCausals.length,
    assertionRate,
    causalRate,
    structureSeparated: checkStructureSeparation(output),

    detectedAssertions: allAssertions,
    detectedCausals: allCausals,
    fieldEvaluations,

    rawOutput: output,
  };
}

/**
 * 評価結果をMarkdownレポートに変換
 */
export function generateMarkdownReport(result: EvaluationResult): string {
  const lines: string[] = [];

  lines.push("## Voice Evaluation Report");
  lines.push(`- クラスタID: ${result.clusterId}`);
  lines.push(`- クラスタ名: ${result.clusterName}`);
  lines.push(`- 評価日時: ${result.evaluatedAt}`);
  lines.push(`- プロンプトバージョン: ${result.promptVersion}`);
  lines.push("");

  lines.push("### スコア");
  lines.push(
    `- 断定率: ${result.assertionRate}% (${result.assertionCount}/${result.totalSentences}文)`
  );
  lines.push(
    `- 因果率: ${result.causalRate}% (${result.causalCount}/${result.totalSentences}文)`
  );
  lines.push(`- 構造分離: ${result.structureSeparated ? "✅" : "❌"}`);
  lines.push("");

  // 検出された断定表現（voice以外）
  const nonAllowedAssertions = result.detectedAssertions.filter(
    (a) => !a.isAllowed
  );
  if (nonAllowedAssertions.length > 0) {
    lines.push("### ⚠️ 検出された断定表現");
    for (const expr of nonAllowedAssertions) {
      lines.push(`- [${expr.field}] 「${expr.text}」 (${expr.pattern})`);
    }
    lines.push("");
  }

  // 検出された因果表現（voice以外）
  const nonAllowedCausals = result.detectedCausals.filter((c) => !c.isAllowed);
  if (nonAllowedCausals.length > 0) {
    lines.push("### ⚠️ 検出された因果表現");
    for (const expr of nonAllowedCausals) {
      lines.push(`- [${expr.field}] 「${expr.text}」 (${expr.pattern})`);
    }
    lines.push("");
  }

  // voice フィールドの断定（許容）
  const allowedAssertions = result.detectedAssertions.filter(
    (a) => a.isAllowed
  );
  if (allowedAssertions.length > 0) {
    lines.push("### ✅ 人格の声（断定許容）");
    for (const expr of allowedAssertions) {
      lines.push(`- [${expr.field}] 「${expr.text}」`);
    }
    lines.push("");
  }

  // フィールド別スコア
  lines.push("### フィールド別評価");
  for (const fe of result.fieldEvaluations) {
    const status =
      fe.isVoiceField || (fe.assertionCount === 0 && fe.causalCount === 0)
        ? "✅"
        : "⚠️";
    const note = fe.isVoiceField ? "（断定許容）" : "";
    lines.push(
      `- ${fe.field}: ${status} 断定${fe.assertionCount}件 / 因果${fe.causalCount}件 ${note}`
    );
  }

  return lines.join("\n");
}

/**
 * 評価を実行してレポートを生成
 */
export function evaluate(
  output: ClusterPersonaOutput,
  promptVersion: string = "v7.1.0-observer"
): EvaluationReport {
  const result = evaluatePersonaOutput(output, promptVersion);
  const markdown = generateMarkdownReport(result);
  return { markdown, result };
}
