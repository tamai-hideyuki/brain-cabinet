# 関数型DDD移行計画書

> Brain Cabinet v5.2.0 → v6.0.0 アーキテクチャ刷新

---

## 目次

1. [概要](#概要)
2. [関数型DDDとは](#関数型dddとは)
3. [現状分析](#現状分析)
4. [移行方針](#移行方針)
5. [フェーズ別計画](#フェーズ別計画)
6. [ドメイン別設計](#ドメイン別設計)
7. [共通基盤](#共通基盤)
8. [テスト戦略](#テスト戦略)
9. [移行チェックリスト](#移行チェックリスト)
10. [リスクと対策](#リスクと対策)

---

## 概要

### 目的

Brain Cabinetのビジネスロジックを**関数型DDD**で再設計し、以下を実現する：

| 目標 | 現状 | 移行後 |
|------|------|--------|
| テスト容易性 | DBモック必須 | 純粋関数でユニットテスト |
| ドメイン知識の明示性 | コメント頼み | 型と関数で表現 |
| バグ耐性 | 実行時エラー | コンパイル時検出 |
| コードの再利用性 | サービス層に固定 | 関数合成で柔軟に |

### スコープ

```
対象:
  ✅ src/services/ 全体（16,297行）
  ✅ src/dispatchers/ の一部ロジック
  ✅ ドメイン型定義

対象外:
  ❌ src/routes/ （薄いまま維持）
  ❌ src/repositories/ （インフラ層として維持）
  ❌ ui/ （フロントエンドは別計画）
```

### バージョン計画

| バージョン | 内容 |
|-----------|------|
| v5.3.0 | 共通基盤（Result型、値オブジェクト基盤） |
| v5.4.0 | Phase 1: Reviewドメイン |
| v5.5.0 | Phase 2: Decisionドメイン |
| v5.6.0 | Phase 3: Driftドメイン |
| v6.0.0 | 全ドメイン移行完了、レガシーサービス削除 |

---

## 関数型DDDとは

### 3つの柱

```
┌─────────────────────────────────────────────────────────┐
│                    関数型DDD                            │
├─────────────────┬─────────────────┬─────────────────────┤
│  型によるモデリング │  純粋関数        │  関数合成           │
│                 │                 │                     │
│  - 値オブジェクト   │  - 副作用なし     │  - パイプライン      │
│  - 代数的データ型  │  - 入力→出力のみ  │  - 小さな関数を結合   │
│  - 制約を型で表現  │  - テスト容易     │  - ワークフロー構築   │
└─────────────────┴─────────────────┴─────────────────────┘
```

### OOP DDDとの比較

```typescript
// ❌ OOP DDD: オブジェクトが状態を持つ
class ReviewSchedule {
  private state: SM2State;

  submitResult(quality: number): void {
    this.state = this.calculateNext(quality);  // 状態変更
    this.save();  // 副作用
  }
}

// ✅ 関数型DDD: イミュータブル + 純粋関数
type SM2State = Readonly<{ ef: EasinessFactor; interval: Days; rep: number }>

const calculateNext = (quality: Quality, state: SM2State): SM2State => ({
  ef: updateEF(state.ef, quality),
  interval: calculateInterval(state, quality),
  rep: quality >= 3 ? state.rep + 1 : 0,
})

// 副作用は端に追いやる
const submitReview = pipe(
  validateInput,
  calculateNext,
  toResult,
)
// 永続化は呼び出し側で
```

### 関数合成のイメージ

```typescript
// 型が合えば繋がる
f: (A) => B
g: (B) => C
h: (C) => D

pipe(f, g, h): (A) => D

// Brain Cabinetでの例
const processReview = pipe(
  validateQuality,        // Input → Result<Quality, Error>
  calculateSM2,          // Quality → SM2State
  createReviewResult,    // SM2State → ReviewResult
  formatResponse,        // ReviewResult → APIResponse
)
```

---

## 現状分析

### サービス層の問題点

| ファイル | 行数 | 問題 |
|---------|------|------|
| review/index.ts | 623 | SM2ロジックとDB操作が混在 |
| decision/index.ts | 471 | 5責務混在（検索/分類/フィルタ/スコア/ソート） |
| promotion/index.ts | 355 | 昇格ルールが命令型で分散 |
| drift/driftCore.ts | 270+ | マジックナンバー多数 |
| cluster/clusterDynamicsService.ts | 270 | 統計処理が分散 |

### 既に関数型的な部分（活用可能）

```typescript
// src/services/review/sm2/index.ts - 純粋関数として実装済み
export function calculateSM2(
  quality: RecallQuality,
  currentState: SM2State
): SM2Result {
  // 副作用なし、入力→出力のみ
}
```

### 値オブジェクト候補

| 候補 | 現状 | 問題 |
|------|------|------|
| EasinessFactor | `number` | 1.3以上の制約がない |
| ReviewInterval | `number` | 0以下の可能性 |
| Quality | `0-5` | ユニオン型で定義済み（良い） |
| Confidence | `number` | 0.0-1.0の制約がない |
| NoteType | ユニオン型 | 遷移ルールが暗黙的 |
| DecayProfile | ユニオン型 | 良い |

---

## 移行方針

### 原則

1. **段階的置き換え**: 既存サービスを維持しながら並行実装
2. **アダプターパターン**: 新旧を橋渡しして共存
3. **テストファースト**: ドメインロジックは100%テストカバレッジ
4. **副作用の分離**: 純粋関数とIO操作を明確に分ける

### ディレクトリ構造（移行後）

```
src/
├── domains/                    # 新規：ドメイン層
│   ├── shared/                 # 共通基盤
│   │   ├── types/
│   │   │   ├── Result.ts       # Result<T, E> 型
│   │   │   ├── Option.ts       # Option<T> 型
│   │   │   └── Brand.ts        # ブランド型ユーティリティ
│   │   ├── value-objects/
│   │   │   └── ValueObject.ts  # 基底クラス
│   │   └── errors/
│   │       └── DomainError.ts  # ドメインエラー基底
│   │
│   ├── review/                 # Reviewドメイン
│   │   ├── value-objects/
│   │   │   ├── EasinessFactor.ts
│   │   │   ├── ReviewInterval.ts
│   │   │   ├── Quality.ts
│   │   │   └── Repetition.ts
│   │   ├── types/
│   │   │   ├── SM2State.ts
│   │   │   ├── ReviewSchedule.ts
│   │   │   └── ReviewResult.ts
│   │   ├── functions/
│   │   │   ├── calculateSM2.ts
│   │   │   ├── validateQuality.ts
│   │   │   └── previewIntervals.ts
│   │   ├── policies/
│   │   │   ├── SM2Policy.ts
│   │   │   └── QuestionGenerationPolicy.ts
│   │   ├── pipelines/
│   │   │   ├── submitReviewPipeline.ts
│   │   │   └── scheduleReviewPipeline.ts
│   │   └── errors/
│   │       ├── InvalidEasinessFactor.ts
│   │       └── ScheduleNotFound.ts
│   │
│   ├── decision/               # Decisionドメイン
│   │   ├── value-objects/
│   │   │   ├── Confidence.ts
│   │   │   ├── Intent.ts
│   │   │   └── EffectiveScore.ts
│   │   ├── types/
│   │   │   ├── Decision.ts
│   │   │   ├── ScratchNote.ts
│   │   │   └── PromotionCandidate.ts
│   │   ├── functions/
│   │   │   ├── classifyNote.ts
│   │   │   ├── calculateEffectiveScore.ts
│   │   │   └── applyTimeDecay.ts
│   │   ├── policies/
│   │   │   └── PromotionPolicy.ts
│   │   └── pipelines/
│   │       ├── searchDecisionsPipeline.ts
│   │       └── checkPromotionPipeline.ts
│   │
│   └── drift/                  # Driftドメイン
│       ├── value-objects/
│       │   ├── DriftScore.ts
│       │   ├── GrowthAngle.ts
│       │   └── StabilityScore.ts
│       ├── types/
│       │   ├── DriftConfig.ts
│       │   ├── DriftInsight.ts
│       │   └── ClusterDynamics.ts
│       ├── functions/
│       │   ├── calculateEMA.ts
│       │   ├── detectTrend.ts
│       │   └── calculateCohesion.ts
│       └── pipelines/
│           └── analyzeDriftPipeline.ts
│
├── services/                   # 既存：アプリケーション層（徐々に薄くなる）
│   ├── review/
│   │   ├── index.ts            # レガシー（維持→削除）
│   │   └── reviewService.ts    # 新：ドメイン層を呼び出すだけ
│   └── ...
│
├── repositories/               # 既存：インフラ層（維持）
└── dispatchers/                # 既存：API層（維持）
```

---

## フェーズ別計画

### Phase 0: 共通基盤（v5.3.0）

**目標**: 全ドメインで使う型とユーティリティを整備

```
作業内容:
├── Result<T, E> 型の実装
├── Option<T> 型の実装
├── pipe / flow 関数の実装
├── Brand型（Nominal Typing）の実装
├── DomainError 基底クラス
└── ValueObject 基底クラス
```

**成果物**:

```typescript
// src/domains/shared/types/Result.ts
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error })

export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> =>
  result.ok ? ok(fn(result.value)) : result

export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> =>
  result.ok ? fn(result.value) : result

// src/domains/shared/types/Brand.ts
declare const brand: unique symbol
export type Brand<T, B> = T & { readonly [brand]: B }

// 使用例
type NoteId = Brand<string, 'NoteId'>
type EasinessFactor = Brand<number, 'EasinessFactor'>
```

**テスト**: 100%カバレッジ必須

---

### Phase 1: Reviewドメイン（v5.4.0）

**目標**: SM-2アルゴリズムと関連ロジックを関数型DDDで再実装

**優先度**: ⭐⭐⭐（最高）

**理由**:
- 既に `calculateSM2` が純粋関数として存在
- 数学的ロジックが明確で移行しやすい
- テスト効果が最も高い

#### 1.1 値オブジェクト

```typescript
// src/domains/review/value-objects/EasinessFactor.ts
import { Brand } from '../../shared/types/Brand'
import { Result, ok, err } from '../../shared/types/Result'

export type EasinessFactor = Brand<number, 'EasinessFactor'>

export const MIN_EF = 1.3
export const DEFAULT_EF = 2.5

export class InvalidEasinessFactor extends Error {
  constructor(public readonly value: number) {
    super(`EasinessFactor must be >= ${MIN_EF}, got ${value}`)
    this.name = 'InvalidEasinessFactor'
  }
}

export const createEF = (value: number): Result<EasinessFactor, InvalidEasinessFactor> => {
  if (value < MIN_EF) {
    return err(new InvalidEasinessFactor(value))
  }
  return ok(Math.round(value * 100) / 100 as EasinessFactor)
}

export const initialEF = (): EasinessFactor => DEFAULT_EF as EasinessFactor

export const updateEF = (ef: EasinessFactor, quality: Quality): EasinessFactor => {
  const newEF = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  return Math.max(MIN_EF, Math.round(newEF * 100) / 100) as EasinessFactor
}

export const describeEF = (ef: EasinessFactor): string => {
  if (ef >= 2.5) return '非常に良い'
  if (ef >= 2.2) return '良い'
  if (ef >= 1.8) return '普通'
  if (ef >= 1.5) return 'やや難しい'
  return '難しい'
}

// src/domains/review/value-objects/ReviewInterval.ts
export type ReviewInterval = Brand<number, 'ReviewInterval'>

export const createInterval = (days: number): Result<ReviewInterval, InvalidInterval> => {
  if (days < 1 || !Number.isInteger(days)) {
    return err(new InvalidInterval(days))
  }
  return ok(days as ReviewInterval)
}

export const initialInterval = (): ReviewInterval => 1 as ReviewInterval

export const multiplyInterval = (
  interval: ReviewInterval,
  factor: number
): ReviewInterval =>
  Math.max(1, Math.round(interval * factor)) as ReviewInterval

export const formatInterval = (interval: ReviewInterval): string => {
  if (interval === 1) return '1日'
  if (interval < 7) return `${interval}日`
  if (interval < 30) return `約${Math.round(interval / 7)}週間`
  if (interval < 365) return `約${Math.round(interval / 30)}ヶ月`
  return `約${Math.round(interval / 365)}年`
}
```

#### 1.2 ドメイン型

```typescript
// src/domains/review/types/SM2State.ts
export type SM2State = Readonly<{
  ef: EasinessFactor
  interval: ReviewInterval
  repetition: number
}>

export const initialSM2State = (): SM2State => ({
  ef: initialEF(),
  interval: initialInterval(),
  repetition: 0,
})

// src/domains/review/types/ReviewResult.ts
export type ReviewResult = Readonly<{
  previousState: SM2State
  newState: SM2State
  nextReviewAt: Date
  qualityLabel: string
  efDescription: string
}>
```

#### 1.3 純粋関数

```typescript
// src/domains/review/functions/calculateSM2.ts
export const calculateSM2 = (
  quality: Quality,
  state: SM2State
): SM2State => {
  const newEF = updateEF(state.ef, quality)

  if (quality < 3) {
    // 失敗: リセット
    return {
      ef: newEF,
      interval: initialInterval(),
      repetition: 0,
    }
  }

  // 成功: 間隔拡大
  const newRep = state.repetition + 1
  const newInterval =
    newRep === 1 ? 1 as ReviewInterval :
    newRep === 2 ? 6 as ReviewInterval :
    multiplyInterval(state.interval, newEF)

  return {
    ef: newEF,
    interval: newInterval,
    repetition: newRep,
  }
}

// src/domains/review/functions/previewIntervals.ts
export const previewIntervals = (
  state: SM2State,
  qualities: Quality[] = [0, 3, 5]
): PreviewResult[] =>
  qualities.map(quality => {
    const next = calculateSM2(quality, state)
    return {
      quality,
      nextInterval: next.interval,
      nextEF: next.ef,
    }
  })
```

#### 1.4 パイプライン

```typescript
// src/domains/review/pipelines/submitReviewPipeline.ts
import { pipe } from '../../shared/functions/pipe'
import { Result, flatMap, map } from '../../shared/types/Result'

type SubmitInput = {
  scheduleId: number
  quality: number
  currentState: SM2State
}

type SubmitOutput = {
  newState: SM2State
  nextReviewAt: Date
  qualityLabel: string
}

// 各ステップは純粋関数
const validateQuality = (input: SubmitInput): Result<SubmitInput & { quality: Quality }, ValidationError> => {
  if (!isValidQuality(input.quality)) {
    return err(new ValidationError('quality', `Must be 0-5, got ${input.quality}`))
  }
  return ok({ ...input, quality: input.quality as Quality })
}

const applyCalculation = (input: SubmitInput & { quality: Quality }): SubmitOutput => {
  const newState = calculateSM2(input.quality, input.currentState)
  const nextReviewAt = addDays(new Date(), newState.interval)
  return {
    newState,
    nextReviewAt,
    qualityLabel: describeQuality(input.quality),
  }
}

// パイプライン定義（純粋）
export const submitReviewPipeline = (input: SubmitInput): Result<SubmitOutput, ValidationError> =>
  pipe(
    validateQuality(input),
    result => map(result, applyCalculation)
  )

// アプリケーション層で副作用を実行
// src/services/review/reviewService.ts
export const submitReview = async (input: SubmitInput): Promise<Result<SubmitOutput, AppError>> => {
  // 1. 純粋なパイプライン実行
  const result = submitReviewPipeline(input)

  if (!result.ok) {
    return err(result.error.toAppError())
  }

  // 2. 副作用（永続化）
  await updateScheduleInDB(input.scheduleId, result.value.newState)
  await logReviewSession(input.scheduleId, input.quality)

  return result
}
```

#### 1.5 移行手順

```
Week 1:
├── 値オブジェクト実装（EasinessFactor, ReviewInterval, Quality）
├── ユニットテスト作成
└── 既存 sm2/index.ts との結果比較テスト

Week 2:
├── SM2State, ReviewResult 型定義
├── calculateSM2 関数の新実装
├── previewIntervals 関数
└── プロパティベーステスト追加

Week 3:
├── submitReviewPipeline 実装
├── scheduleReviewPipeline 実装
├── アダプター作成（新旧橋渡し）
└── 統合テスト

Week 4:
├── reviewService.ts 書き換え（ドメイン層呼び出し）
├── reviewDispatcher.ts 動作確認
├── レガシーコード削除
└── ドキュメント更新
```

---

### Phase 2: Decisionドメイン（v5.5.0）

**目標**: Decision-First分類と昇格ルールを関数型DDDで再実装

**優先度**: ⭐⭐⭐（最高）

**理由**:
- ビジネスルールが複雑で分散している
- 昇格という重要な機能
- 時間減衰（DecayProfile）の概念を明確化

#### 2.1 値オブジェクト

```typescript
// src/domains/decision/value-objects/Confidence.ts
export type Confidence = Brand<number, 'Confidence'>

export const createConfidence = (value: number): Result<Confidence, InvalidConfidence> => {
  if (value < 0 || value > 1) {
    return err(new InvalidConfidence(value))
  }
  return ok(Math.round(value * 1000) / 1000 as Confidence)
}

export const isNearThreshold = (conf: Confidence, threshold: number): boolean =>
  conf >= threshold - 0.1 && conf < threshold

export const delta = (a: Confidence, b: Confidence): number =>
  Math.abs(a - b)

// src/domains/decision/value-objects/EffectiveScore.ts
export type EffectiveScore = Brand<number, 'EffectiveScore'>

export const calculateEffectiveScore = (
  similarity: number,
  confidence: Confidence,
  ageInDays: number,
  profile: DecayProfile
): EffectiveScore => {
  const decayFactor = getDecayFactor(profile, ageInDays)
  const score = similarity * confidence * decayFactor
  return Math.round(score * 1000) / 1000 as EffectiveScore
}

const getDecayFactor = (profile: DecayProfile, days: number): number => {
  switch (profile) {
    case 'stable':
      return Math.exp(-days / 365)      // 年単位でゆっくり減衰
    case 'exploratory':
      return Math.exp(-days / 90)       // 3ヶ月で減衰
    case 'situational':
      return Math.exp(-days / 30)       // 1ヶ月で急速減衰
  }
}
```

#### 2.2 昇格ポリシー

```typescript
// src/domains/decision/policies/PromotionPolicy.ts
export type PromotionTrigger =
  | { type: 'confidence_rise'; delta: number }
  | { type: 'frequent_reference'; count: number }
  | { type: 'manual' }

export type PromotionResult =
  | { shouldPromote: false }
  | { shouldPromote: true; suggestedType: 'learning' | 'decision'; reason: string }

export const PROMOTION_THRESHOLDS = {
  CONFIDENCE_NEAR: 0.55,
  CONFIDENCE_MIN: 0.35,
  DAYS_MIN: 7,
  REFERENCE_COUNT: 5,
} as const

export const checkPromotion = (
  current: NoteInference,
  previous: NoteInference | null,
  referenceCount: number
): PromotionResult => {
  // スクラッチ以外は対象外
  if (current.type !== 'scratch') {
    return { shouldPromote: false }
  }

  // 信頼度チェック
  if (current.confidence < PROMOTION_THRESHOLDS.CONFIDENCE_MIN) {
    return { shouldPromote: false }
  }

  // トリガー判定
  const trigger = determineTrigger(current, previous, referenceCount)
  if (!trigger) {
    return { shouldPromote: false }
  }

  // 推奨タイプ判定
  const suggestedType = determineSuggestedType(current)
  const reason = generateReason(trigger, current)

  return { shouldPromote: true, suggestedType, reason }
}

const determineTrigger = (
  current: NoteInference,
  previous: NoteInference | null,
  referenceCount: number
): PromotionTrigger | null => {
  // 信頼度上昇チェック
  if (previous && current.confidence - previous.confidence >= 0.1) {
    return { type: 'confidence_rise', delta: current.confidence - previous.confidence }
  }

  // 頻繁参照チェック
  if (referenceCount >= PROMOTION_THRESHOLDS.REFERENCE_COUNT) {
    return { type: 'frequent_reference', count: referenceCount }
  }

  // 信頼度閾値近傍チェック
  if (isNearThreshold(current.confidence, PROMOTION_THRESHOLDS.CONFIDENCE_NEAR)) {
    return { type: 'confidence_rise', delta: 0 }
  }

  return null
}

const determineSuggestedType = (inference: NoteInference): 'learning' | 'decision' => {
  // intent に基づいて判定
  const decisionIntents = ['architecture', 'design', 'strategy', 'policy']
  if (decisionIntents.includes(inference.intent)) {
    return 'decision'
  }
  return 'learning'
}
```

#### 2.3 検索パイプライン

```typescript
// src/domains/decision/pipelines/searchDecisionsPipeline.ts
type SearchInput = {
  query: string
  mode: 'keyword' | 'semantic' | 'hybrid'
  minConfidence: number
  limit: number
}

type SearchOutput = {
  results: DecisionSearchResult[]
  totalCount: number
}

// 各ステップを分離
const filterByType = (notes: NoteWithInference[]): NoteWithInference[] =>
  notes.filter(n => n.inference?.type === 'decision')

const filterByConfidence = (minConf: number) => (notes: NoteWithInference[]): NoteWithInference[] =>
  notes.filter(n => n.inference && n.inference.confidence >= minConf)

const calculateScores = (notes: NoteWithInference[]): ScoredNote[] =>
  notes.map(n => ({
    ...n,
    effectiveScore: calculateEffectiveScore(
      n.similarity,
      n.inference!.confidence as Confidence,
      daysSince(n.updatedAt),
      n.inference!.decayProfile
    ),
  }))

const sortByScore = (notes: ScoredNote[]): ScoredNote[] =>
  [...notes].sort((a, b) => b.effectiveScore - a.effectiveScore)

const takeLimit = (limit: number) => <T>(items: T[]): T[] =>
  items.slice(0, limit)

// パイプライン合成
export const searchDecisionsPipeline = (
  notes: NoteWithInference[],
  input: SearchInput
): SearchOutput => {
  const results = pipe(
    notes,
    filterByType,
    filterByConfidence(input.minConfidence),
    calculateScores,
    sortByScore,
    takeLimit(input.limit),
  )

  return {
    results: results.map(toSearchResult),
    totalCount: results.length,
  }
}
```

#### 2.4 移行手順

```
Week 1-2:
├── 値オブジェクト実装（Confidence, Intent, EffectiveScore）
├── DecayProfile の時間減衰関数
└── ユニットテスト

Week 3:
├── PromotionPolicy 実装
├── checkPromotion 関数
├── 既存 promotion/index.ts との比較テスト
└── エッジケーステスト

Week 4:
├── searchDecisionsPipeline 実装
├── フィルタ・ソート関数群
└── 統合テスト

Week 5:
├── decisionService.ts 書き換え
├── promotionService.ts 書き換え
├── ディスパッチャー動作確認
└── レガシーコード削除
```

---

### Phase 3: Driftドメイン（v5.6.0）

**目標**: 統計処理とDrift検出を関数型DDDで再実装

**優先度**: ⭐⭐（高）

**理由**:
- マジックナンバーが多い
- 統計関数が分散している
- 設定可能性を高めたい

#### 3.1 設定オブジェクト

```typescript
// src/domains/drift/types/DriftConfig.ts
export type DriftConfig = Readonly<{
  emaAlpha: number           // 0.1-0.5: EMA平滑化係数
  overheatSigma: number      // 1.0-2.0: 過熱検出閾値
  stagnationSigma: number    // 0.5-1.5: 停滞検出閾値
  trendThreshold: number     // 0.01-0.1: トレンド判定閾値
}>

export const DEFAULT_DRIFT_CONFIG: DriftConfig = {
  emaAlpha: 0.3,
  overheatSigma: 1.5,
  stagnationSigma: 1.0,
  trendThreshold: 0.05,
}

export const createDriftConfig = (
  partial: Partial<DriftConfig>
): Result<DriftConfig, InvalidConfig> => {
  const config = { ...DEFAULT_DRIFT_CONFIG, ...partial }

  // バリデーション
  if (config.emaAlpha < 0.1 || config.emaAlpha > 0.5) {
    return err(new InvalidConfig('emaAlpha', 'Must be 0.1-0.5'))
  }
  // ... 他のバリデーション

  return ok(config)
}
```

#### 3.2 統計関数

```typescript
// src/domains/drift/functions/calculateEMA.ts
export const calculateEMA = (
  values: number[],
  alpha: number
): number[] => {
  if (values.length === 0) return []

  const result: number[] = [values[0]]
  for (let i = 1; i < values.length; i++) {
    result.push(alpha * values[i] + (1 - alpha) * result[i - 1])
  }
  return result
}

// src/domains/drift/functions/detectTrend.ts
export type Trend = 'rising' | 'falling' | 'flat'

export const detectTrend = (
  values: number[],
  threshold: number
): Trend => {
  if (values.length < 2) return 'flat'

  const recent = values.slice(-5)
  const slope = linearRegressionSlope(recent)

  if (slope > threshold) return 'rising'
  if (slope < -threshold) return 'falling'
  return 'flat'
}

// src/domains/drift/functions/calculateCohesion.ts
export const calculateCohesion = (
  vectors: Float32Array[],
  centroid: Float32Array
): number => {
  if (vectors.length === 0) return 0

  const similarities = vectors.map(v => cosineSimilarity(v, centroid))
  return mean(similarities)
}
```

#### 3.3 Driftインサイト

```typescript
// src/domains/drift/types/DriftInsight.ts
export type DriftInsight = Readonly<{
  score: DriftScore
  trend: Trend
  anomaly: AnomalyType | null
  recommendation: string
}>

export type AnomalyType =
  | 'overheat'      // 急激な変化
  | 'stagnation'    // 長期停滞
  | 'cluster_bias'  // 特定クラスタへの偏り

// src/domains/drift/pipelines/analyzeDriftPipeline.ts
export const analyzeDriftPipeline = (
  timeSeries: DailyDrift[],
  config: DriftConfig
): DriftInsight => {
  const scores = timeSeries.map(d => d.score)
  const ema = calculateEMA(scores, config.emaAlpha)
  const trend = detectTrend(ema, config.trendThreshold)
  const anomaly = detectAnomaly(scores, ema, config)
  const recommendation = generateRecommendation(trend, anomaly)

  return {
    score: last(ema) as DriftScore,
    trend,
    anomaly,
    recommendation,
  }
}
```

---

## 共通基盤

### pipe / flow 関数

```typescript
// src/domains/shared/functions/pipe.ts
export function pipe<A>(a: A): A
export function pipe<A, B>(a: A, ab: (a: A) => B): B
export function pipe<A, B, C>(a: A, ab: (a: A) => B, bc: (b: B) => C): C
export function pipe<A, B, C, D>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D
): D
// ... オーバーロード続く

export function pipe(a: unknown, ...fns: Function[]): unknown {
  return fns.reduce((acc, fn) => fn(acc), a)
}

// 関数を合成（遅延評価）
export const flow = <A, B>(
  ...fns: [(a: A) => unknown, ...Function[]]
): ((a: A) => B) =>
  (a: A) => pipe(a, ...fns) as B
```

### Result ユーティリティ

```typescript
// src/domains/shared/types/Result.ts
export const isOk = <T, E>(result: Result<T, E>): result is { ok: true; value: T } =>
  result.ok

export const isErr = <T, E>(result: Result<T, E>): result is { ok: false; error: E } =>
  !result.ok

export const getOrThrow = <T, E>(result: Result<T, E>): T => {
  if (result.ok) return result.value
  throw result.error
}

export const getOrDefault = <T, E>(result: Result<T, E>, defaultValue: T): T =>
  result.ok ? result.value : defaultValue

export const mapError = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> =>
  result.ok ? result : err(fn(result.error))

// Promise との統合
export const fromPromise = async <T>(
  promise: Promise<T>
): Promise<Result<T, Error>> => {
  try {
    return ok(await promise)
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)))
  }
}

// 複数の Result を結合
export const all = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
  const values: T[] = []
  for (const result of results) {
    if (!result.ok) return result
    values.push(result.value)
  }
  return ok(values)
}
```

### DomainError

```typescript
// src/domains/shared/errors/DomainError.ts
export abstract class DomainError extends Error {
  abstract readonly code: string

  toAppError(): AppError {
    return new AppError(this.code, this.message, {
      statusCode: this.getStatusCode(),
    })
  }

  protected getStatusCode(): number {
    return 400 // デフォルトは Bad Request
  }
}

// 具体的なエラー
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR'

  constructor(
    public readonly field: string,
    message: string
  ) {
    super(`${field}: ${message}`)
  }
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND'

  constructor(
    public readonly entity: string,
    public readonly id: string
  ) {
    super(`${entity} not found: ${id}`)
  }

  protected getStatusCode(): number {
    return 404
  }
}
```

---

## テスト戦略

### テストピラミッド

```
              /\
             /  \
            / E2E \        少数（重要フローのみ）
           /------\
          /        \
         / 統合テスト \      中程度（サービス層）
        /------------\
       /              \
      /  ユニットテスト  \    大量（ドメイン層100%）
     /------------------\
```

### ドメイン層テスト例

```typescript
// src/domains/review/value-objects/__tests__/EasinessFactor.test.ts
import { describe, it, expect } from 'vitest'
import { createEF, updateEF, initialEF, describeEF } from '../EasinessFactor'

describe('EasinessFactor', () => {
  describe('createEF', () => {
    it('1.3以上の値で成功する', () => {
      const result = createEF(2.5)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe(2.5)
      }
    })

    it('1.3未満の値でエラーを返す', () => {
      const result = createEF(1.2)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(InvalidEasinessFactor)
      }
    })

    it('小数点2桁で丸める', () => {
      const result = createEF(2.567)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe(2.57)
      }
    })
  })

  describe('updateEF', () => {
    it('quality=5 で EF が増加する', () => {
      const ef = initialEF()
      const updated = updateEF(ef, 5)
      expect(updated).toBeGreaterThan(ef)
    })

    it('quality=0 で EF が減少する（最小1.3）', () => {
      const ef = createEF(1.5).value!
      const updated = updateEF(ef, 0)
      expect(updated).toBe(1.3)
    })
  })

  describe('describeEF', () => {
    it.each([
      [2.5, '非常に良い'],
      [2.3, '良い'],
      [2.0, '普通'],
      [1.6, 'やや難しい'],
      [1.3, '難しい'],
    ])('EF=%s は "%s" と表示される', (ef, expected) => {
      expect(describeEF(ef as EasinessFactor)).toBe(expected)
    })
  })
})
```

### プロパティベーステスト

```typescript
// src/domains/review/functions/__tests__/calculateSM2.property.test.ts
import { describe, it } from 'vitest'
import fc from 'fast-check'
import { calculateSM2 } from '../calculateSM2'
import { initialSM2State } from '../../types/SM2State'

describe('calculateSM2 プロパティ', () => {
  it('quality >= 3 なら repetition が増加する', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 5 }),
        (quality) => {
          const state = initialSM2State()
          const next = calculateSM2(quality, state)
          return next.repetition === state.repetition + 1
        }
      )
    )
  })

  it('quality < 3 なら repetition がリセットされる', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 }),
        (quality) => {
          const state = { ...initialSM2State(), repetition: 5 }
          const next = calculateSM2(quality, state)
          return next.repetition === 0
        }
      )
    )
  })

  it('EF は常に 1.3 以上', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.float({ min: 1.3, max: 3.0 }),
        (quality, ef) => {
          const state = { ef: ef as EasinessFactor, interval: 1, repetition: 0 }
          const next = calculateSM2(quality, state)
          return next.ef >= 1.3
        }
      )
    )
  })
})
```

### 統合テスト

```typescript
// src/services/review/__tests__/reviewService.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { submitReview } from '../reviewService'
import { createTestSchedule, cleanupTestData } from '../../../test/helpers'

describe('submitReview 統合テスト', () => {
  beforeEach(async () => {
    await cleanupTestData()
  })

  it('レビュー送信後にスケジュールが更新される', async () => {
    const schedule = await createTestSchedule({ ef: 2.5, interval: 6, rep: 2 })

    const result = await submitReview({
      scheduleId: schedule.id,
      quality: 4,
      currentState: { ef: schedule.ef, interval: schedule.interval, rep: schedule.rep },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.newState.repetition).toBe(3)
      expect(result.value.newState.interval).toBeGreaterThan(6)
    }
  })
})
```

---

## 移行チェックリスト

### Phase 0: 共通基盤

- [ ] Result<T, E> 型の実装
- [ ] Option<T> 型の実装
- [ ] pipe / flow 関数の実装
- [ ] Brand 型の実装
- [ ] DomainError 基底クラス
- [ ] 全ユニットテスト作成
- [ ] ドキュメント更新

### Phase 1: Reviewドメイン

- [ ] EasinessFactor 値オブジェクト
- [ ] ReviewInterval 値オブジェクト
- [ ] Quality 値オブジェクト
- [ ] SM2State 型定義
- [ ] ReviewResult 型定義
- [ ] calculateSM2 関数
- [ ] previewIntervals 関数
- [ ] submitReviewPipeline
- [ ] scheduleReviewPipeline
- [ ] QuestionGenerationPolicy
- [ ] reviewService 書き換え
- [ ] 既存コードとの比較テスト
- [ ] レガシーコード削除
- [ ] ドキュメント更新

### Phase 2: Decisionドメイン

- [ ] Confidence 値オブジェクト
- [ ] Intent 値オブジェクト
- [ ] EffectiveScore 値オブジェクト
- [ ] Decision 型定義
- [ ] PromotionCandidate 型定義
- [ ] PromotionPolicy
- [ ] classifyNote 関数
- [ ] calculateEffectiveScore 関数
- [ ] applyTimeDecay 関数
- [ ] searchDecisionsPipeline
- [ ] checkPromotionPipeline
- [ ] decisionService 書き換え
- [ ] promotionService 書き換え
- [ ] レガシーコード削除
- [ ] ドキュメント更新

### Phase 3: Driftドメイン

- [ ] DriftScore 値オブジェクト
- [ ] GrowthAngle 値オブジェクト
- [ ] StabilityScore 値オブジェクト
- [ ] DriftConfig 型定義
- [ ] DriftInsight 型定義
- [ ] calculateEMA 関数
- [ ] detectTrend 関数
- [ ] calculateCohesion 関数
- [ ] detectAnomaly 関数
- [ ] analyzeDriftPipeline
- [ ] driftService 書き換え
- [ ] レガシーコード削除
- [ ] ドキュメント更新

### 最終確認

- [ ] 全テスト通過（カバレッジ90%以上）
- [ ] パフォーマンステスト
- [ ] 既存機能の動作確認
- [ ] APIレスポンス互換性確認
- [ ] ドキュメント最終更新
- [ ] バージョン v6.0.0 リリース

---

## リスクと対策

### リスク1: 既存機能の破壊

| 対策 |
|------|
| アダプターパターンで新旧共存 |
| 比較テストで結果一致を確認 |
| 段階的ロールアウト |

### リスク2: パフォーマンス低下

| 対策 |
|------|
| 関数合成のオーバーヘッドは微小 |
| イミュータブル操作は構造共有で最適化 |
| ベンチマークテストで監視 |

### リスク3: チーム学習コスト

| 対策 |
|------|
| 段階的導入で徐々に慣れる |
| 共通基盤の使用例を豊富に |
| コードレビューでパターン共有 |

### リスク4: 移行期間の複雑性

| 対策 |
|------|
| 新旧コードの境界を明確に |
| ディレクトリで分離（domains/ vs services/） |
| 移行完了後に即座にレガシー削除 |

---

## 関連ドキュメント

| ドキュメント | 説明 |
|-------------|------|
| [architecture.md](./architecture.md) | 現行アーキテクチャ |
| [spaced-review.md](./spaced-review.md) | SM-2アルゴリズム詳細 |
| [er-diagram.md](./er-diagram.md) | データベース構造 |

---

## 参考資料

- [Domain Modeling Made Functional](https://pragprog.com/titles/swdddf/domain-modeling-made-functional/) - Scott Wlaschin
- [fp-ts](https://gcanti.github.io/fp-ts/) - TypeScript関数型プログラミングライブラリ
- [Effect](https://effect.website/) - TypeScript用エフェクトシステム

---

**Brain Cabinet** - Functional DDD Migration Plan
