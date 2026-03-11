-- Ubique Prayer Board v2 Schema (PostgreSQL / Supabase)

create extension if not exists "pgcrypto";

-- =========================================================
-- Common trigger function
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- Users
-- =========================================================
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  kakao_id text not null unique,
  name text not null,
  image_url text,
  role text not null default 'member',
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists uq_users_email_ci
  on public.users (lower(email))
  where email is not null and deleted_at is null;

create index if not exists idx_users_kakao_id
  on public.users (kakao_id);

create index if not exists idx_users_active_created
  on public.users (is_active, created_at desc)
  where deleted_at is null;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_users_role'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint chk_users_role
      check (role in ('member', 'leader', 'admin'));
  end if;
end $$;

-- =========================================================
-- Boards
-- Replaces enum(board_type)
-- =========================================================
create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_boards_active_sort
  on public.boards (is_active, sort_order asc, created_at asc);

drop trigger if exists trg_boards_updated_at on public.boards;
create trigger trg_boards_updated_at
before update on public.boards
for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_boards_code'
      and conrelid = 'public.boards'::regclass
  ) then
    alter table public.boards
      add constraint chk_boards_code
      check (code ~ '^[a-z0-9_]+$');
  end if;
end $$;

-- Optional seed data
insert into public.boards (code, name, description, sort_order)
values
  ('prayer', '기도 게시판', '기도제목을 나누는 게시판', 1),
  ('sermon', '설교 게시판', '설교 요약 및 나눔 게시판', 2)
on conflict (code) do nothing;

-- =========================================================
-- Posts
-- =========================================================
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete restrict,
  title text not null,
  content text not null,
  author_user_id uuid not null references public.users(id) on delete restrict,

  is_anonymous boolean not null default false,

  is_pinned boolean not null default false,
  pinned_at timestamptz,

  comment_count integer not null default 0,
  view_count integer not null default 0,

  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_posts_updated_at on public.posts;
create trigger trg_posts_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_posts_comment_count_non_negative'
      and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint chk_posts_comment_count_non_negative
      check (comment_count >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_posts_view_count_non_negative'
      and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint chk_posts_view_count_non_negative
      check (view_count >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_posts_pinned_at_consistency'
      and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint chk_posts_pinned_at_consistency
      check (
        (is_pinned = true and pinned_at is not null)
        or
        (is_pinned = false and pinned_at is null)
      );
  end if;
end $$;

-- 게시판 목록 조회 최적화
create index if not exists idx_posts_board_visible_order
  on public.posts (
    board_id,
    is_pinned desc,
    pinned_at desc nulls last,
    created_at desc
  )
  where deleted_at is null;

-- 작성자 기준 조회
create index if not exists idx_posts_author_visible_created
  on public.posts (author_user_id, created_at desc)
  where deleted_at is null;

-- pinned 전용 조회
create index if not exists idx_posts_board_pinned_only
  on public.posts (board_id, pinned_at desc, created_at desc)
  where deleted_at is null and is_pinned = true;

-- =========================================================
-- Comments
-- v2에서는 대댓글 확장성까지 고려
-- =========================================================
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  author_user_id uuid not null references public.users(id) on delete restrict,
  content text not null,
  is_anonymous boolean not null default false,

  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_comments_updated_at on public.comments;
create trigger trg_comments_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

-- 댓글 조회 최적화
create index if not exists idx_comments_post_visible_created
  on public.comments (post_id, created_at asc)
  where deleted_at is null;

create index if not exists idx_comments_author_visible_created
  on public.comments (author_user_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_comments_parent_visible_created
  on public.comments (parent_comment_id, created_at asc)
  where deleted_at is null and parent_comment_id is not null;

-- post 이동 금지 + parent와 같은 post 강제
create or replace function public.validate_comment_relations()
returns trigger
language plpgsql
as $$
declare
  parent_post_id uuid;
begin
  if tg_op = 'UPDATE' and old.post_id <> new.post_id then
    raise exception 'Changing comments.post_id is not allowed';
  end if;

  if new.parent_comment_id is not null then
    select c.post_id into parent_post_id
    from public.comments c
    where c.id = new.parent_comment_id;

    if parent_post_id is null then
      raise exception 'Parent comment not found';
    end if;

    if parent_post_id <> new.post_id then
      raise exception 'Parent comment must belong to the same post';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_comments_validate_relations on public.comments;
create trigger trg_comments_validate_relations
before insert or update on public.comments
for each row execute function public.validate_comment_relations();

-- =========================================================
-- Comment count sync triggers
-- Soft delete / restore / hard delete 대응
-- =========================================================
create or replace function public.sync_post_comment_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.deleted_at is null then
      update public.posts
      set comment_count = comment_count + 1
      where id = new.post_id;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.deleted_at is null then
      update public.posts
      set comment_count = greatest(comment_count - 1, 0)
      where id = old.post_id;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    -- soft delete
    if old.deleted_at is null and new.deleted_at is not null then
      update public.posts
      set comment_count = greatest(comment_count - 1, 0)
      where id = new.post_id;
    end if;

    -- restore
    if old.deleted_at is not null and new.deleted_at is null then
      update public.posts
      set comment_count = comment_count + 1
      where id = new.post_id;
    end if;

    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_comments_count_insert on public.comments;
create trigger trg_comments_count_insert
after insert on public.comments
for each row execute function public.sync_post_comment_count();

drop trigger if exists trg_comments_count_update on public.comments;
create trigger trg_comments_count_update
after update of deleted_at on public.comments
for each row execute function public.sync_post_comment_count();

drop trigger if exists trg_comments_count_delete on public.comments;
create trigger trg_comments_count_delete
after delete on public.comments
for each row execute function public.sync_post_comment_count();

-- =========================================================
-- Realtime publication
-- =========================================================
do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'comments'
  ) then
    execute 'alter publication supabase_realtime add table public.comments';
  end if;
end $$;

-- =========================================================
-- RLS
-- Client: read only
-- Server (Next.js API + service role): write
-- =========================================================
alter table public.users enable row level security;
alter table public.boards enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;

-- users: client direct read 차단
drop policy if exists users_public_read on public.users;

-- boards: 활성 게시판만 read 허용
drop policy if exists boards_public_read_active on public.boards;
create policy boards_public_read_active
on public.boards
for select
using (is_active = true);

-- posts: 삭제되지 않은 게시글만 read 허용
drop policy if exists posts_public_read_not_deleted on public.posts;
create policy posts_public_read_not_deleted
on public.posts
for select
using (
  deleted_at is null
  and exists (
    select 1
    from public.boards b
    where b.id = board_id
      and b.is_active = true
  )
);

-- comments: 삭제되지 않은 댓글 + 살아있는 post에 속한 댓글만 read 허용
drop policy if exists comments_public_read_not_deleted on public.comments;
create policy comments_public_read_not_deleted
on public.comments
for select
using (
  deleted_at is null
  and exists (
    select 1
    from public.posts p
    join public.boards b on b.id = p.board_id
    where p.id = post_id
      and p.deleted_at is null
      and b.is_active = true
  )
);

-- =========================================================
-- Comments / documentation
-- =========================================================
comment on table public.users is '카카오 로그인 기반 사용자 테이블';
comment on table public.boards is '게시판 마스터 테이블. prayer/sermon 등 확장 가능';
comment on table public.posts is '게시글 테이블';
comment on table public.comments is '댓글 및 대댓글 테이블';

comment on column public.users.email is '카카오 로그인 시 이메일 기준 계정 식별용';
comment on column public.posts.is_anonymous is 'true면 UI에 작성자명을 익명으로 노출';
comment on column public.comments.is_anonymous is 'true면 UI에 작성자명을 익명으로 노출';
comment on column public.posts.is_pinned is '관리자 고정글 여부';
comment on column public.posts.pinned_at is '고정글 정렬용 시간';
comment on column public.posts.comment_count is '목록 조회 성능을 위한 캐시 컬럼';
comment on column public.posts.view_count is '게시글 조회수';
