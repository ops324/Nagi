-- =============================================
-- Nagi（凪）Supabase セットアップSQL
-- Supabase Dashboard > SQL Editor で実行する
-- =============================================

-- 1. profiles テーブル（ユーザー情報）
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- 2. entries テーブル（日記記録）
create table if not exists public.entries (
  id text primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  comment text not null,
  emotions jsonb not null default '[]',
  dominant text not null default '穏やか',
  energy integer not null default 5,
  created_at timestamptz not null,
  insight_level text default 'moderate'  -- "deep" | "moderate" | "gentle"
);

-- insight_level カラム追加（既存DBへの適用）
alter table public.entries add column if not exists insight_level text default 'moderate';

-- note カラム追加（余韻メモ：Nagiのコメントを読んだ後の気づきを保存）
alter table public.entries add column if not exists note text;

-- 3. RLS（Row Level Security）有効化
alter table public.profiles enable row level security;
alter table public.entries enable row level security;

-- 4. profiles ポリシー
create policy "自分のプロフィールのみ参照可"
  on public.profiles for select
  using (auth.uid() = id);

-- v1.82.0 で削除（権限昇格の封鎖。詳細は末尾 16. を参照）
-- RLS は行を制御するが列は制御しないため、列を限定しない UPDATE ポリシーは
-- 自分の行の is_admin を書き換えられてしまう。profiles への書き込みは
-- createAdminClient（service_role）経由のサーバーサイド更新に限定する。
-- create policy "自分のプロフィールのみ更新可"
--   on public.profiles for update
--   using (auth.uid() = id);

-- 5. entries ポリシー
create policy "自分の記録のみ参照可"
  on public.entries for select
  using (auth.uid() = user_id);

create policy "自分の記録のみ作成可"
  on public.entries for insert
  with check (auth.uid() = user_id);

create policy "自分の記録のみ削除可"
  on public.entries for delete
  using (auth.uid() = user_id);

-- 自分の記録のみ更新可（余韻メモ note・お気に入り is_favorited・本文編集で使用）
-- ※ note / お気に入り機能（v1.43.0）から .update() を使用しているため
--   既存DBには適用済みの可能性が高い。記載漏れの補完。重複時はスキップ可
create policy "自分の記録のみ更新可"
  on public.entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 6. 新規ユーザー登録時にprofilesを自動作成するトリガー
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. 管理者権限チェック関数（SECURITY DEFINER でRLSをバイパス）
create or replace function public.is_admin()
returns boolean as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  )
$$ language sql security definer;

-- 8. 管理者用RLSポリシー（全ユーザーデータを参照可）
create policy "管理者は全プロフィール参照可"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "管理者は全エントリ参照可"
  on public.entries for select
  using (auth.uid() = user_id or public.is_admin());

-- 9. 管理者用: 全ユーザーのentries集計ビュー
create or replace view public.admin_analytics as
select
  p.id as user_id,
  p.email,
  p.created_at as registered_at,
  count(e.id) as total_entries,
  max(e.created_at) as last_entry_at,
  avg(e.energy) as avg_energy
from public.profiles p
left join public.entries e on e.user_id = p.id
group by p.id, p.email, p.created_at;

-- 10. 感情集計ビュー
create or replace view public.admin_emotion_stats as
select
  em->>'label' as emotion_label,
  count(*) as count
from public.entries,
  jsonb_array_elements(emotions) as em
group by em->>'label'
order by count desc;

-- 11. レート制限テーブル（分散レート制限用）
create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 1,
  window_start timestamptz not null default now()
);

-- RLSを無効化（サービスロールキーからのみアクセスするため）
-- ※ このテーブルはAPIルートからcreateAdminClientで操作する
alter table public.rate_limits enable row level security;

-- 12. レート制限チェック関数（アトミック操作）
create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb as $$
declare
  v_now timestamptz := now();
  v_record record;
  v_window_start timestamptz;
  v_count integer;
  v_success boolean;
  v_remaining integer;
  v_reset_at timestamptz;
begin
  -- 既存レコードを取得（行ロック）
  select * into v_record from public.rate_limits where key = p_key for update;

  if v_record is null then
    -- 新規: レコード作成
    v_window_start := v_now;
    v_count := 1;
    insert into public.rate_limits (key, count, window_start)
    values (p_key, 1, v_now);
    v_success := true;
    v_remaining := p_limit - 1;
    v_reset_at := v_now + (p_window_seconds || ' seconds')::interval;
  elsif v_now > v_record.window_start + (p_window_seconds || ' seconds')::interval then
    -- ウィンドウ期限切れ: リセット
    update public.rate_limits set count = 1, window_start = v_now where key = p_key;
    v_success := true;
    v_remaining := p_limit - 1;
    v_reset_at := v_now + (p_window_seconds || ' seconds')::interval;
  elsif v_record.count >= p_limit then
    -- 制限超過
    v_success := false;
    v_remaining := 0;
    v_reset_at := v_record.window_start + (p_window_seconds || ' seconds')::interval;
  else
    -- カウント増加
    update public.rate_limits set count = v_record.count + 1 where key = p_key;
    v_success := true;
    v_remaining := p_limit - (v_record.count + 1);
    v_reset_at := v_record.window_start + (p_window_seconds || ' seconds')::interval;
  end if;

  return jsonb_build_object(
    'success', v_success,
    'remaining', v_remaining,
    'reset_at', extract(epoch from v_reset_at) * 1000
  );
end;
$$ language plpgsql security definer;

-- 13. 古いレート制限レコードを掃除する関数
create or replace function public.cleanup_rate_limits()
returns void as $$
begin
  delete from public.rate_limits where window_start < now() - interval '2 hours';
end;
$$ language plpgsql security definer;

-- 14. Nagiのことば お気に入り機能（v1.43.0）
alter table public.entries add column if not exists is_favorited boolean default false;

-- 15. Data API 明示的 GRANT（Supabase 2026-05-30 ポリシー変更対応）
-- 背景: 2026-10-30 以降、public スキーマのテーブルは明示的 GRANT がないと
--       supabase-js / PostgREST / GraphQL からアクセス不可になる
-- 新規テーブル追加時は必ずここに GRANT を追記すること

-- profiles は SELECT のみ（v1.82.0：update を削除。詳細は末尾 16.）
-- 書き込みが必要な列を追加する場合も authenticated に UPDATE を戻さず、
-- createAdminClient（service_role）経由のサーバーサイド更新にすること。
grant select
  on public.profiles
  to authenticated;

grant select, insert, update, delete
  on public.entries
  to authenticated;

grant select
  on public.admin_analytics
  to authenticated;

grant select
  on public.admin_emotion_stats
  to authenticated;

-- rate_limits は createAdminClient（service_role）経由のみ使用するため GRANT 不要

-- 16. profiles の UPDATE 権限を剥奪（v1.82.0 / 権限昇格の封鎖）
--
-- 【背景】
-- 上記 4.（L42-44）の UPDATE ポリシーと 15.（L204-206）の GRANT は、どちらも
-- 「列」を限定していなかった。RLS は *行* を制御するが *列* は制御しないため、
-- 認証済みユーザーがブラウザのコンソールから自分の行の任意の列を書き換えられた：
--
--   supabase.from("profiles").update({ is_admin: true }).eq("id", 自分のID)
--
-- これが通ると is_admin()（L82、SECURITY DEFINER）が true を返すようになり、
-- entries の SELECT ポリシー（L97 の `auth.uid() = user_id or public.is_admin()`）
-- 経由で **全ユーザーの日記本文** が参照可能になる。
-- app/admin/layout.tsx のサーバー側チェックも同じ is_admin を見るため素通りする。
--
-- 【安全性】
-- アプリ側から profiles を UPDATE している箇所は存在しない（2026-08-02 時点）：
--   - app/page.tsx:17            … select("is_admin") のみ
--   - app/admin/layout.tsx:16    … select("is_admin") のみ
--   - app/api/account/delete/route.ts:49 … adminClient（service_role）経由の delete
-- メール／パスワード変更は supabase.auth.updateUser() 経由で profiles を通らない。
-- したがって UPDATE を剥奪しても機能への影響はない。
--
-- 【今後の方針】
-- profiles に書き込みが必要な列（journal_intent / plan 等）を追加する場合は、
-- authenticated に UPDATE を戻さず、必ず createAdminClient（service_role）経由の
-- サーバーサイド更新にすること。列を限定した grant update (col) も可だが、
-- 列追加のたびに GRANT の追記漏れが権限昇格に直結するため推奨しない。

-- 【適用範囲】
-- 新規環境では上記 4. / 15. を修正済みのため、この節は既存 DB への遡及適用用。
-- 何度実行しても安全（冪等）。anon も念のため対象にして GRANT と RLS の2層で防ぐ。

revoke update on public.profiles from authenticated;
revoke update on public.profiles from anon;

drop policy if exists "自分のプロフィールのみ更新可" on public.profiles;

-- 【適用後の確認】以下が 1 行も返さないこと（update が消えていること）
--   select grantee, privilege_type, column_name
--   from information_schema.column_privileges
--   where table_name = 'profiles'
--     and grantee = 'authenticated'
--     and privilege_type = 'UPDATE';
