alter table public.posts
add column if not exists image_urls text[] not null default '{}';

comment on column public.posts.image_urls is '게시글에 첨부된 이미지 public URL 배열';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists post_images_public_read on storage.objects;
create policy post_images_public_read
on storage.objects
for select
using (bucket_id = 'post-images');
