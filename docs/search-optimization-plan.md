# 検索最適化 計画書

> 目標: Brain Cabinet の検索品質を **「自分のノートに対してGoogle検索並みに信頼できる」** 状態に引き上げる。UI経由とMCP経由（Claude）の両方で。

## 背景と方針

現状の `src/modules/search/` は TF-IDF / HNSW / ハイブリッドの3モードを既に実装しているが、**「どれがどれだけ効いているか」を測る手段が無い**。現在の不信感の正体は「良くなっているのか悪くなっているのかが分からない」ことにある。

従ってこの計画は以下の順で進める:

1. **測れるようにする**（評価基盤） ← ここが欠落している
2. **最適化する**（ハイブリッドの再設計 + Reranker）
3. **頑健性を検証する**（データ層カオス）

1と2を飛ばしてカオスに入っても意味のある発見は得られない。

---

## 現状分析で見つかった重要な問題

実装を読んで判明した事実:

### 🔴 問題1: ハイブリッド検索のスケール不一致

[src/modules/search/service.ts:606](src/modules/search/service.ts#L606) と [src/modules/search/dispatcher.ts:68](src/modules/search/dispatcher.ts#L68) の両方で、以下のような合算をしている:

```ts
// keyword: TF-IDF 絶対スコア（上限なし、数〜数十〜数百）
// semantic: 類似度 × 100（0-100スケール）
score = keywordScore * 0.6 + semanticScore * 0.4;
```

**これは数学的に正しくない**。TF-IDF スコアは文書長やクエリに依存して青天井に伸びるので、短いクエリでは semantic が過剰に効き、専門用語の多いクエリでは semantic がほぼ無視される、という**クエリ依存の不安定さ**を生んでいる。

→ Phase 2 で RRF (Reciprocal Rank Fusion) に置き換える。

### 🟡 問題2: ハイブリッドのロジックが2箇所に重複

`service.ts#searchNotesHybrid` と `dispatcher.ts` の `case "hybrid"` に、ほぼ同じロジックが別実装で存在。片方しか使われていない可能性が高く、改善の際にどちらを直すかで混乱する。

→ Phase 2 で dispatcher 側を `searchNotesHybrid` に統一。

### 🟢 良い点

- IDFキャッシュ (1h TTL + write-through invalidation) は妥当
- tiny-segmenter による日本語対応あり
- 構造スコア（タイトル3倍・見出し2倍）は正当

---

## Phase 0: 評価基盤（🌟 最重要・先にやる）

**ゴール**: `pnpm eval:search` を叩けば、3モードそれぞれの NDCG@10 / MRR / Recall@20 / Precision@10 が1つの表で出る状態にする。

### 0-1. ゴールデンセットの作成

`src/modules/search/eval/golden.jsonl` として手動で作成。

```jsonl
{"query": "TypeScriptの型推論", "relevant": ["note_id_1", "note_id_7"], "notes": "厳密に1つ"}
{"query": "朝の生産性", "relevant": ["note_id_3", "note_id_12", "note_id_44"], "notes": "3つ以上欲しい"}
```

- **最低50クエリ、目標100クエリ**。
- クエリの種類を意識的にばらす:
  - 専門用語（タイトル直撃）
  - 曖昧な表現（セマンティック必須）
  - 表記ゆれ（「TypeScript」「ts」「タイプスクリプト」）
  - 問いかけ形式（「〜について考えたこと」）
  - 日付・時期を含むもの

### 0-2. 評価ランナー実装

新規ファイル: `src/modules/search/eval/runner.ts`

```ts
interface EvalResult {
  mode: "keyword" | "semantic" | "hybrid";
  ndcg10: number;
  mrr: number;
  recall20: number;
  precision10: number;
  perQuery: Array<{ query: string; rank: number | null; ndcg: number }>;
}
```

- 各クエリを3モードで実行 → `relevant` 配列との重なりで指標計算
- 結果を `docs/search-eval/YYYY-MM-DD.md` に書き出し（履歴として残す）
- 個別クエリで大きく外したものを `perQuery` で可視化

### 0-3. ベースライン測定

現状の3モードで計測し、**数字をこの計画書に追記する**。以降のすべての変更はこの数字との比較で判断する。

### 0-4. スクリプト追加

`package.json`:

```json
"eval:search": "tsx src/modules/search/eval/runner.ts"
```

**Phase 0 完了条件**: ベースライン NDCG@10 が記録され、以降再実行可能。

---

## Phase 1: クエリ処理の改善

`tokenize` と正規化の改善で、Phase 2 の前に素の精度を上げておく。

### 1-1. 表記ゆれ吸収

- 英数字の全角/半角統一（`normalizeText` を確認・拡張）
- カタカナ↔英語のシノニム辞書（「TypeScript」⟷「タイプスクリプト」「ts」）を小規模に手作りし、クエリ側のみ拡張
- `src/modules/search/eval/synonyms.json` として管理

### 1-2. ストップワード除去

`tokenize` 後に「の」「は」「を」などの機能語を除去。頻出だが意味を持たないトークンが IDF を押し上げ、ノイズ検索結果を混ぜている可能性がある。

### 1-3. 評価

各変更ごとに `pnpm eval:search` を回し、NDCG@10 が改善していることを確認。**改善が無ければマージしない**。

---

## Phase 2: ハイブリッド検索の再設計（RRF）

### 2-1. RRF 実装

`searchNotesHybrid` を以下に置き換え:

```ts
// Reciprocal Rank Fusion
// 各結果セットで「順位」をベースにスコアを合算
const K = 60; // RRF定数（慣習的に60）
const rrfScore = (rank: number) => 1 / (K + rank);

// keyword[0] の rank=1, keyword[1] の rank=2...
for (const [i, note] of keywordResults.entries()) {
  merged.set(note.id, { note, score: rrfScore(i + 1) });
}
for (const [i, note] of semanticResults.entries()) {
  const existing = merged.get(note.id);
  const s = rrfScore(i + 1);
  if (existing) existing.score += s;
  else merged.set(note.id, { note, score: s });
}
```

**利点**: スコアの絶対値ではなく順位を使うので、スケール不一致問題が根本解決。

### 2-2. dispatcher の重複削除

`dispatcher.ts` の `case "hybrid"` は `searchService.searchNotesHybrid` を呼ぶだけに簡素化。

### 2-3. 評価

Phase 0 のベースラインと比較。**期待値: NDCG@10 が +5% 以上改善**。未達なら RRF の K 値を 30/60/100 で振ってチューニング。

---

## Phase 3: Reranker の追加

Top-20〜30 を多言語 cross-encoder で並べ替える。

### 3-1. モデル選定

Xenova (`@xenova/transformers`) 上で動く多言語 cross-encoder:

- 候補: `Xenova/ms-marco-MiniLM-L-6-v2` (英語中心だが日本語もある程度)
- または multilingual-e5 の reranker 版
- **ローカル推論前提**（外部API不要の方針を維持）

### 3-2. パイプライン

```
Query
  ├─ keyword (Top-20)
  └─ semantic (Top-20)
       ↓ RRF merge
     Top-30
       ↓ Cross-encoder rerank
     Top-10 (ユーザー/MCPに返す)
```

### 3-3. パフォーマンス予算

- 1クエリあたり rerank 時間 < 500ms（Top-30 スコアリング）
- 超える場合は Top-20 に削るか、WebWorker 化

### 3-4. 評価

Phase 2 比 **NDCG@10 が +10% 以上**。MRR の改善幅の方が大きいはず（正解を先頭に押し上げる力が Reranker の本領）。

---

## Phase 4: MCP 経由検索の最適化

Claude が MCP 経由で取るノートを改善する。

### 4-1. MCP tool の切り替え

[packages/mcp-server/src/index.ts](packages/mcp-server/src/index.ts) で、現状どの search を呼んでいるかを確認し、**必ず hybrid + rerank を通るパス**に変更。

### 4-2. Claude向けレスポンス整形

Claude が判断しやすい形に:

```json
{
  "query": "...",
  "results": [
    {
      "title": "...",
      "snippet": "...",      // 既存の mark 付き
      "why_relevant": "...", // Reranker の根拠（タイトル一致/意味近接/etc）
      "confidence": 0.87,    // 0-1 正規化スコア
      "path": "..."
    }
  ],
  "fallback_used": false     // HNSW失敗時の縮退
}
```

### 4-3. MCP専用評価セット

UI用のクエリとは別に、「Claudeが会話中に投げがちなクエリ」のゴールデンセットを追加作成（20〜30件）。会話的な曖昧クエリで強いかを測る。

---

## Phase 5: データ層カオス（🎯 ここで初めて意味を持つ）

Phase 0-4 が完了し、ベースラインが安定した後に実施。

### 5-1. Semantic Noise Injection

- 既存ノート集合に、シノニム置換/語順入れ替えを施した「揺らぎ版」を作成
- 揺らぎ版のノート集合に対して Phase 0 の評価セットを実行
- **NDCG@10 の低下幅 = そのトピックの脆さ**

### 5-2. Ghost Note Injection

- LLMで「一見関連しそうだが無関係」なノートを20件生成して注入
- それらが上位10件に何件混入するかを計測 = 誤検索耐性

### 5-3. フィードバックループ

脆いトピックが判明したら:
- そのトピックのノートは構造化（見出し/タグ）が弱い可能性 → 書き方を変える
- または Reranker がそのドメインで弱い → モデルを追加チューニング

この段階で初めて「**Brain Cabinet を使って、Brain Cabinet の弱点を発見する**」という認知層の価値が立ち上がる。

---

## マイルストーン

| フェーズ | 内容 | 完了条件 |
|---|---|---|
| Phase 0 | 評価基盤 | `pnpm eval:search` 動作 + ベースライン記録 |
| Phase 1 | クエリ処理改善 | NDCG@10 > ベースライン |
| Phase 2 | RRF 導入 | NDCG@10 > Phase1 +5% |
| Phase 3 | Reranker | NDCG@10 > Phase2 +10%, MRR大幅改善 |
| Phase 4 | MCP 最適化 | MCP用評価セットでも NDCG@10 改善 |
| Phase 5 | カオス実験 | 「脆いトピック」リスト + 改善アクション |

**Phase 0 と 2 は必須、3-5 は効果測定しながら判断**。Phase 3 が費用対効果低ければスキップしてPhase 4に進んでOK。

---

## やらないこと（スコープ外）

- スケーラビリティ対応（個人用なので不要）
- 別ベクトルDB導入（hnswlib-node で十分）
- 外部API依存の検索品質向上（ローカル推論方針を維持）
- マルチユーザー向けのテナント分離

---

## 最初の一歩

Phase 0-1（ゴールデンセット作成）から着手する。
クエリを50件書き出すのは自分の手でやる部分で、ここを飛ばすと全体が崩れる。
