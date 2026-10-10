#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
LOCAL_NODE="../.tools/node-v22.22.0-darwin-arm64/bin"
if [ -x "$LOCAL_NODE/node" ]; then
  export PATH="$(cd "$LOCAL_NODE" && pwd):$PATH"
fi
if ! command -v node >/dev/null 2>&1; then
  printf '请先安装 Node.js 22 或更高版本，再重新打开。\n'
  exit 1
fi
if [ ! -d node_modules ]; then
  npm ci
fi
printf '启动后请在浏览器打开 http://127.0.0.1:5174/\n关闭此终端或按 Ctrl+C 可停止预览。\n'
exec npm run dev
