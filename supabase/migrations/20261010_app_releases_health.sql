-- Execute uma vez no SQL Editor. Não altera bandas, contas ou partituras.
begin;
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('app-releases', 'app-releases', true, 83886080,
  array['application/json', 'application/vnd.android.package-archive', 'application/octet-stream'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- Somente o administrador pelo painel publica versões. Nenhuma política de
-- escrita para os usuários do app é concedida neste bucket público.
create or replace function public.shalom_health() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('status', 'ok', 'week', public.shalom_week())
$$;
revoke all on function public.shalom_health() from public;
grant execute on function public.shalom_health() to anon, authenticated;
commit;
