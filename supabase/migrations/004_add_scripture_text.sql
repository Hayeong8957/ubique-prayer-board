-- Add sermon-specific field (scripture text) to unified posts table

alter table public.posts
  add column if not exists scripture_text text;

comment on column public.posts.scripture_text is '주일 말씀 게시글에서 노출할 말씀 구절';
