insert into public.boards (code, name, description, sort_order)
values (
  'horeb',
  '호렙산 기도회 게시판',
  '호렙산 기도회 말씀을 나누는 게시판',
  3
)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;
