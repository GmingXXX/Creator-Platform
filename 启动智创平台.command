#!/bin/zsh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  print '需要 Node.js 20.19+。安装后重新双击本文件。'
  read 'reply?按回车关闭。'
  exit 1
fi
node scripts/serve.mjs --open
