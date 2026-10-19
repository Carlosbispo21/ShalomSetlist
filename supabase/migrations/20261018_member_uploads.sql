-- Envio aberto a todos os membros, inclusive quem entrou só pelo código.
-- Preserva bandas, contas, PDFs e a restrição de exclusão existente.
begin;
create or replace function public.is_shalom_member(target_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.members m where m.user_id=auth.uid() and m.room_id=target_room
  )
$$;
revoke all on function public.is_shalom_member(uuid) from public, anon;
grant execute on function public.is_shalom_member(uuid) to authenticated;

drop policy if exists "director inserts scores" on public.scores;
drop policy if exists "members insert scores" on public.scores;
create policy "members insert scores" on public.scores for insert to authenticated with check (
  ((scope='festivity' and week is null) or (scope='weekly' and week=public.shalom_week()))
  and public.is_shalom_member(room_id)
);

drop policy if exists "director uploads PDFs" on storage.objects;
drop policy if exists "members upload PDFs" on storage.objects;
create policy "members upload PDFs" on storage.objects for insert to authenticated with check (
  bucket_id='scores'
  and (storage.foldername(name))[2] in ('festivity',public.shalom_week()::text)
  and exists (select 1 from public.members m
    where m.user_id=auth.uid() and m.room_id::text=(storage.foldername(storage.objects.name))[1])
);

-- Um envio incompleto pode remover somente seu próprio arquivo órfão.
-- PDFs já publicados continuam protegidos contra exclusão por outros membros.
drop policy if exists "members clean incomplete uploads" on storage.objects;
create policy "members clean incomplete uploads" on storage.objects for delete to authenticated using (
  bucket_id='scores' and owner_id=auth.uid()::text
  and exists (select 1 from public.members m
    where m.user_id=auth.uid() and m.room_id::text=(storage.foldername(storage.objects.name))[1])
  and not exists (select 1 from public.scores s where s.storage_path=storage.objects.name)
);
commit;
