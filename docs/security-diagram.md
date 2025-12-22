# Brain Cabinet セキュリティ構成図

> v5.2.0 セキュリティアーキテクチャ

---

## 概要

Brain Cabinetのセキュリティは、**フロントエンド認証**（Clerk OAuth）と**ローカル実行モデル**を組み合わせた構成です。個人利用を前提としたシステムのため、バックエンドAPIは認証なしで動作しますが、UI経由のアクセスはClerk認証で保護されています。

---

## セキュリティ境界図

```mermaid
flowchart TB
    subgraph Internet["🌐 インターネット"]
        User["👤 ユーザー"]
        ClerkAuth["🔐 Clerk認証サーバー"]
        OpenAI["🤖 OpenAI API"]
    end

    subgraph LocalNetwork["🏠 ローカルネットワーク (localhost:3000)"]
        subgraph UI["📱 UI Layer (React + Clerk)"]
            ClerkProvider["ClerkProvider"]
            SignedIn["SignedIn Component"]
            SignedOut["SignedOut Component"]
            UserButton["UserButton"]
        end

        subgraph API["⚙️ API Layer (Hono)"]
            Middleware["リクエストログ\nミドルウェア"]
            ErrorHandler["グローバル\nエラーハンドラー"]
            Routes["APIルート\n/api/*"]
        end

        subgraph Data["💾 Data Layer"]
            SQLite["SQLite DB\n(data.db)"]
            LocalML["Xenova/MiniLM\n(ローカルML)"]
        end
    end

    User -->|"HTTPS (OAuth)"| ClerkAuth
    ClerkAuth -->|"JWT Token"| ClerkProvider
    User -->|"HTTP (localhost)"| UI
    UI -->|"認証済みリクエスト"| API
    API -->|"HTTPS (API Key)"| OpenAI
    API --> SQLite
    API --> LocalML

    style ClerkAuth fill:#22c55e,color:#fff
    style OpenAI fill:#10b981,color:#fff
    style SQLite fill:#3b82f6,color:#fff
    style LocalML fill:#8b5cf6,color:#fff
```

---

## 認証フロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant UI as React UI
    participant Clerk as Clerk OAuth
    participant API as Hono API
    participant DB as SQLite

    Note over U,DB: 初回アクセス（未認証）
    U->>UI: /ui/ にアクセス
    UI->>UI: ClerkProvider 初期化
    UI->>UI: SignedOut 表示
    UI->>U: ログイン画面表示

    Note over U,DB: OAuth認証フロー
    U->>Clerk: Google/GitHub でログイン
    Clerk->>Clerk: OAuth認証処理
    Clerk->>UI: JWT Token 返却
    UI->>UI: SignedIn 有効化
    UI->>U: メインUI表示

    Note over U,DB: 認証後のAPI呼び出し
    U->>UI: ノート作成リクエスト
    UI->>API: POST /api/command
    API->>DB: INSERT note
    DB->>API: 成功
    API->>UI: { ok: true, data: {...} }
    UI->>U: 結果表示
```

---

## アクセス制御マトリクス

### エンドポイント別アクセス権限

| エンドポイント | 認証 | 説明 |
|--------------|------|------|
| `/` | 不要 | ヘルスチェック |
| `/openapi.json` | 不要 | API仕様書 |
| `/ui/*` | **Clerk必須** | Web UI（SPAフォールバック） |
| `/api/command` | 不要* | 統合Command API |
| `/api/notes/*` | 不要* | ノートCRUD（レガシー） |
| `/api/search/*` | 不要* | 検索API |
| `/api/gpt/*` | 不要* | GPT連携API |
| `/api/clusters/*` | 不要* | クラスタAPI |
| `/api/bookmarks/*` | 不要* | ブックマークAPI |

> *バックエンドAPIは認証不要ですが、**ローカルホスト限定**での実行を想定しています。外部公開時は追加のセキュリティ対策が必要です。

---

## 機密情報管理

```mermaid
flowchart LR
    subgraph EnvFiles["環境変数ファイル"]
        UIEnv["ui/.env\n(Clerk公開キー)"]
        RootEnv[".env\n(APIキー等)"]
    end

    subgraph Secrets["🔑 機密情報"]
        ClerkKey["VITE_CLERK_PUBLISHABLE_KEY\n(公開キー・UIで使用)"]
        OpenAIKey["OPENAI_API_KEY\n(秘密キー・バックエンドのみ)"]
    end

    subgraph Usage["使用場所"]
        Frontend["React UI\n(Clerk認証)"]
        Backend["Hono API\n(Embedding生成)"]
    end

    UIEnv --> ClerkKey
    RootEnv --> OpenAIKey
    ClerkKey --> Frontend
    OpenAIKey --> Backend

    style ClerkKey fill:#22c55e,color:#fff
    style OpenAIKey fill:#ef4444,color:#fff
```

### 環境変数一覧

| 変数名 | 場所 | 種類 | 用途 |
|--------|------|------|------|
| `VITE_CLERK_PUBLISHABLE_KEY` | ui/.env | 公開 | Clerk認証（フロントエンド） |
| `OPENAI_API_KEY` | .env | **秘密** | Embedding生成（バックエンド） |

---

## 外部サービス通信

```mermaid
flowchart TB
    subgraph Local["ローカル環境"]
        App["Brain Cabinet"]
    end

    subgraph External["外部サービス"]
        Clerk["🔐 Clerk\n(clerk.com)"]
        OpenAI["🤖 OpenAI API\n(api.openai.com)"]
    end

    App -->|"HTTPS\nOAuth 2.0\nJWT検証"| Clerk
    App -->|"HTTPS\nBearer Token\nEmbedding API"| OpenAI

    subgraph Security["通信セキュリティ"]
        TLS["TLS 1.2+"]
        Auth["Bearer認証"]
    end
```

### 外部通信詳細

| サービス | プロトコル | 認証方式 | データ |
|---------|-----------|---------|--------|
| Clerk | HTTPS | OAuth 2.0 / JWT | ユーザー認証情報 |
| OpenAI | HTTPS | Bearer Token | ノートテキスト（Embedding用） |

---

## セキュリティ対策

### 実装済み

| 対策 | 説明 |
|------|------|
| **Clerk OAuth** | UI層での認証（Google, GitHub等） |
| **ローカル実行** | localhost限定でAPI公開 |
| **ローカルML** | Xenova/MiniLMによるローカルEmbedding（外部送信最小化） |
| **エラーハンドリング** | グローバルエラーハンドラーで詳細エラー非公開 |
| **リクエストログ** | 全リクエストのログ記録（Pino） |

### 外部公開時の推奨対策

| 対策 | 優先度 | 説明 |
|------|-------|------|
| **API認証** | 必須 | バックエンドAPIにも認証を追加 |
| **CORS設定** | 必須 | 許可オリジンの制限 |
| **Rate Limiting** | 高 | APIレート制限 |
| **HTTPS強制** | 高 | TLS証明書の導入 |
| **WAF** | 中 | Web Application Firewall |
| **CSP** | 中 | Content Security Policy |

---

## データ保護

```mermaid
flowchart LR
    subgraph Storage["データ保存"]
        DB["SQLite\n(data.db)"]
        Embeddings["Embeddings\n(BLOB)"]
    end

    subgraph Protection["保護状態"]
        Local["ローカルファイル\n(ファイルシステム権限)"]
        NoEncrypt["暗号化なし\n(個人利用想定)"]
    end

    DB --> Local
    Embeddings --> Local
    Local --> NoEncrypt
```

### データ分類

| データ種別 | 保存場所 | 暗号化 | バックアップ |
|-----------|---------|--------|-------------|
| ノート本文 | SQLite | なし | ユーザー管理 |
| Embedding | SQLite (BLOB) | なし | ユーザー管理 |
| 認証情報 | Clerk (外部) | あり | Clerk管理 |

---

## 脅威モデル

```mermaid
flowchart TB
    subgraph Threats["想定脅威"]
        T1["🔓 未認証アクセス"]
        T2["💉 インジェクション攻撃"]
        T3["🔑 APIキー漏洩"]
        T4["📡 通信傍受"]
    end

    subgraph Mitigations["対策"]
        M1["Clerk認証\n(UI層)"]
        M2["Drizzle ORM\n(パラメータ化クエリ)"]
        M3["環境変数\n(.envファイル)"]
        M4["HTTPS\n(外部通信)"]
    end

    T1 --> M1
    T2 --> M2
    T3 --> M3
    T4 --> M4
```

---

## 推奨セキュリティチェックリスト

### 開発時

- [ ] `.env` ファイルを `.gitignore` に追加
- [ ] APIキーをハードコードしない
- [ ] 依存パッケージの脆弱性チェック (`pnpm audit`)

### デプロイ時

- [ ] 環境変数を安全に設定
- [ ] HTTPS を有効化
- [ ] 不要なエンドポイントを無効化
- [ ] ファイアウォール設定

### 運用時

- [ ] 定期的なログ監視
- [ ] 依存パッケージの更新
- [ ] Clerkダッシュボードでのセッション管理

---

## 関連ドキュメント

| ドキュメント | 説明 |
|-------------|------|
| [architecture.md](./architecture.md) | システムアーキテクチャ全体 |
| [network-diagram.md](./network-diagram.md) | ネットワーク構成図 |
| [README.md](./README.md) | APIリファレンス |

---

**Brain Cabinet** - Secure Personal Knowledge Base
