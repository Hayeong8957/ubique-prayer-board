-- Add Amen (Like) feature
-- Safe for existing v2 schema

alter table public.posts
  add column if not exists amen_count integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_posts_amen_count_non_negative'
      and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint chk_posts_amen_count_non_negative
      check (amen_count >= 0);
  end if;
end $$;

create index if not exists idx_posts_board_amen_created
  on public.posts (board_id, amen_count desc, created_at desc)
  where deleted_at is null;

create table if not exists public.post_amens (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists idx_post_amens_user_created
  on public.post_amens (user_id, created_at desc);

create or replace function public.sync_post_amen_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
    set amen_count = amen_count + 1
    where id = new.post_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.posts
    set amen_count = greatest(amen_count - 1, 0)
    where id = old.post_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_post_amens_count_insert on public.post_amens;
create trigger trg_post_amens_count_insert
after insert on public.post_amens
for each row execute function public.sync_post_amen_count();

drop trigger if exists trg_post_amens_count_delete on public.post_amens;
create trigger trg_post_amens_count_delete
after delete on public.post_amens
for each row execute function public.sync_post_amen_count();

alter table public.post_amens enable row level security;

drop policy if exists post_amens_public_read on public.post_amens;
create policy post_amens_public_read
on public.post_amens
for select
using (
  exists (
    select 1
    from public.posts p
    join public.boards b on b.id = p.board_id
    where p.id = post_id
      and p.deleted_at is null
      and b.is_active = true
  )
);

-- Backfill amen_count based on current post_amens rows
update public.posts p
set amen_count = src.cnt
from (
  select post_id, count(*)::int as cnt
  from public.post_amens
  group by post_id
) as src
where p.id = src.post_id;

update public.posts
set amen_count = 0
where amen_count is null;
