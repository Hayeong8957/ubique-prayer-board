alter table public.posts
add column if not exists status text not null default 'published';

alter table public.posts
add column if not exists published_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_posts_status'
      and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint chk_posts_status
      check (status in ('draft', 'published'));
  end if;
end $$;

update public.posts
set
  status = 'published',
  published_at = coalesce(published_at, created_at)
where status is distinct from 'published'
   or published_at is null;

create table if not exists public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  object_path text,
  public_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_post_images_post_sort
  on public.post_images (post_id, sort_order asc, created_at asc);

insert into public.post_images (post_id, object_path, public_url, sort_order)
select
  p.id,
  null,
  image_url,
  image_ordinality - 1
from public.posts p
cross join lateral unnest(coalesce(p.image_urls, '{}')) with ordinality as legacy_image(image_url, image_ordinality)
where not exists (
  select 1
  from public.post_images pi
  where pi.post_id = p.id
);

alter table public.post_images enable row level security;

drop policy if exists posts_public_read_not_deleted on public.posts;
create policy posts_public_read_not_deleted
on public.posts
for select
using (
  status = 'published'
  and deleted_at is null
  and exists (
    select 1
    from public.boards b
    where b.id = board_id
      and b.is_active = true
  )
);

drop policy if exists post_images_public_read on public.post_images;
create policy post_images_public_read
on public.post_images
for select
using (
  exists (
    select 1
    from public.posts p
    join public.boards b on b.id = p.board_id
    where p.id = post_id
      and p.status = 'published'
      and p.deleted_at is null
      and b.is_active = true
  )
);

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
      and p.status = 'published'
      and p.deleted_at is null
      and b.is_active = true
  )
);

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
      and p.status = 'published'
      and p.deleted_at is null
      and b.is_active = true
  )
);

comment on table public.post_images is '게시글 이미지 메타데이터 테이블';
comment on column public.posts.status is 'draft 또는 published';
comment on column public.posts.published_at is '게시글이 공개된 시각';
comment on column public.post_images.object_path is 'Supabase Storage object path. legacy URL만 있는 데이터는 null일 수 있음';
comment on column public.post_images.public_url is '클라이언트 노출용 public URL';
comment on column public.post_images.sort_order is '이미지 노출 순서';
