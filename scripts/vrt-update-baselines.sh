#!/usr/bin/env bash
# VRT ベースライン画像の生成／更新（Linux arm64 = CI と同一のフォント描画）
# ------------------------------------------------------------------
# 使い方（リポジトリルートで）:  bash scripts/vrt-update-baselines.sh
#
# 前提: Docker（Colima 等でも可・無料）。CI は arm64 ランナー
#       （ubuntu-24.04-arm、公開リポジトリは無料）＋同じ Playwright イメージで
#       VRT を回すため、ベースラインも linux/arm64 で生成して arch を一致させる。
#       Apple Silicon なら native、Intel でも arm64 エミュレーションで同一出力。
#
# ローカルの mac で直接 `npx playwright test visual` を回してはいけない
# （フォント描画が CI と異なり必ず不一致になる）。ベースラインは必ず
# 本スクリプト経由（Linux/arm64 コンテナ）で生成すること。
# ------------------------------------------------------------------
set -euo pipefail

IMAGE="mcr.microsoft.com/playwright:v1.61.0-noble"
cd "$(dirname "$0")/.."

docker run --rm --platform=linux/arm64 --network host \
  -v "$PWD":/work -w /work \
  -v /work/node_modules \
  `# ↑ node_modules を匿名ボリュームに分離。バインドマウント直下で npm ci すると` \
  `# ホスト(mac)の node_modules を linux バイナリで上書きし壊すため、それを防ぐ。` \
  -e ANTHROPIC_API_KEY=dummy-key-for-vrt \
  -e NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key-for-vrt \
  "$IMAGE" \
  bash -c '
    set -e
    npm ci --no-audit --no-fund
    npm run build
    # エミュレーション下では build が Playwright の webServer タイムアウトを
    # 超えるため、サーバを先に起動し Playwright には既存サーバを再利用させる。
    npm run start >/tmp/next-start.log 2>&1 &
    for i in $(seq 1 60); do
      if curl -sf http://localhost:3000/try >/dev/null 2>&1; then break; fi
      sleep 2
    done
    # CI を未設定にして reuseExistingServer=true（起動済みサーバを再利用）
    unset CI
    npx playwright test visual --update-snapshots
  '
