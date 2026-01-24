#!/bin/bash

# Brain Cabinet - リストアスクリプト
# バックアップからデータを復元

set -e

# 色の定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

success() { echo -e "${GREEN}✓${NC} $1"; }
warning() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

echo "🧠 Brain Cabinet リストア"
echo ""

# 引数チェック
if [ -z "$1" ]; then
  echo "使用方法: ./restore.sh <バックアップファイル.zip>"
  echo ""
  echo "例: ./restore.sh ./backups/brain-cabinet-backup_20240124_120000.zip"
  echo ""

  # 利用可能なバックアップを表示
  if [ -d "./backups" ]; then
    echo "利用可能なバックアップ:"
    ls -la ./backups/*.zip 2>/dev/null || echo "  (バックアップファイルがありません)"
  fi
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  error "ファイルが見つかりません: $BACKUP_FILE"
  exit 1
fi

# 一時ディレクトリに展開
TEMP_DIR=$(mktemp -d)
unzip -q "$BACKUP_FILE" -d "$TEMP_DIR"

# バックアップディレクトリを特定
BACKUP_DIR=$(find "$TEMP_DIR" -type d -name "backup_*" | head -1)

if [ -z "$BACKUP_DIR" ]; then
  error "バックアップの形式が不正です"
  rm -rf "$TEMP_DIR"
  exit 1
fi

echo "バックアップを展開しました: $(basename "$BACKUP_DIR")"
echo ""

# 既存データの確認
EXISTING_DATA=false
if [ -f "./data.db" ] || [ -f "./packages/knowledge/data/knowledge.db" ]; then
  EXISTING_DATA=true
  warning "既存のデータが検出されました"
  echo ""
  read -p "既存のデータを上書きしますか？ [y/N]: " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "キャンセルしました"
    rm -rf "$TEMP_DIR"
    exit 0
  fi
  echo ""
fi

# メインDBの復元
if [ -f "$BACKUP_DIR/data.db" ]; then
  cp "$BACKUP_DIR/data.db" "./data.db"
  success "data.db を復元しました"
else
  warning "バックアップに data.db がありません"
fi

# Knowledge DBの復元
if [ -f "$BACKUP_DIR/knowledge/knowledge.db" ]; then
  mkdir -p "./packages/knowledge/data"
  cp "$BACKUP_DIR/knowledge/knowledge.db" "./packages/knowledge/data/"
  success "knowledge.db を復元しました"
else
  warning "バックアップに knowledge.db がありません"
fi

# .envファイルの復元（確認付き）
if [ -f "$BACKUP_DIR/.env" ]; then
  if [ -f ".env" ]; then
    read -p ".env を上書きしますか？ [y/N]: " confirm_env
    if [ "$confirm_env" = "y" ] || [ "$confirm_env" = "Y" ]; then
      cp "$BACKUP_DIR/.env" "./.env"
      success ".env を復元しました"
    else
      warning ".env はスキップしました"
    fi
  else
    cp "$BACKUP_DIR/.env" "./.env"
    success ".env を復元しました"
  fi
fi

if [ -f "$BACKUP_DIR/ui/.env" ]; then
  if [ -f "ui/.env" ]; then
    read -p "ui/.env を上書きしますか？ [y/N]: " confirm_ui_env
    if [ "$confirm_ui_env" = "y" ] || [ "$confirm_ui_env" = "Y" ]; then
      cp "$BACKUP_DIR/ui/.env" "./ui/.env"
      success "ui/.env を復元しました"
    else
      warning "ui/.env はスキップしました"
    fi
  else
    mkdir -p "./ui"
    cp "$BACKUP_DIR/ui/.env" "./ui/.env"
    success "ui/.env を復元しました"
  fi
fi

# 一時ディレクトリ削除
rm -rf "$TEMP_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ リストア完了${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "pnpm dev でアプリケーションを起動できます。"
echo ""
