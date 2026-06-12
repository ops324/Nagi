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

create policy "自分のプロフィールのみ更新可"
  on public.profiles for update
  using (auth.uid() = id);

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

grant select, update
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

-- 16. 遡及記録機能（v1.60.0）
-- 過去 3 日以内であれば、ユーザーが時刻を指定して記録できる。
-- created_at は引き続き「ユーザーが指定した記録対象の日時」を表し、
-- recorded_at に「実際に書いた瞬間」を保持する。
--
-- マイグレーション手順（既存データを壊さない4段階）：
--
-- Step 1: nullable で列追加
alter table public.entries add column if not exists recorded_at timestamptz;

-- Step 2: 既存 NULL を created_at で backfill（必ず Step 3 の前に実行）
update public.entries set recorded_at = created_at where recorded_at is null;
-- 確認: select count(*) from public.entries where recorded_at is null;  -- → 0 になること

-- Step 3: NOT NULL & DEFAULT now() を設定
alter table public.entries alter column recorded_at set not null;
alter table public.entries alter column recorded_at set default now();

-- Step 4: CHECK 制約追加（3 日以内かつ未来不可）
-- backfill 後の既存行は recorded_at = created_at なので全行 PASS する
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'created_within_recorded_window'
  ) then
    alter table public.entries add constraint created_within_recorded_window
      check (created_at <= recorded_at and created_at >= recorded_at - interval '3 days');
  end if;
end $$;
