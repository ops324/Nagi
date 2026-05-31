-- =============================================
-- Nagi ローカル開発用シードデータ
-- supabase start / supabase db reset で自動実行される
-- =============================================
-- 注意: このファイルはローカル開発専用。本番DBには適用しないこと。
--       テスト用パスワードはハッシュ化されているが、ローカル限定の固定値。

-- ---------------------------------------------
-- 1. テストユーザーを auth.users + auth.identities に直接挿入
--    （メール確認は config.toml の enable_confirmations = false で不要）
-- ---------------------------------------------

do $$
declare
  dev_user_id   uuid := '00000000-0000-0000-0000-000000000001';
  admin_user_id uuid := '00000000-0000-0000-0000-000000000002';
begin
  -- 既存があればスキップ（idempotent）
  if not exists (select 1 from auth.users where email = 'dev@nagi.local') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', dev_user_id, 'authenticated', 'authenticated',
      'dev@nagi.local', crypt('nagidev', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), dev_user_id, dev_user_id::text,
      jsonb_build_object('sub', dev_user_id::text, 'email', 'dev@nagi.local', 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  if not exists (select 1 from auth.users where email = 'admin@nagi.local') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', admin_user_id, 'authenticated', 'authenticated',
      'admin@nagi.local', crypt('nagiadmin', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), admin_user_id, admin_user_id::text,
      jsonb_build_object('sub', admin_user_id::text, 'email', 'admin@nagi.local', 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;
end $$;

-- ---------------------------------------------
-- 2. 管理者フラグを付与
--    （handle_new_user() トリガーで profiles は自動作成済み）
-- ---------------------------------------------

update public.profiles
   set is_admin = true
 where email = 'admin@nagi.local';

-- ---------------------------------------------
-- 3. dev ユーザーのサンプル entries
--    （カレンダー・グラフが空にならないよう数件）
-- ---------------------------------------------

insert into public.entries (id, user_id, content, comment, emotions, dominant, energy, created_at, insight_level, is_favorited)
values
  (
    'seed-001',
    '00000000-0000-0000-0000-000000000001',
    '今日は風が涼しくて、散歩中に少しだけ心がほどけた気がする。',
    '風の感触に意識を向けられたのですね。心がほどける、という言葉の奥に、どんな静けさが在るのでしょうか。',
    '[{"label":"穏やか","score":0.7},{"label":"安心","score":0.4}]'::jsonb,
    '穏やか', 7,
    now() - interval '2 days',
    'moderate',
    false
  ),
  (
    'seed-002',
    '00000000-0000-0000-0000-000000000001',
    '仕事で集中しきれず、夕方になって少し疲れを感じた。',
    '集中しきれない時間と、そこから生まれた疲れが、淡々と記されているのですね。',
    '[{"label":"疲れ","score":0.6},{"label":"混乱","score":0.3}]'::jsonb,
    '疲れ', 4,
    now() - interval '1 day',
    'gentle',
    false
  ),
  (
    'seed-003',
    '00000000-0000-0000-0000-000000000001',
    '友人と話していて、自分のなかに小さな期待が動いていることに気づいた。',
    '期待という言葉が、自分のなかに動くのを観測されたのですね。それは、どの方向を向いているのでしょうか。',
    '[{"label":"希望","score":0.6},{"label":"喜び","score":0.4}]'::jsonb,
    '希望', 7,
    now() - interval '3 hours',
    'deep',
    true
  )
on conflict (id) do nothing;
