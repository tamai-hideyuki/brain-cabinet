# Brain Cabinet ネットワーク構成図

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
        end
    end

    subgraph Auth["認証"]
        Clerk["Clerk Auth<br/>(OAuth)"]
    end

    subgraph Server["バックエンド (Hono)"]
        subgraph Routes["REST API Routes"]
            NotesRoute["/api/notes"]
            SearchRoute["/api/search"]
            CommandRoute["/api/command"]
            GPTRoute["/api/gpt"]
            ClustersRoute["/api/clusters"]
            AnalyticsRoute["/api/analytics"]
            ReviewRoute["/api/reviews"]
        end

        subgraph Dispatchers["Dispatchers"]
            NoteDisp["noteDispatcher"]
            SearchDisp["searchDispatcher"]
            ClusterDisp["clusterDispatcher"]
            ReviewDisp["reviewDispatcher"]
            DriftDisp["driftDispatcher"]
            PTMDisp["ptmDispatcher"]
        end

        subgraph Services["Service Layer"]
            NotesService["notesService"]
            SearchService["searchService"]
            EmbeddingService["embeddingService"]
            ClusterService["clusterService"]
            PTMService["PTM Engine"]
            ReviewService["reviewService"]
            InferenceService["inferenceService"]
            DriftService["driftService"]
            GPTService["gptService"]
            AnalyticsService["analyticsService"]
        end

        subgraph Repositories["Repository Layer"]
            NotesRepo["notesRepo"]
            EmbeddingRepo["embeddingRepo"]
            ClusterRepo["clusterRepo"]
            ReviewRepo["reviewRepo"]
            SearchRepo["searchRepo"]
            InfluenceRepo["influenceRepo"]
        end
    end

    subgraph External["外部サービス"]
        OpenAI["OpenAI API<br/>(GPT-4)"]
        Xenova["Xenova ML<br/>(MiniLM-L6-v2)<br/>ローカル実行"]
    end

    subgraph Database["データベース層"]
        SQLite[("SQLite<br/>(data.db)<br/>WAL Mode")]
        subgraph Tables["主要テーブル"]
            NotesTable["notes"]
            EmbeddingsTable["note_embeddings"]
            ClustersTable["clusters"]
            ReviewTable["review_schedules"]
            PTMTable["ptm_snapshots"]
            DriftTable["drift_events"]
        end
    end

    %% クライアント接続
    Browser --> Clerk
    Clerk --> ReactUI
    ReactUI -->|"fetch() / API"| Routes

    %% ルーティング
    Routes --> Dispatchers

    %% ディスパッチャー → サービス
    NoteDisp --> NotesService
    SearchDisp --> SearchService
    ClusterDisp --> ClusterService
    ReviewDisp --> ReviewService
    DriftDisp --> DriftService
    PTMDisp --> PTMService

    %% サービス間連携
    NotesService --> InferenceService
    NotesService --> EmbeddingService
    SearchService --> EmbeddingService
    ClusterService --> EmbeddingService
    PTMService --> ClusterService
    PTMService --> GPTService
    ReviewService --> NotesService

    %% サービス → リポジトリ
    NotesService --> NotesRepo
    EmbeddingService --> EmbeddingRepo
    ClusterService --> ClusterRepo
    ReviewService --> ReviewRepo
    SearchService --> SearchRepo
    DriftService --> InfluenceRepo

    %% リポジトリ → データベース
    Repositories --> SQLite
    SQLite --> Tables

    %% 外部サービス
    GPTService -->|"API Call"| OpenAI
    EmbeddingService -->|"Local ML"| Xenova
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

    User->>UI: ノート作成
    UI->>API: POST /api/command<br/>{action: "note.create"}
    API->>Disp: noteDispatcher.create()
    Disp->>Service: notesService.createNote()

    Service->>Repo: notesRepo.createNote()
    Repo->>DB: INSERT notes

    Service->>Service: inferenceService<br/>(タイプ推論)
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

### 検索フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as React UI
    participant API as Search API
    participant Service as searchService
    participant Embed as embeddingService
    participant Repo as Repositories
    participant DB as SQLite
    participant ML as Xenova ML

    User->>UI: 検索クエリ入力
    UI->>API: GET /api/search?query=...&mode=semantic
    API->>Service: searchService.search()

    alt セマンティック検索
        Service->>Embed: generateEmbedding(query)
        Embed->>ML: ベクトル生成
        ML-->>Embed: 384次元ベクトル
        Service->>Repo: embeddingRepo.searchSimilar()
        Repo->>DB: コサイン類似度検索
    else キーワード検索
        Service->>Repo: searchRepo.search()
        Repo->>DB: FTS5検索
    end

    DB-->>Repo: 検索結果
    Repo-->>Service: ランク付け結果
    Service-->>API: SearchResult[]
    API-->>UI: JSON Response
    UI-->>User: 結果表示
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
        A2["Dispatchers"]
        A3["Services"]
    end

    subgraph Domain["ドメイン層"]
        direction TB
        D1["Repositories"]
        D2["Business Logic"]
    end

    subgraph Infrastructure["インフラ層"]
        direction TB
        I1["SQLite / Drizzle ORM"]
        I2["External APIs"]
        I3["Local ML Models"]
    end

    Presentation --> Application
    Application --> Domain
    Domain --> Infrastructure
```

## コンポーネント依存関係

```mermaid
flowchart TD
    subgraph Core["コアサービス"]
        Notes["notesService"]
        Embedding["embeddingService"]
        Search["searchService"]
    end

    subgraph Analysis["分析サービス"]
        Cluster["clusterService"]
        PTM["PTM Engine"]
        Drift["driftService"]
        Influence["influenceService"]
    end

    subgraph Learning["学習サービス"]
        Review["reviewService"]
        Question["questionGenerator"]
        SM2["SM-2 Algorithm"]
    end

    subgraph AI["AI連携"]
        GPT["gptService"]
        Xenova["Xenova Embedding"]
    end

    Notes --> Embedding
    Notes --> Search
    Search --> Embedding

    Cluster --> Embedding
    PTM --> Cluster
    PTM --> GPT
    Drift --> Embedding
    Influence --> Embedding

    Review --> Notes
    Review --> Question
    Question --> SM2

    Embedding --> Xenova
```

## 主要テーブル関係

```mermaid
erDiagram
    notes ||--o{ note_history : "バージョン管理"
    notes ||--o| note_embeddings : "ベクトル"
    notes ||--o| note_inferences : "タイプ推論"
    notes }o--|| clusters : "所属"
    notes ||--o{ review_schedules : "復習予定"
    notes ||--o{ recall_questions : "質問"

    clusters ||--o{ cluster_dynamics : "日次スナップショット"
    clusters ||--o{ concept_graph_edges : "クラスタ間影響"

    notes ||--o{ note_influence_edges : "ノート間影響"
    notes ||--o{ drift_events : "ドリフト検出"

    ptm_snapshots ||--o{ clusters : "思考モデル"

    notes {
        string id PK
        string title
        string content
        string type
        string cluster_id FK
        datetime created_at
    }

    clusters {
        string id PK
        string name
        string persona
        float cohesion
    }

    review_schedules {
        string id PK
        string note_id FK
        datetime next_review_at
        float easiness_factor
        int interval
    }
```

## デプロイ構成

```mermaid
flowchart TB
    subgraph Local["ローカル環境"]
        Dev["開発サーバー<br/>localhost:3000"]
        DevDB[("data.db<br/>SQLite")]
        Dev --> DevDB
    end

    subgraph Production["本番環境 (想定)"]
        LB["Load Balancer"]
        App1["App Server 1"]
        App2["App Server 2"]
        ProdDB[("SQLite / LibSQL<br/>WAL Mode")]

        LB --> App1
        LB --> App2
        App1 --> ProdDB
        App2 --> ProdDB
    end

    subgraph External["外部サービス"]
        ClerkProd["Clerk Auth"]
        OpenAIProd["OpenAI API"]
    end

    Production --> External
```

---

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React, TypeScript, TailwindCSS |
| バックエンド | Hono (Node.js), TypeScript |
| データベース | SQLite (Drizzle ORM), WAL Mode |
| 認証 | Clerk (OAuth) |
| ML/AI | Xenova/all-MiniLM-L6-v2 (ローカル), OpenAI API |
| ビルド | Vite, esbuild |

## ポート構成

| サービス | ポート | 説明 |
|---------|--------|------|
| Backend API | 3000 | Hono サーバー |
| Frontend Dev | 5173 | Vite 開発サーバー |
| SQLite | - | ファイルベース (data.db) |
