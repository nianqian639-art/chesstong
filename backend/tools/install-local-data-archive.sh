#!/bin/bash
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "$0")/admin-device" && pwd)"
TARGET_DIR="$HOME/Library/Application Support/ChesstongAdmin"
ARCHIVE_DIR="$TARGET_DIR/用户数据归档"

if [ ! -f "$TARGET_DIR/config.json" ] || [ ! -f "$TARGET_DIR/device_key" ]; then
  echo "没有找到已授权的本机数据管理器，未修改任何文件。"
  exit 1
fi

mkdir -p "$ARCHIVE_DIR"
chmod 700 "$ARCHIVE_DIR"
for file in bridge.mjs index.html admin.js style.css archive.cjs; do
  install -m 600 "$SOURCE_DIR/$file" "$TARGET_DIR/$file"
done

echo "本机归档功能已安装。"
echo "归档文件夹：$ARCHIVE_DIR"
echo "请重新双击桌面的‘棋童数据管理.command’启动管理器。"
