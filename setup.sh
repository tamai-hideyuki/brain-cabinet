#!/bin/bash

# Brain Cabinet - セットアップスクリプト
# MacBook用

set -e

echo "🧠 Brain Cabinet セットアップを開始します..."
echo ""

# 色の定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# チェックマーク関数
success() {
  echo -e "${GREEN}✓${NC} $1"
}

warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

error() {
  echo -e "${RED}✗${NC} $1"
}

# 1. pnpmの確認
echo "📦 パッケージマネージャーの確認..."
if ! command -v pnpm &> /dev/null; then
  error "pnpmがインストールされていません"
  echo "  以下のコマンドでインストールしてください:"
  echo "  npm install -g pnpm"
  exit 1
fi
success "pnpm が見つかりました: $(pnpm --version)"

# 2. Node.jsバージョンの確認
echo ""
echo "🔍 Node.jsバージョンの確認..."
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  warning "Node.js v20以上を推奨します (現在: $(node --version))"
else
  success "Node.js $(node --version)"
fi

# 3. 依存関係のインストール
echo ""
echo "📥 依存関係をインストール中..."
pnpm install
success "依存関係のインストール完了"

# 4. .envファイルのセットアップ
echo ""
echo "⚙️  環境設定ファイルのセットアップ..."

if [ ! -f ".env" ]; then
  cp .env.example .env
  success ".env を作成しました"
  warning ".env ファイルを編集してClerk APIキーを設定してください"
else
  success ".env は既に存在します"
fi

if [ ! -f "ui/.env" ]; then
  cp ui/.env.example ui/.env
  success "ui/.env を作成しました"
  warning "ui/.env ファイルを編集してClerk公開キーを設定してください"
else
  success "ui/.env は既に存在します"
fi

# 5. データベースのセットアップ
echo ""
echo "🗄️  データベースのセットアップ..."

# メインDBのマイグレーション
pnpm migrate
success "メインデータベースのマイグレーション完了"

# KnowledgeパッケージのDBマイグレーション
echo ""
echo "📚 Knowledge データベースのセットアップ..."
cd packages/knowledge
pnpm migrate
success "Knowledge データベースのマイグレーション完了"
cd ../..

# 6. 完了メッセージ
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 セットアップが完了しました！${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "次のステップ:"
echo "  1. .env ファイルにClerkのAPIキーを設定"
echo "  2. ui/.env にClerkの公開キーを設定"
echo "  3. pnpm dev で開発サーバーを起動"
echo ""
echo "Clerkの設定は https://clerk.com のダッシュボードから取得できます"
echo ""
