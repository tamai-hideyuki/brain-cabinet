# Brain Cabinet ネットワーク構成図

**v7.1.0**

## システム全体構成

```mermaid
flowchart TB
    subgraph Client["クライアント層"]
        Browser["Web Browser"]
        subgraph ReactUI["React UI"]
            Dashboard["Dashboard"]
            NotesPage["NotesPage"]
            ReviewsPage["ReviewsPage"]
            GraphPage["GraphPage"]
            TimelinePage["TimelinePage"]
            BookmarkPage["BookmarkPage"]
            SecretBoxPage["SecretBoxPage"]
            CoachingPage["CoachingPage"]
            LibraryPage["LibraryPage"]
        end
    end

    subgraph Auth["認証"]
        Clerk["Clerk Auth<br/>(OAuth)"]
    end

    subgraph Server["バックエンド (Hono)"]
        subgraph Routes["REST API Routes"]
            NotesRoute["/api/notes"]
            SearchRoute["/api/search"]
            CommandRoute["/api/v1"]
            GPTRoute["/api/gpt"]
            ClustersRoute["/api/clusters"]
            AnalyticsRoute["/api/analytics"]
            ReviewRoute["/api/reviews"]
        end

        subgraph Dispatchers["Dispatchers (21)"]
            NoteDisp["note"]
            SearchDisp["search"]
            ClusterDisp["cluster"]
            ClusterDynDisp["clusterDynamics"]
            ReviewDisp["review"]
            DriftDisp["drift"]
            PTMDisp["ptm"]
            InfluenceDisp["influence"]
            InsightDisp["insight"]
            AnalyticsDisp["analytics"]
            GPTDisp["gpt"]
            SystemDisp["system"]
            JobDisp["job"]
            WorkflowDisp["workflow"]
            RAGDisp["rag"]
            DecisionDisp["decision"]
            PromotionDisp["promotion"]
            BookmarkDisp["bookmark"]
            LLMInferenceDisp["llmInference"]
            IsolationDisp["isolation"]
            CoachingDisp["coaching"]
        end

        subgraph Services["Service Layer (27)"]
            NotesService["notesService"]
            HistoryService["historyService"]
            SearchService["searchService"]
            EmbeddingService["embeddingService"]
            NoteImagesService["noteImages"]
            ClusterService["cluster"]
            PTMService["ptm"]
            DriftService["drift"]
            InfluenceService["influence"]
            AnalyticsService["analytics"]
            SemanticChangeService["semanticChange"]
            IsolationService["isolation"]
            CacheService["cache"]
            InferenceService["inference"]
            DecisionService["decision"]
            PromotionService["promotion"]
            CounterevService["counterevidence"]
            TimeDecayService["timeDecay"]
            ReviewService["review"]
            GPTService["gptService"]
            BookmarkService["bookmark"]
            SecretBoxService["secretBox"]
            CoachingService["coachingService"]
            VoiceEvalService["voiceEvaluation"]
            ThinkingReportService["thinkingReport"]
            HealthService["health"]
            JobsService["jobs"]
        end

        subgraph Repositories["Repository Layer"]
            NotesRepo["notesRepo"]
            EmbeddingRepo["embeddingRepo"]
            ClusterRepo["clusterRepo"]
            ReviewRepo["reviewRepo"]
            SearchRepo["searchRepo"]
            InfluenceRepo["influenceRepo"]
            HistoryRepo["historyRepo"]
        end
    end

    subgraph External["外部サービス"]
        OpenAI["OpenAI API<br/>(GPT-4)"]
        Ollama["Ollama<br/>(Qwen2.5:3b)<br/>ローカルLLM"]
        Xenova["Xenova ML<br/>(MiniLM-L6-v2)<br/>ローカル実行"]
    end

    subgraph Database["データベース層"]
        SQLite[("SQLite<br/>(data.db)<br/>WAL Mode<br/>38 tables")]
    end

    %% クライアント接続
    Browser --> Clerk
    Clerk --> ReactUI
    ReactUI -->|"fetch() / API"| Routes

    %% ルーティング
    Routes --> Dispatchers

    %% ディスパッチャー → サービス
    Dispatchers --> Services

    %% サービス → リポジトリ
    Services --> Repositories

    %% リポジトリ → データベース
    Repositories --> SQLite

    %% 外部サービス
    GPTService -->|"API Call"| OpenAI
    InferenceService -->|"Local LLM"| Ollama
    EmbeddingService -->|"Local ML"| Xenova
```

## サービス層詳細

```mermaid
flowchart TD
    subgraph Core["コアサービス (5)"]
        Notes["notesService"]
        History["historyService"]
        Search["searchService"]
        Embedding["embeddingService"]
        NoteImages["noteImages"]
    end

    subgraph Analysis["分析サービス (8)"]
        Cluster["cluster"]
        PTM["ptm"]
        Drift["drift"]
        Influence["influence"]
        Analytics["analytics"]
        SemanticChange["semanticChange"]
        Isolation["isolation"]
        Cache["cache"]
    end

    subgraph Inference["推論サービス (5)"]
        InferenceS["inference"]
        Decision["decision"]
        Promotion["promotion"]
        Counterev["counterevidence"]
        TimeDecay["timeDecay"]
    end

    subgraph Learning["学習サービス (1)"]
        Review["review"]
    end

    subgraph AI["AI連携 (1)"]
        GPT["gptService"]
    end

    subgraph Additional["追加機能 (5)"]
        Bookmark["bookmark"]
        SecretBox["secretBox"]
        Coaching["coachingService"]
        VoiceEval["voiceEvaluation"]
        ThinkingReport["thinkingReport"]
    end

    subgraph Ops["運用 (2)"]
        Health["health"]
        Jobs["jobs"]
    end

    %% 依存関係
    Notes --> Embedding
    Notes --> InferenceS
    Search --> Embedding
    Cluster --> Embedding
    PTM --> Cluster
    PTM --> GPT
    Drift --> Embedding
    Influence --> Embedding
    Review --> Notes
    Coaching --> GPT
```

## データフロー詳細

### ノート作成フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as React UI
    participant API as REST API
    participant Disp as Dispatcher
    participant Service as Services
    participant Repo as Repository
    participant DB as SQLite
    participant LLM as Ollama

    User->>UI: ノート作成
    UI->>API: POST /api/v1<br/>{action: "note.create"}
    API->>Disp: noteDispatcher.create()
    Disp->>Service: notesService.createNote()

    Service->>Repo: notesRepo.createNote()
    Repo->>DB: INSERT notes

    Service->>Service: inferenceService<br/>(タイプ推論)
    Service->>LLM: ローカルLLM推論
    LLM-->>Service: 推論結果
    Service->>Repo: inferenceRepo.save()
    Repo->>DB: INSERT note_inferences

    Service->>Service: embeddingService<br/>(ベクトル生成)
    Service->>Repo: embeddingRepo.save()
    Repo->>DB: INSERT note_embeddings

    Service->>Repo: searchRepo.syncFTS()
    Repo->>DB: UPDATE fts_index

    Service-->>API: 作成完了
    API-->>UI: Response
    UI-->>User: 表示更新
```

### Temporal Clustering フロー (v7)

```mermaid
sequenceDiagram
    participant Job as Job Worker
    participant Cluster as clusterService
    participant Embed as embeddingService
    participant Repo as Repository
    participant DB as SQLite

    Job->>Cluster: rebuildClusters()
    Cluster->>Embed: getAllEmbeddings()
    Embed->>DB: SELECT embeddings
    DB-->>Embed: embeddings[]

    Cluster->>Cluster: K-Means clustering

    Cluster->>Repo: createSnapshot()
    Repo->>DB: INSERT clusteringSnapshots

    Cluster->>Repo: saveSnapshotClusters()
    Repo->>DB: INSERT snapshotClusters

    Cluster->>Repo: computeLineage()
    Repo->>DB: INSERT clusterLineage

    Cluster->>Repo: detectEvents()
    Repo->>DB: INSERT clusterEvents<br/>(split/merge/extinct/emerge)

    Cluster-->>Job: 完了
```

## レイヤー構成

```mermaid
flowchart LR
    subgraph Presentation["プレゼンテーション層"]
        direction TB
        P1["React Components"]
        P2["API Client"]
    end

    subgraph Application["アプリケーション層"]
        direction TB
        A1["Routes"]
        A2["Dispatchers (21)"]
        A3["Services (27)"]
    end

    subgraph Domain["ドメイン層"]
        direction TB
        D1["Repositories"]
        D2["Business Logic"]
    end

    subgraph Infrastructure["インフラ層"]
        direction TB
        I1["SQLite / Drizzle ORM<br/>(38 tables)"]
        I2["External APIs<br/>(OpenAI)"]
        I3["Local LLM<br/>(Ollama)"]
        I4["Local ML<br/>(Xenova)"]
    end

    Presentation --> Application
    Application --> Domain
    Domain --> Infrastructure
```

## ディスパッチャー一覧（21個）

| ディスパッチャー | 主要アクション |
|-----------------|----------------|
| note | create, get, update, delete, list |
| search | query, categories, byTitle |
| cluster | list, get, rebuild |
| clusterDynamics | get |
| drift | getTimeline, getState |
| ptm | latest, history |
| influence | graph, topInfluencers |
| insight | overview, growth |
| analytics | summary |
| gpt | search, context, coachDecision |
| system | health, embed, rebuildFts |
| job | getStatus, list |
| workflow | reconstruct |
| rag | query |
| decision | search, context, compare |
| promotion | getCandidates, dismiss, promote |
| review | queue, start, submit, schedule |
| bookmark | list, create, update, delete |
| llmInference | run, get, list |
| isolation | detect, list |
| coaching | start, message, end |

## サービス一覧（27個）

| カテゴリ | サービス |
|---------|----------|
| コア | notesService, historyService, searchService, embeddingService, noteImages |
| 分析 | cluster, ptm, drift, influence, analytics, semanticChange, isolation, cache |
| 推論 | inference, decision, promotion, counterevidence, timeDecay |
| 学習 | review |
| AI | gptService |
| 追加機能 | bookmark, secretBox, coachingService, voiceEvaluation, thinkingReport |
| 運用 | health, jobs |

---

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React, TypeScript, TailwindCSS |
| バックエンド | Hono (Node.js), TypeScript |
| データベース | SQLite (Drizzle ORM), WAL Mode, 38 tables |
| 認証 | Clerk (OAuth) |
| LLM | Ollama (ローカル), OpenAI API |
| ML | Xenova/all-MiniLM-L6-v2 (ローカル) |
| ビルド | Vite, esbuild |

## ポート構成

| サービス | ポート | 説明 |
|---------|--------|------|
| Backend API | 3000 | Hono サーバー |
| Frontend Dev | 5173 | Vite 開発サーバー |
| Ollama | 11434 | ローカルLLMサーバー |
| SQLite | - | ファイルベース (data.db) |

---

最終更新: 2026-01-19
