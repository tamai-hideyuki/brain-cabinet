# Brain Cabinet PC移行ガイド

このドキュメントでは、Brain CabinetのデータとプロジェクトをPCに安全に移行する手順を説明します。

---

## 目次

1. [移行前の準備](#1-移行前の準備)
2. [データのバックアップと圧縮](#2-データのバックアップと圧縮)
3. [ファイルの転送](#3-ファイルの転送)
4. [新PCでのセットアップ](#4-新pcでのセットアップ)
5. [動作確認](#5-動作確認)
6. [トラブルシューティング](#6-トラブルシューティング)

---

## 1. 移行前の準備

### 1.1 アプリケーションの停止

移行前に、Brain Cabinetサーバーが停止していることを確認してください。

```bash
# サーバーが起動している場合は Ctrl+C で停止
```

### 1.2 移行が必要なファイル一覧

| ファイル/ディレクトリ | 説明 | 必須 |
|----------------------|------|------|
| `data.db` | メインデータベース（ノート、履歴、埋め込み等） | ✅ 必須 |
| `data.db-wal` | WAL（Write-Ahead Log）ファイル | ✅ 必須（存在する場合） |
| `data.db-shm` | 共有メモリファイル | ✅ 必須（存在する場合） |
| `.env` | 環境変数（APIキー等） | ✅ 必須 |
| `notes/` | Markdownファイル（同期用） | ⚠️ 任意 |
| `brain.db` | 旧データベース（使用していない場合は不要） | ❌ 任意 |

---

## 2. データのバックアップと圧縮

### 2.1 SQLiteデータベースの安全なバックアップ

**重要**: SQLiteのWALモード使用中は、`data.db`、`data.db-wal`、`data.db-shm`の3ファイルをセットで移動する必要があります。

#### 方法A: WALをマージしてからバックアップ（推奨）

WALファイルをメインDBにマージすることで、単一ファイルでの移行が可能になります。

```bash
cd /path/to/brain-cabinet

# WALをメインDBにマージ（チェックポイント実行）
sqlite3 data.db "PRAGMA wal_checkpoint(TRUNCATE);"

# バックアップを作成
sqlite3 data.db ".backup 'data.backup.db'"

# 整合性チェック
sqlite3 data.backup.db "PRAGMA integrity_check;"
# → "ok" と表示されれば成功
```

#### 方法B: 3ファイルをまとめてバックアップ

WALマージせずにそのまま移行する場合：

```bash
cd /path/to/brain-cabinet

# 3ファイルをまとめてコピー
cp data.db data.db-wal data.db-shm ./backup/
```

### 2.2 圧縮アーカイブの作成

```bash
cd /path/to/brain-cabinet

# 移行用ディレクトリを作成
mkdir -p migration-backup

# 必須ファイルをコピー
cp data.db migration-backup/
cp .env migration-backup/

# WALファイルが存在する場合はコピー（チェックポイント実行済みなら不要）
[ -f data.db-wal ] && cp data.db-wal migration-backup/
[ -f data.db-shm ] && cp data.db-shm migration-backup/

# notesディレクトリをコピー（使用している場合）
[ -d notes ] && cp -r notes migration-backup/

# 圧縮（gzip）
tar -czvf brain-cabinet-backup-$(date +%Y%m%d).tar.gz migration-backup/

# または 圧縮（zip）- Windows互換性が高い
zip -r brain-cabinet-backup-$(date +%Y%m%d).zip migration-backup/
```

### 2.3 バックアップサイズの確認

```bash
# 圧縮前のサイズ
du -sh migration-backup/

# 圧縮後のサイズ
ls -lh brain-cabinet-backup-*.tar.gz
```

---

## 3. ファイルの転送

### 3.1 転送方法の選択

| 方法 | 推奨シーン |
|------|-----------|
| 外部ストレージ（USB/SSD） | 同一ネットワーク外、大容量データ |
| クラウドストレージ | iCloud, Google Drive, Dropbox等 |
| AirDrop | Mac間の転送 |
| scp/rsync | SSH接続可能な場合 |

### 3.2 転送コマンド例

#### AirDrop（Mac間）
Finderで圧縮ファイルを右クリック → 共有 → AirDrop

#### SCP（SSH経由）
```bash
# 旧PCから新PCへ転送
scp brain-cabinet-backup-*.tar.gz user@new-pc:/path/to/destination/
```

#### rsync（ネットワーク経由、差分転送）
```bash
rsync -avz --progress brain-cabinet-backup-*.tar.gz user@new-pc:/path/to/destination/
```

---

## 4. 新PCでのセットアップ

### 4.1 必要なソフトウェアのインストール

```bash
# Node.js (v20以上推奨)
# https://nodejs.org/ または nvm/fnm を使用

# pnpm
npm install -g pnpm

# SQLite3（macOSはデフォルトでインストール済み）
# Linuxの場合: sudo apt install sqlite3
# Windowsの場合: https://sqlite.org/download.html
```

### 4.2 プロジェクトのクローン

```bash
# GitHubからクローン（リポジトリがある場合）
git clone https://github.com/your-username/brain-cabinet.git
cd brain-cabinet

# または、旧PCからプロジェクト全体をコピー
```

### 4.3 バックアップの展開とデータ復元

```bash
cd /path/to/brain-cabinet

# バックアップを展開
tar -xzvf brain-cabinet-backup-*.tar.gz
# または
unzip brain-cabinet-backup-*.zip

# データファイルを配置
cp migration-backup/data.db ./
cp migration-backup/.env ./

# WALファイルがある場合
[ -f migration-backup/data.db-wal ] && cp migration-backup/data.db-wal ./
[ -f migration-backup/data.db-shm ] && cp migration-backup/data.db-shm ./

# notesディレクトリがある場合
[ -d migration-backup/notes ] && cp -r migration-backup/notes ./
```

### 4.4 依存パッケージのインストール

```bash
# ルートディレクトリ
pnpm install

# UIディレクトリ
cd ui && pnpm install && cd ..
```

### 4.5 環境変数の確認

`.env`ファイルを確認し、必要に応じて更新してください：

```bash
cat .env
```

特に以下の項目を確認：
- `CLERK_SECRET_KEY` - Clerk認証キー
- `CLERK_JWT_KEY` - JWT公開鍵
- `API_KEY` - API認証キー

---

## 5. 動作確認

### 5.1 データベースの整合性チェック

```bash
# 整合性チェック
sqlite3 data.db "PRAGMA integrity_check;"
# → "ok" と表示されれば正常

# テーブル一覧の確認
sqlite3 data.db ".tables"

# ノート数の確認
sqlite3 data.db "SELECT COUNT(*) FROM notes;"
```

### 5.2 サーバーの起動テスト

```bash
# 開発サーバーを起動
pnpm dev

# 別ターミナルでUIを起動（必要な場合）
pnpm ui:dev
```

### 5.3 ブラウザでの確認

1. http://localhost:3000/ui/notes にアクセス
2. ノート一覧が正しく表示されることを確認
3. いくつかのノートを開いて内容を確認
4. 検索機能が動作することを確認

---

## 6. トラブルシューティング

### 6.1 「database is locked」エラー

```bash
# WALチェックポイントを実行
sqlite3 data.db "PRAGMA wal_checkpoint(TRUNCATE);"

# それでも解決しない場合、-shmと-walファイルを削除
rm data.db-shm data.db-wal
```

### 6.2 「SQLITE_CORRUPT」エラー

データベースが破損している可能性があります。

```bash
# 修復を試みる
sqlite3 data.db ".recover" | sqlite3 data.recovered.db

# 成功したら置き換え
mv data.db data.db.corrupted
mv data.recovered.db data.db
```

### 6.3 依存パッケージのエラー（hnswlib-node, sharp等）

ネイティブモジュールはプラットフォーム依存のため、再ビルドが必要です。

```bash
# node_modulesを削除して再インストール
rm -rf node_modules
rm -rf ui/node_modules
pnpm install
cd ui && pnpm install
```

### 6.4 埋め込みベクトルの再生成

移行後にセマンティック検索が動作しない場合：

```bash
# 埋め込みを再生成
pnpm init-embeddings
```

---

## クイックリファレンス

### バックアップコマンド（旧PC）

```bash
cd /path/to/brain-cabinet

# 1. サーバー停止（Ctrl+C）

# 2. WALマージ
sqlite3 data.db "PRAGMA wal_checkpoint(TRUNCATE);"

# 3. 圧縮バックアップ作成
tar -czvf ~/Desktop/brain-cabinet-backup.tar.gz data.db .env notes/
```

### 復元コマンド（新PC）

```bash
cd /path/to/brain-cabinet

# 1. バックアップ展開
tar -xzvf ~/Desktop/brain-cabinet-backup.tar.gz

# 2. 依存インストール
pnpm install && cd ui && pnpm install && cd ..

# 3. 整合性確認
sqlite3 data.db "PRAGMA integrity_check;"

# 4. 起動
pnpm dev
```

---

最終更新: 2025-12-30
