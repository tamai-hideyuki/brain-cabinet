#!/bin/bash

# Brain Cabinet - バックアップスクリプト
# PC移行時にデータをエクスポート

set -e

# 色の定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

success() { echo -e "${GREEN}✓${NC} $1"; }
warning() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

echo "🧠 Brain Cabinet バックアップ"
echo ""

# バックアップディレクトリ
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/backup_${TIMESTAMP}"

mkdir -p "$BACKUP_DIR"

# メインDB
if [ -f "./data.db" ]; then
  cp "./data.db" "$BACKUP_DIR/"
  success "data.db をバックアップしました"
else
  warning "data.db が見つかりません"
fi

# Knowledge DB
KNOWLEDGE_DB="./packages/knowledge/data/knowledge.db"
if [ -f "$KNOWLEDGE_DB" ]; then
  mkdir -p "$BACKUP_DIR/knowledge"
  cp "$KNOWLEDGE_DB" "$BACKUP_DIR/knowledge/"
  success "knowledge.db をバックアップしました"
else
  warning "knowledge.db が見つかりません"
fi

# .envファイル（任意）
if [ -f ".env" ]; then
  cp ".env" "$BACKUP_DIR/"
  success ".env をバックアップしました"
fi

if [ -f "ui/.env" ]; then
  mkdir -p "$BACKUP_DIR/ui"
  cp "ui/.env" "$BACKUP_DIR/ui/"
  success "ui/.env をバックアップしました"
fi

# ZIPアーカイブ作成
ARCHIVE_NAME="brain-cabinet-backup_${TIMESTAMP}.zip"
cd backups
zip -r "$ARCHIVE_NAME" "backup_${TIMESTAMP}"
cd ..

# 一時ディレクトリ削除
rm -rf "$BACKUP_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ バックアップ完了${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "ファイル: ./backups/${ARCHIVE_NAME}"
echo ""
echo "このZIPファイルを新しいPCにコピーして、"
echo "restore.sh で復元してください。"
echo ""
