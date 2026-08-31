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
--
-- 【不変条件・v1.84.0】interval '2 hours' > アプリ側の最大レート制限ウィンドウ
-- 行の削除はそのキーのカウンタを 0 に戻すことと機能的に同一で、17. で塞いだ攻撃
-- （p_window_seconds = 0 で count をリセット）と同じプリミティブになる。
-- 進行中のウィンドウを消さないことが安全性の前提。2026-08-24 時点の呼び出し元は全て 1 時間：
--   app/api/comment/route.ts（20回/h） / app/api/comment/demo/route.ts（5回/h）
--   app/api/weekly-summary/route.ts（10回/h） / app/api/account/delete/route.ts（3回/h）
-- **2 時間を超えるウィンドウ（日次・月次上限など）を追加する場合は、この interval も必ず広げること。**
-- 怠るとその上限が毎晩リセットされ、エラーもテスト失敗も出さずに無効化される。
-- v1.25.1 の定義以来この関数は一度も呼ばれていなかったため無害だったが、18. で日次実行される。
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
--     and table_name in ('profiles','entries','admin_analytics','admin_emotion_stats','admin_entry_stats')
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
-- 併せて、任意キーで rate_limits に無制限に行を作れた（掃除 cron は 18. で実装）。
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


-- 18. レート制限テーブルの自動掃除（pg_cron / v1.84.0）
--
-- 【背景】
-- 13. の cleanup_rate_limits() は v1.25.1 で定義されたが、**呼び出し元が一度も存在しなかった**
-- （grep で確認：定義と GRANT 以外の参照ゼロ）。そのため rate_limits の行は 2 時間の
-- ウィンドウを過ぎても残り続け、2026-08-24 時点で 2026-06-24 の行が現存していた。
-- 17. で anon / authenticated からの任意キー挿入は塞いだため増加ペースは正規利用分のみだが、
-- 掃除機構がないこと自体は変わらないため、ここで恒久化する。
--
-- 【適用範囲・実行前提】
-- 本節は pg_cron が有効化済みであることを前提とする。**新規環境で 1.〜18. を通しで実行すると、
-- 未有効化の場合ここで `ERROR: schema "cron" does not exist` で停止する**（途中停止を完了と
-- 誤認しないこと）。先に Dashboard → Database → Extensions で pg_cron（1.6.4）を有効化する。
-- 無料プランで利用可（2026-08-24 に本番プロジェクトで実機確認。公式ドキュメント・料金ページの
-- いずれにも記載がなかったため実物で確定した）。SQL で有効化する場合は公式手順に従う：
--   create extension pg_cron with schema pg_catalog;
-- ※ **拡張を無効化すると登録済みジョブが全て永久に削除される**ため OFF に戻さないこと。
--
-- 【実行ロール】—— service_role ではない
-- pg_cron はジョブを **cron.schedule() を呼んだロール**として実行する（cron.job.username）。
-- SQL Editor から登録すれば postgres であり、17. で EXECUTE を grant した service_role ではない。
-- それでも動くのは cleanup_rate_limits() の所有者が postgres であり、
-- `revoke execute ... from public` が所有者の権限を剥がさないためで、17. とは矛盾しない。
-- **別ロールで登録すると (jobname, username) が別扱いになり、上書きではなく2本が並走する。**
-- 必ず SQL Editor（postgres）から実行し、下の確認クエリで username を確認すること。
--
-- 【ジョブ①】レート制限の掃除（毎日 16:00 GMT ＝ JST 翌 01:00）
-- keepalive の Vercel Cron（15:00 GMT）とはログ・切り分けを混ぜないため時刻をずらす
-- （Hobby cron は「時」内でドリフトするため厳密な排他にはならない。競合資源もないので実害なし）。
--
-- 【ジョブ②】実行履歴の purge（毎週日曜 16:30 GMT ＝ **JST 月曜 01:30**）
-- **cron.job_run_details は自動で掃除されない**（公式ドキュメント明記）。1 実行 1 行で増えるため、
-- ①だけ入れると rate_limits より速く増える別テーブルを作ることになり本末転倒。
-- さらに公式は「アップグレード前にこのテーブルを掃除せよ」とし、肥大時は複製処理が
-- ディスクを圧迫して **Postgres バージョンアップグレード自体が失敗しうる**と警告している。
-- ②は将来の有料プラン移行後のアップグレードを詰まらせないための必須要件。
-- 保持を 30 日にしているのは、①②が静かに失敗したときの唯一の診断材料が履歴であるため
-- （日次ジョブなら 30 日でも約 30 行で、掃除の目的と両立する）。
-- end_time is null の行はクラッシュ等で完了更新が入らなかった残骸で、そのままでは永久に残るため
-- start_time 基準でも落とす（実行中の行は 30 日未満なので消えない）。
--
-- 【監視はない】
-- 2 ジョブとも失敗しても通知は飛ばない（cron.job_run_details に status='failed' が残るのみ）。
-- v1.81.0 の keepalive のような dead-man's-switch は持たない。止まっても実害は
-- 「行が溜まる」だけのため釣り合いで見送ったが、**沈黙failure の構造は同じ**である点は自覚しておく。
-- 定期的に下の確認クエリを通すこと。
--
-- 【Postgres バージョンアップグレード後の再登録】
-- 公式ドキュメント: "During the Supabase project upgrade, the pg_cron extension gets dropped
-- and recreated." ジョブ定義（cron.job）が維持されるとは明記されていないため、
-- **アップグレード後は必ず `select * from cron.job;` を確認し、空なら本節を再実行する**。
-- cron.schedule() は同名・同ロールのジョブを上書きするため何度実行しても安全（冪等）。
-- なお料金プランの変更・コンピュートサイズの変更は pg_upgrade を伴わないと考えられるが、
-- **公式ドキュメントは両者について明示していない（要確認）**。いずれの場合も対処は本節の再実行で同じ。

select cron.schedule('nagi-cleanup-rate-limits', '0 16 * * *',
  $$ select public.cleanup_rate_limits() $$);

select cron.schedule('nagi-purge-cron-history', '30 16 * * 0',
  $$ delete from cron.job_run_details
     where end_time < now() - interval '30 days'
        or (end_time is null and start_time < now() - interval '30 days') $$);

-- 【適用後の確認】
-- ① 2 ジョブが active で、username が postgres であること（並走登録の検出も兼ねる）
--   select jobid, jobname, username, schedule, active from cron.job order by jobid;
-- ② スケジュール解釈のタイムゾーン（既定 GMT。GUC で変わりうるため実測する）
--   show cron.timezone;
-- ③ 実行履歴（①は JST 01:00、②は **JST 月曜 01:30** に走る。翌日以降に確認）
--   ※ unschedule 後も履歴は残るため left join にする（内部結合だと結合から落ちる）
--   select j.jobname, d.status, d.start_time
--   from cron.job_run_details d left join cron.job j using (jobid)
--   order by d.start_time desc limit 5;
-- ④ 掃除が効いていること（2 時間より古い行が残っていないこと）
--   select key, window_start from public.rate_limits
--   where window_start < now() - interval '2 hours';
--
-- 【ジョブの削除が必要になった場合】
--   select cron.unschedule('nagi-cleanup-rate-limits');
--   select cron.unschedule('nagi-purge-cron-history');
-- ※ unschedule しても cron.job_run_details の履歴は残る（公式ドキュメント明記）。
--
-- 【keepalive を廃止しないこと】
-- pg_cron が毎日 DB 内でクエリを実行するようになったが、**バックグラウンドワーカーの実行が
-- Supabase の「7日自動停止」判定でアクティビティに数えられるかは公式に定義がない（要確認）**。
-- app/api/cron/keepalive/route.ts は 2026-07-05 の自動停止を受けた恒久対策であり、
-- 本節をもって代替とみなさない。

-- 19. 管理ダッシュボードから日記本文を切り離す（v1.89.0）
-- ------------------------------------------------------------------
-- 【背景】
-- app/admin/page.tsx は `entries` から `content`（日記本文）を全ユーザー分取得していた。
-- 用途は文字数分布（〜50字 / 51〜150字 / 151〜300字 / 301字〜）の集計だけで、
-- 本文そのものは AdminDashboardClient へ渡らず画面にも出ない。
-- それでも本文はアプリのサーバーメモリに載り、管理画面を開くたびに全件が転送されていた。
-- 集計に必要なのは「長さ」だけなので、DB 側で char_length() に畳んでから返す。
--
-- 【この変更で得られるもの／得られないもの】
-- 得られる: アプリの経路から本文が消える（最小権限化）。管理画面を開いても他人の日記本文が
--           サーバーメモリと PostgREST のレスポンスに載らなくなり、漏洩時の被害範囲が縮む。
--           ※ Sentry については、Node SDK は既定でローカル変数をキャプチャせず、
--             lib/log.ts も本文を渡さない設計のため、変更前から載る経路は無かったはず（要確認）。
-- 得られない: 「運営者が読めない」という保証。運営者は SUPABASE_SERVICE_ROLE_KEY と
--           Supabase ダッシュボードを持ち、service_role は RLS を完全にバイパスする。
--           また本文は AI コメント生成のため Anthropic に送信される（app/privacy/page.tsx 4章）。
--           **したがって UI の PRIVACY_ASSURANCE を「ほかの誰にも見えません」へ強めることはできない。**
--
-- 【entries の管理者 SELECT ポリシー（8.）を外さない理由】
-- RLS は *行* を制御する仕組みで、*列* を除外できない。列単位の GRANT は
-- ロール単位でしか効かず、管理者も一般ユーザーも同じ `authenticated` のため区別できない。
-- ポリシーごと落とすと 9. admin_analytics と 10. admin_emotion_stats
-- （どちらも security_invoker = on で entries を読む）が管理者に対して空を返す。
-- 回避するには管理ビュー3本を SECURITY DEFINER 化して内部で is_admin() ガードする必要があるが、
-- v1.82.0 で「管理ビューは security_invoker = on 必須」を定めた経緯（definer 化による
-- PII 漏洩）に逆行し、ガードを1行落とすだけで全ユーザーの日記が漏れる形になる。
-- 一方で得られる実利は「管理者セッションから生の content を引けなくなる」ことだけで、
-- 運営者は上記のとおりダッシュボードから読めるため実質的な効果がない。
-- リスクに見合わないため採らない。
--
-- 【security_invoker = on 必須】9. / 10. と同じ理由（v1.82.0）。
-- on なら呼び出し元の権限＋RLS が適用され、管理者は 8. の is_admin() ポリシー経由で
-- 全行、一般ユーザーは自分の行のみになる（一般ユーザーが読んでも自分の統計しか出ない）。
create or replace view public.admin_entry_stats
  with (security_invoker = on) as
select
  e.user_id,
  char_length(e.content) as content_len,
  e.energy,
  e.dominant,
  e.created_at
from public.entries e;

-- 15. と同じ方針（「GRANT を書かない＝権限がない」ではない）。必ず revoke してから grant する。
revoke all on public.admin_entry_stats from anon, authenticated;
grant select on public.admin_entry_stats to authenticated;

-- 【適用後の確認】
-- ① ビューが security_invoker であること（reloptions に security_invoker=on が入る）
--   select relname, reloptions from pg_class where relname = 'admin_entry_stats';
-- ② content 列が含まれないこと
--   select column_name from information_schema.columns
--   where table_name = 'admin_entry_stats';
-- ③ anon に権限が無く authenticated が SELECT だけであること
--   ※ 所有者(postgres)と service_role の行も返るため、16. の点検クエリと同じく
--     grantee を anon / authenticated に絞る（絞らないと必ず「他の行がある」となり誤判定する）
--   select grantee, privilege_type from information_schema.role_table_grants
--   where table_schema = 'public' and table_name = 'admin_entry_stats'
--     and grantee in ('anon','authenticated');
--
-- ④ 【効果の検証】非管理者セッションで自分の行しか出ないこと
--   （v1.82.0 の教訓＝「設定を書いたつもりで効いていなかった」を繰り返さないため、
--     reloptions だけでなく実際の見え方を確かめる。一般ユーザーでログインしたブラウザから）
--   select count(*) from public.admin_entry_stats;                       -- 自分の記録数と一致すること
--   select count(distinct user_id) from public.admin_entry_stats;        -- 1 であること
--
-- ⑤ PostgREST がビューを認識しない場合はスキーマキャッシュを再読込する
--   （Supabase は DDL イベントトリガで自動リロードするはずだが未確認＝要確認）
--   notify pgrst, 'reload schema';
