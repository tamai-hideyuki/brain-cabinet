# Spaced Review + Active Recall (v4.5)

学習の定着を加速するための間隔反復（Spaced Repetition）と能動的想起（Active Recall）を統合した機能。

## 概要

### Spaced Review（間隔反復）
- SM-2アルゴリズムに基づき、最適なタイミングでレビューをスケジュール
- `learning`/`decision` タイプのノートが自動でレビュー対象に
- 忘却曲線に対処し、記憶保持率を最大化

### Active Recall（能動的想起）
- ノート内容から質問を自動生成
- 受動的な読み返しではなく、能動的に思い出すことで定着を強化
- テンプレートベースの質問生成（高速・確実）

## SM-2 アルゴリズム

### 品質評価（0-5）

| 値 | 意味 | 次回への影響 |
|----|------|-------------|
| 0 | 完全忘却 | リセット（1日後） |
| 1 | 不正解（思い出した） | リセット（1日後） |
| 2 | 不正解（簡単に思い出せた） | リセット（1日後） |
| 3 | 正解（困難） | 間隔維持〜微増 |
| 4 | 正解（少し躊躇） | 間隔拡大 |
| 5 | 完璧 | 間隔大幅拡大 |

### 間隔の計算

- 初回成功: 1日後
- 2回目成功: 6日後
- 3回目以降: `前回間隔 × EF（易しさ係数）`

EF は 1.3〜2.5+ の範囲で、レビュー結果に応じて調整される。

## API アクション

### review.queue
レビュー待ちのノート一覧を取得。

```json
{
  "action": "review.queue",
  "payload": {
    "limit": 20  // オプション
  }
}
```

**レスポンス例:**
```json
{
  "dueCount": 5,
  "overdueCount": 2,
  "upcomingCount": 10,
  "todayCount": 3,
  "reviews": [
    {
      "noteId": "abc-123",
      "noteTitle": "TypeScriptの型システム",
      "noteType": "learning",
      "isOverdue": true,
      "daysSinceDue": 2,
      "schedule": {
        "easinessFactor": 2.5,
        "interval": 6,
        "repetition": 2
      }
    }
  ]
}
```

### review.start
レビューセッションを開始。ノート内容と質問が返される。

```json
{
  "action": "review.start",
  "payload": {
    "noteId": "abc-123"
  }
}
```

**レスポンス例:**
```json
{
  "scheduleId": 1,
  "noteId": "abc-123",
  "noteTitle": "TypeScriptの型システム",
  "noteContent": "...",
  "currentState": {
    "easinessFactor": 2.5,
    "interval": 6,
    "repetition": 2
  },
  "questions": [
    {
      "id": 1,
      "type": "recall",
      "question": "このノートの主なポイントを3つ挙げてください。",
      "expectedKeywords": ["型", "TypeScript", "安全性"]
    },
    {
      "id": 2,
      "type": "concept",
      "question": "「型システム」とは何ですか？",
      "expectedKeywords": ["型", "チェック", "コンパイル"]
    }
  ],
  "previews": [
    { "quality": 0, "nextInterval": 1, "nextEF": 2.18 },
    { "quality": 3, "nextInterval": 6, "nextEF": 2.36 },
    { "quality": 5, "nextInterval": 15, "nextEF": 2.6 }
  ]
}
```

### review.submit
レビュー結果を送信。SM-2アルゴリズムで次回レビュー日が計算される。

```json
{
  "action": "review.submit",
  "payload": {
    "scheduleId": 1,
    "quality": 4,
    "responseTimeMs": 15000,        // オプション
    "questionsAttempted": 2,        // オプション
    "questionsCorrect": 2           // オプション
  }
}
```

**レスポンス例:**
```json
{
  "success": true,
  "previousState": {
    "easinessFactor": 2.5,
    "interval": 6,
    "repetition": 2
  },
  "newState": {
    "easinessFactor": 2.5,
    "interval": 15,
    "repetition": 3
  },
  "nextReviewAt": 1734567890,
  "nextReviewIn": "約2週間",
  "qualityLabel": "正解（少し躊躇）",
  "efDescription": "非常に良い"
}
```

### review.schedule
手動でレビューをスケジュール（learning/decision ノートのみ）。

```json
{
  "action": "review.schedule",
  "payload": {
    "noteId": "abc-123"
  }
}
```

### review.cancel
レビューをキャンセル（スケジュールを非アクティブ化）。

```json
{
  "action": "review.cancel",
  "payload": {
    "noteId": "abc-123"
  }
}
```

### review.reschedule
レビューを再スケジュール。

```json
{
  "action": "review.reschedule",
  "payload": {
    "noteId": "abc-123",
    "daysFromNow": 7
  }
}
```

### review.questions
ノートの質問一覧を取得。

```json
{
  "action": "review.questions",
  "payload": {
    "noteId": "abc-123"
  }
}
```

### review.regenerateQuestions
質問を再生成。

```json
{
  "action": "review.regenerateQuestions",
  "payload": {
    "noteId": "abc-123"
  }
}
```

### review.stats
ノートのレビュー統計を取得。

```json
{
  "action": "review.stats",
  "payload": {
    "noteId": "abc-123"
  }
}
```

**レスポンス例:**
```json
{
  "noteId": "abc-123",
  "noteTitle": "TypeScriptの型システム",
  "schedule": {
    "easinessFactor": 2.5,
    "interval": 15,
    "repetition": 3,
    "nextReviewAt": 1734567890
  },
  "stats": {
    "totalReviews": 3,
    "avgQuality": 4.2,
    "avgResponseTimeMs": 12000,
    "totalQuestionsAttempted": 6,
    "totalQuestionsCorrect": 5,
    "currentStreak": 3
  },
  "recentSessions": [...]
}
```

### review.overview
全体のレビュー統計を取得。

```json
{
  "action": "review.overview"
}
```

**レスポンス例:**
```json
{
  "totalActiveSchedules": 25,
  "overdueCount": 3,
  "todayReviewCount": 5,
  "totalSessions": 150,
  "avgQuality": 3.8
}
```

## 質問タイプ

| タイプ | 用途 | 例 |
|--------|------|-----|
| `recall` | 想起 | 「このノートの主なポイントを3つ挙げてください。」 |
| `concept` | 概念理解 | 「{topic}とは何ですか？」 |
| `reasoning` | 推論（decision用） | 「この判断の根拠は何ですか？」 |
| `application` | 応用 | 「この知識をどのような場面で活用できますか？」 |
| `comparison` | 比較 | 「メリットとデメリットを挙げてください。」 |

## 自動スケジュール

ノートが `learning` または `decision` タイプに分類されると、自動的にレビュー対象としてスケジュールされる。

- 新規 learning/decision ノート作成時
- 既存ノートが learning/decision に昇格した時

## 使用例

### 日次レビューフロー

```bash
# 1. 今日のレビュー待ちを確認
curl -X POST /api/command -d '{"action": "review.queue"}'

# 2. レビュー開始（質問と共にノート内容が返される）
curl -X POST /api/command -d '{"action": "review.start", "payload": {"noteId": "xxx"}}'

# 3. 質問に答えた後、結果を送信
curl -X POST /api/command -d '{"action": "review.submit", "payload": {"scheduleId": 1, "quality": 4}}'

# 4. 次のノートへ（繰り返し）
```

### GPT との連携

GPT が以下のように活用できる：

1. `review.queue` でレビュー待ちノートを確認
2. `review.start` でセッション開始、質問を提示
3. ユーザーの回答を評価し、適切な `quality` で `review.submit`
4. 学習アドバイスを提供

## データベーステーブル

### review_schedules
SM-2 状態を管理。

| カラム | 説明 |
|--------|------|
| note_id | 対象ノートID |
| easiness_factor | 易しさ係数（EF） |
| interval | 次回までの間隔（日） |
| repetition | 復習回数 |
| next_review_at | 次回レビュー日時 |
| is_active | アクティブ/非アクティブ |

### recall_questions
Active Recall 質問を管理。

| カラム | 説明 |
|--------|------|
| note_id | 対象ノートID |
| question_type | 質問タイプ |
| question | 質問文 |
| expected_keywords | 期待されるキーワード |
| content_hash | コンテンツハッシュ（更新検出用） |

### review_sessions
レビューセッションのログ。

| カラム | 説明 |
|--------|------|
| schedule_id | スケジュールID |
| quality | 品質評価（0-5） |
| response_time_ms | 回答時間 |
| easiness_factor_before/after | EF の変化 |
| interval_before/after | 間隔の変化 |

## Learning vs Decision：ノートタイプの違い

Brain Cabinet の中核的な区別である「学習（Learning）」と「判断（Decision）」を理解すると、ノートが「ただの記録」から「再利用できる思考資産」に変わります。

### 全体イメージ

| カテゴリ | 意味 | 主な目的 |
|---------|------|----------|
| **Learning** | 外から得た知識・気づき・原則を整理したもの | 知識の定着・理解 |
| **Decision** | 自分が下した意思決定・選択・結論 | 思考の再現・検証 |

### Learning（学習）ノート

**概要**: 「学んだこと」「理解した理論」「よい方法論」などを整理するノート。
外部の知識 → 自分の文脈に置き換える のが目的。

**例:**
```
学習テーマ：チームのフィードバック文化を高める方法

内容：
- 毎週の1on1で「良かった点」を必ず共有
- 指摘より観察を重視する
- フィードバックは行動ベースで具体的に
```

**レビュー時の問い（Active Recall）:**
- 「フィードバック文化を高める3つの方法は？」
- 「観察を重視する理由は？」

→ **思い出す練習（再想起）** を通して、知識が定着します。

### Decision（判断）ノート

**概要**: 「自分が何を・なぜ・どう決めたか」を記録するノート。
知識を使って行動した結果 を残すもの。

**例:**
```
判断テーマ：チームの週報を廃止し、月次レビューに一本化する

理由：週報が形骸化しており、メンバーの負担が大きい
根拠：先週のアンケートで7割が「週報が負担」と回答
```

**レビュー時の問い（Active Recall）:**
- 「この判断の理由は何だったか？」
- 「今も同じ判断を下すか？」

→ **思考の再現性を確認** し、意思決定の質を高めることが目的です。

### 違いのまとめ

| 観点 | Learning（学習） | Decision（判断） |
|------|-----------------|-----------------|
| 中心にあるもの | 知識・理解 | 意思決定・行動 |
| 出発点 | 「知った」 | 「決めた」 |
| ゴール | 思い出せる | 再現できる |
| 典型的な問い | 「どう学んだ？」 | 「なぜそう決めた？」 |

### Spaced Review での扱いの違い

| 観点 | Learning | Decision |
|------|----------|----------|
| SM-2 間隔 | 標準（1日→6日→...） | やや長め（判断は頻繁に変わらない） |
| 質問タイプ | `recall`, `concept`, `application` | `reasoning`, `comparison` |
| レビューの問い | 「これは何？」「どう使う？」 | 「なぜそう決めた？」「今も同じ判断？」 |

### おすすめの使い分け

- **新しい知識・原則・方法論** → Learning ノート
- **具体的な選択・方針・判断を記録** → Decision ノート

**例:**
- 「Spaced Reviewの仕組みを理解した」→ **Learning**
- 「今後のプロジェクトでSpaced Reviewを導入する」→ **Decision**

### なぜ両方をレビューするのか？

v4.5 では両方のノートタイプを自動でレビュースケジュールに追加し、それぞれに適した質問を生成します。

- **Learning**: 知識を忘れないように定着させる
- **Decision**: 過去の判断を振り返り、今も有効か検証する

「知識の定着」と「判断の検証」を同時に回すことで、**学んだことを判断に活かし、判断から新たな学びを得る** サイクルが回ります。
