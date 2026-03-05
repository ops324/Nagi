#!/bin/bash
ENV_FILE="/Users/takimototetsuya/Downloads/Claude Project/Nagi/.env.local"

echo ""
echo "=== Supabase 環境変数セットアップ ==="
echo ""
read -p "Project URL (https://xxxxx.supabase.co): " url
read -p "Publishable key (sb_publishable_...): " anon
read -p "Secret key (sb_secret_...): " secret

echo "" >> "$ENV_FILE"
echo "NEXT_PUBLIC_SUPABASE_URL=$url" >> "$ENV_FILE"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$anon" >> "$ENV_FILE"
echo "SUPABASE_SERVICE_ROLE_KEY=$secret" >> "$ENV_FILE"

echo ""
echo "✓ 追記完了！確認:"
grep "SUPABASE" "$ENV_FILE"
