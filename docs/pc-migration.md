# PC移行ガイド

Brain Cabinetを別のMacBookに移行する手順です。

## 概要

```
旧PC                          新PC
┌─────────────────┐          ┌─────────────────┐
│ Brain Cabinet   │          │ Brain Cabinet   │
│                 │  ───→    │                 │
│ ./backup.sh     │  ZIP     │ ./restore.sh    │
└─────────────────┘          └─────────────────┘
```

---

## 1. 旧PCでのバックアップ

### 1.1 バックアップの作成

```bash
cd brain-cabinet
./backup.sh
```

以下のファイルが `./backups/` に作成されます：

```
brain-cabinet-backup_YYYYMMDD_HHMMSS.zip
```

### 1.2 バックアップ内容

| ファイル | 内容 |
|---------|------|
| `data.db` | メインDB（ノート、履歴、埋め込みベクトル等） |
| `knowledge/knowledge.db` | Knowledge DB（メモ、カテゴリ、タグ、ブックマーク） |
| `.env` | サーバー側の環境設定（Clerk APIキー等） |
| `ui/.env` | フロントエンド側の環境設定 |

### 1.3 バックアップファイルの転送

作成されたZIPファイルを新PCに転送します：

- **AirDrop** - 最も簡単
- **iCloud Drive** - 両方のMacで同期している場合
- **外部ストレージ** - USBメモリ等
- **ネットワーク共有** - SMB/AFP

---

## 2. 新PCでのセットアップ

### 2.1 前提条件

以下がインストールされている必要があります：

| ツール | 確認コマンド | インストール方法 |
|--------|-------------|-----------------|
| Node.js (v20+) | `node --version` | [nodejs.org](https://nodejs.org/) または `brew install node` |
| pnpm | `pnpm --version` | `npm install -g pnpm` |
| Git | `git --version` | Xcodeと一緒にインストール済み |

### 2.2 リポジトリのクローン

```bash
git clone https://github.com/<username>/brain-cabinet.git
cd brain-cabinet
```

### 2.3 セットアップスクリプトの実行

```bash
./setup.sh
```

このスクリプトは以下を実行します：

1. ✓ pnpmの確認
2. ✓ Node.jsバージョンの確認
3. ✓ 依存関係のインストール (`pnpm install`)
4. ✓ 環境ファイルの作成 (`.env.example` → `.env`)
5. ✓ データベースのマイグレーション

### 2.4 バックアップからの復元

バックアップファイルをプロジェクトディレクトリにコピーし、復元します：

```bash
# バックアップファイルを配置
cp ~/Downloads/brain-cabinet-backup_XXXXXXXX_XXXXXX.zip ./backups/

# 復元を実行
./restore.sh ./backups/brain-cabinet-backup_XXXXXXXX_XXXXXX.zip
```

復元時に以下の確認が表示されます：

```
既存のデータを上書きしますか？ [y/N]: y
.env を上書きしますか？ [y/N]: y
ui/.env を上書きしますか？ [y/N]: y
```

### 2.5 動作確認

```bash
pnpm dev
```

以下のURLでアクセスできます：

- メインアプリ: http://localhost:5173
- Knowledge: http://localhost:5174
- API: http://localhost:3456
- Knowledge API: http://localhost:3457

---

## 3. トラブルシューティング

### pnpmが見つからない

```bash
npm install -g pnpm
```

### Node.jsのバージョンが古い

```bash
# Homebrewの場合
brew upgrade node

# または nvm を使用
nvm install 20
nvm use 20
```

### データベースエラー

マイグレーションを再実行します：

```bash
pnpm migrate
cd packages/knowledge && pnpm migrate && cd ../..
```

### Clerkの認証エラー

`.env` ファイルのAPIキーが正しく設定されているか確認してください：

```bash
# .env
CLERK_SECRET_KEY=sk_test_xxxxx
CLERK_JWT_KEY="-----BEGIN PUBLIC KEY-----
...
-----END PUBLIC KEY-----"

# ui/.env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
```

---

## 4. スクリプト一覧

| スクリプト | 用途 |
|-----------|------|
| `./setup.sh` | 初期セットアップ（クローン後に実行） |
| `./backup.sh` | データのバックアップ作成 |
| `./restore.sh <file>` | バックアップからの復元 |

---

## 5. 定期バックアップ（推奨）

重要なデータを守るため、定期的なバックアップを推奨します：

```bash
# 手動バックアップ
./backup.sh

# cronで自動化（毎日深夜3時）
0 3 * * * cd /path/to/brain-cabinet && ./backup.sh
```

バックアップファイルは `./backups/` に保存されます。
古いバックアップは手動で削除してください。
