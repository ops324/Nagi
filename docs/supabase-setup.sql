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
-- security_invoker = on 必須（v1.82.0）：省略すると definer 実行になり、ビュー所有者
-- （postgres＝RLS 免除）の権限で基底テーブルを読むため、SELECT 権限を持つ *すべての*
-- ロールが全ユーザーの email・活動履歴を取得できる（Supabase Advisor が CRITICAL 判定）。
-- on にすると呼び出し元の権限＋RLS が適用され、管理者は 8. の is_admin() ポリシー経由で
-- 従来どおり全行、一般ユーザーは自分の行のみになる。
create or replace view public.admin_analytics
  with (security_invoker = on) as
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
-- security_invoker = on 必須（v1.82.0）。理由は 9. と同じ。
create or replace view public.admin_emotion_stats
  with (security_invoker = on) as
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

-- RLS を有効化し、ポリシーを1つも作らない＝ anon / authenticated からは全操作デフォルト拒否。
-- このテーブルは API ルートから createAdminClient（service_role）でのみ操作する。
-- ※ v1.82.0 以前のコメントは「RLS を無効化」と書かれていたが実際は有効化しており、記述が誤りだった。
alter table public.rate_limits enable row level security;

-- 12. レート制限チェック関数（アトミック操作）
create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''    -- v1.83.0：本体の参照は public.rate_limits と完全修飾済みのため影響なし
as $$
declare
  v_now timestamptz := now();
  v_record record;
  v_window_start timestamptz;
  v_count integer;
  v_success boolean;
  v_remaining integer;
  v_reset_at timestamptz;
begin
  -- 【多層防御・v1.83.0】引数を安全側にクランプする。
  -- p_window_seconds に 0 や負値を渡されると下の「ウィンドウ期限切れ」分岐が必ず真になり、
  -- count が毎回 1 にリセットされてレート制限が完全に無効化される。
  -- EXECUTE は 17. で service_role のみに絞ったが、将来の再付与・revoke 漏れに備えて
  -- 関数自身でも防ぐ（アプリ側の実使用は全て 3600 秒なので 60 秒下限は当たらない）。
  if p_window_seconds is null or p_window_seconds < 60 then
    p_window_seconds := 60;
  end if;
  if p_limit is null or p_limit < 1 then
    p_limit := 1;
  end if;

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
$$;

-- 13. 古いレート制限レコードを掃除する関数
create or replace function public.cleanup_rate_limits()
returns void
language plpgsql
security definer
set search_path = ''    -- v1.83.0：本体の参照は public.rate_limits と完全修飾済み
as $$
begin
  delete from public.rate_limits where window_start < now() - interval '2 hours';
end;
$$;

-- 14. Nagiのことば お気に入り機能（v1.43.0）
alter table public.entries add column if not exists is_favorited boolean default false;

-- 15. Data API の GRANT（Supabase 2026-05-30 ポリシー変更対応 / v1.82.0 で全面見直し）
--
-- 背景1: 2026-10-30 以降、public スキーマのテーブルは明示的 GRANT がないと
--        supabase-js / PostgREST / GraphQL からアクセス不可になる
-- 背景2: **Supabase プロジェクトの初期状態では anon / authenticated に `grant all` が
--        付与されている**（default privileges 由来）。2026-08-02 に本番を実測したところ、
--        profiles には両ロールとも DELETE/INSERT/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE
--        の7権限すべてが付いていた。つまり「grant を書かない＝権限がない」ではない。
--        したがって **必ず revoke all してから必要な権限だけを grant し直す**。
--        新規テーブル追加時もこの形式を守ること。
--
-- 権限の原則:
--   profiles … 読み取りのみ。書き込みは createAdminClient（service_role）経由に限定
--   entries  … 本人の CRUD（行の制限は RLS）。anon の SELECT は keepalive 用に必要
--   ビュー   … authenticated のみ。security_invoker = on（9. / 10.）で RLS が効く

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

-- anon の SELECT は app/api/cron/keepalive/route.ts が使う（Supabase の7日自動停止対策で
-- anon key から `entries?select=id&limit=1` を叩く）。RLS により結果は 0 件だが Postgres 上で
-- クエリは実行される＝DB アクティビティになる。**剥奪すると 2026-07-05 の自動停止が再発する。**
revoke all on public.entries from anon, authenticated;
grant select on public.entries to anon;
grant select, insert, update, delete on public.entries to authenticated;

revoke all on public.admin_analytics from anon, authenticated;
revoke all on public.admin_emotion_stats from anon, authenticated;
grant select on public.admin_analytics to authenticated;
grant select on public.admin_emotion_stats to authenticated;

-- rate_limits は createAdminClient（service_role）経由のみ使用する。
-- ただし「GRANT を書かない＝権限がない」ではない（背景2）ため、明示的に revoke する。
-- service_role には revoke しない（PostgREST 経由の service_role アクセスに必要）。
revoke all on public.rate_limits from anon, authenticated;

-- 関数の EXECUTE も同様。Postgres は新規関数の EXECUTE を PUBLIC に既定付与するため、
-- 書かなければ anon key から /rest/v1/rpc/ で直接呼べてしまう（詳細は 17.）。
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.cleanup_rate_limits() from public, anon, authenticated;
grant  execute on function public.check_rate_limit(text, integer, integer) to service_role;
grant  execute on function public.cleanup_rate_limits() to service_role;

-- 【revoke してはいけない関数】public.is_admin()
-- RLS ポリシー（8.）の中で呼ばれる関数は「呼び出しロールの権限」で評価されるため、
-- authenticated / anon から EXECUTE を剥がすと profiles / entries の SELECT 自体が
-- permission denied になり、アプリ全体が停止する。anon も keepalive の entries SELECT で
-- ポリシーが評価されるため対象外にすること。

-- 16. 権限昇格と PII 漏洩の封鎖（v1.82.0 / 既存 DB への遡及適用）
--
-- 【背景】
-- 上記 4. の UPDATE ポリシーと 15. の GRANT は、どちらも「列」を限定していなかった。
-- RLS は *行* を制御するが *列* は制御しないため、
-- 認証済みユーザーがブラウザのコンソールから自分の行の任意の列を書き換えられた：
--
--   supabase.from("profiles").update({ is_admin: true }).eq("id", 自分のID)
--
-- これが通ると is_admin()（8. の SECURITY DEFINER 関数）が true を返すようになり、
-- entries の SELECT ポリシー（`auth.uid() = user_id or public.is_admin()`）
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

-- 【本番実測（2026-08-02）】
-- 実際の本番 DB は SQL ファイルの記述よりも権限が広かった。
--   select grantee, privilege_type from information_schema.table_privileges
--   where table_schema='public' and table_name='profiles';
--   → 28 行 ＝ anon / authenticated / postgres / service_role の4ロール × 7権限。
--     anon と authenticated に DELETE/INSERT/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE 全部。
-- 原因は Supabase プロジェクト初期の default privileges（`grant all`）。
-- このため 15. を「revoke all してから grant し直す」形式に全面改訂した。
--
-- 実際に悪用可能だったのは以下の2つ（他は RLS にポリシーが無くデフォルト拒否、
-- TRUNCATE/TRIGGER/REFERENCES は PostgREST から到達不能）：
--   ① authenticated の UPDATE on profiles → is_admin 昇格 → 全ユーザーの日記本文
--   ② 管理ビューの definer 実行 → 一般ユーザーが全ユーザーの email・活動履歴を取得
--      （Supabase Advisor も "Security Definer View" を CRITICAL 判定していた。9./10. で是正）

-- 【適用範囲】
-- 新規環境では 4. / 9. / 10. / 15. を修正済みのため、この節は既存 DB への遡及適用用。
-- 何度実行しても安全（冪等）。2026-08-02 に本番へ適用済み。

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

drop policy if exists "自分のプロフィールのみ更新可" on public.profiles;

revoke all on public.entries from anon, authenticated;
grant select on public.entries to anon;
grant select, insert, update, delete on public.entries to authenticated;

alter view public.admin_analytics set (security_invoker = on);
alter view public.admin_emotion_stats set (security_invoker = on);
revoke all on public.admin_analytics from anon, authenticated;
revoke all on public.admin_emotion_stats from anon, authenticated;
grant select on public.admin_analytics to authenticated;
grant select on public.admin_emotion_stats to authenticated;

-- 【適用後の確認】anon は entries の SELECT のみ、authenticated は profiles/ビューが
-- SELECT・entries が4権限、だけになること
--   select table_name, grantee, privilege_type
--   from information_schema.table_privileges
--   where table_schema = 'public'
--     and table_name in ('profiles','entries','admin_analytics','admin_emotion_stats')
--     and grantee in ('anon','authenticated')
--   order by table_name, grantee, privilege_type;
--
-- 【動作確認】ログイン → 記録の作成／編集／削除、および /admin で全ユーザーが
-- 一覧に出ること（security_invoker = on 後も is_admin() ポリシー経由で全行見える）。
-- 2026-08-02 に実施し、いずれも問題なしを確認済み。


-- 17. レート制限 RPC の封鎖（v1.83.0）
--
-- 【背景】
-- Postgres は新規関数の EXECUTE を PUBLIC に既定付与する。12. / 13. の関数は
-- SECURITY DEFINER であり、EXECUTE を絞っていなかったため、ブラウザに露出している
-- anon key から PostgREST の /rest/v1/rpc/ 経由で誰でも直接呼べる状態だった。
--
-- 【成立していた攻撃】レート制限カウンタのリセット
--   supabase.rpc('check_rate_limit', { p_key: 'comment:<自分のUUID>', p_limit: 1, p_window_seconds: 0 })
-- p_window_seconds = 0 を渡すと 12. の「ウィンドウ期限切れ」分岐
--   v_now > v_record.window_start + (p_window_seconds || ' seconds')::interval
-- が前回呼び出しから 1μs 経過するだけで真になり、count が 1 にリセットされる。
-- p_key は `comment:${userId}`（app/api/comment/route.ts）で userId は自分の JWT の sub
-- ＝ブラウザから自明。戻り値は攻撃者にとって無意味で、副作用（リセット）だけが目的。
-- → 20回/時の制限が事実上無効。**日次・月次上限を足しても同じ手口で回避されるため、
--    ここを塞がずに上限を増やしても意味がない。**
-- 併せて、任意キーで rate_limits に無制限に行を作れる（掃除 cron も未実装）。
--
-- 【なぜ v1.82.1 の後でなければ適用できなかったか】
-- v1.82.1 以前の createAdminClient は cookie を渡していたため authenticated として
-- 実行されており、lib/rate-limit.ts の RPC は「EXECUTE が PUBLIC である」ことに依存して
-- 動いていた。先に revoke すると RPC が権限エラーになり、lib/rate-limit.ts の catch が
-- インメモリストアへ**無言で**降格する（本番ではログも出ない）。
-- v1.82.1（createAdminClient を真の service_role 化）のデプロイ完了後に適用すること。
--
-- 【is_admin() を revoke してはいけない】
-- RLS ポリシー内で呼ばれる関数は呼び出しロールの権限で評価される。authenticated から
-- 剥がすと profiles / entries の SELECT が permission denied になりアプリ全体が停止する。
-- anon も keepalive の entries SELECT でポリシーが評価されるため対象外。
-- handle_new_user() は returns trigger なので直接呼び出しは Postgres が拒否する。
--
-- 【適用範囲】新規環境では 12. / 13. / 15. を修正済みのため、この節は既存 DB への遡及適用用。
-- 何度実行しても安全（冪等）。

revoke all on public.rate_limits from anon, authenticated;

revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.cleanup_rate_limits() from public, anon, authenticated;
grant  execute on function public.check_rate_limit(text, integer, integer) to service_role;
grant  execute on function public.cleanup_rate_limits() to service_role;

-- 12. / 13. の関数本体（引数クランプ ＋ search_path 固定）は上の create or replace を
-- そのまま再実行して反映させること。関数定義の差し替えなので冪等。

-- 【適用後の確認】
-- ① 両方とも false になること
--   select has_function_privilege('authenticated','public.check_rate_limit(text,integer,integer)','EXECUTE') as by_authenticated,
--          has_function_privilege('anon','public.check_rate_limit(text,integer,integer)','EXECUTE')          as by_anon;
-- ② rate_limits の GRANT が anon / authenticated から消えていること
--   select grantee, privilege_type from information_schema.table_privileges
--   where table_schema='public' and table_name='rate_limits' and grantee in ('anon','authenticated');
-- ③ クランプが効いていること（service_role で実行。remaining が毎回減っていくこと）
--   select public.check_rate_limit('clamp-test', 3, 0);   -- 2回続けて実行する
--   delete from public.rate_limits where key = 'clamp-test';
--
-- 【動作確認】記録を投稿できること（レート制限が service_role で正常に働き、
-- インメモリへ降格していないこと）。降格していると 20回/時を超えても 429 が出ない。
