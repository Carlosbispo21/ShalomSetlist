-- Execute em uma nova consulta do SQL Editor. Preserva os hinos existentes.
-- Festividades não têm semana e usam uma pasta permanente, protegendo também
-- contra a função de limpeza antiga, que remove apenas datas anteriores.
begin;
alter table public.scores add column if not exists scope text not null default 'weekly';
alter table public.scores alter column week drop not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.scores'::regclass and conname='scores_scope_check') then
    alter table public.scores add constraint scores_scope_check check (scope in ('weekly','festivity'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.scores'::regclass and conname='scores_retention_check') then
    alter table public.scores add constraint scores_retention_check check (
      (scope='weekly' and week is not null) or (scope='festivity' and week is null)
    );
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.scores'::regclass and conname='scores_collection_path_check') then
    alter table public.scores add constraint scores_collection_path_check check (
      storage_path = room_id::text || '/' || (case when scope='festivity' then 'festivity' else week::text end) || '/' || id::text || '.pdf'
    );
  end if;
end $$;
create index if not exists scores_room_scope_group on public.scores(room_id,scope,group_name);

drop policy if exists "members read current scores" on public.scores;
create policy "members read current scores" on public.scores for select to authenticated using (
  (scope='festivity' or week=public.shalom_week())
  and exists (select 1 from public.members m where m.room_id=scores.room_id and m.user_id=auth.uid())
);
drop policy if exists "director inserts scores" on public.scores;
create policy "director inserts scores" on public.scores for insert to authenticated with check (
  ((scope='festivity' and week is null) or (scope='weekly' and week=public.shalom_week()))
  and public.is_shalom_director(room_id)
);
-- A regra de exclusão continua restrita aos responsáveis da banda.
drop policy if exists "director deletes scores" on public.scores;
create policy "director deletes scores" on public.scores for delete to authenticated using (public.is_shalom_director(room_id));

drop policy if exists "members download current PDFs" on storage.objects;
create policy "members download current PDFs" on storage.objects for select to authenticated using (
  bucket_id='scores'
  and (storage.foldername(storage.objects.name))[2] in ('festivity',public.shalom_week()::text)
  and exists (select 1 from public.members m where m.user_id=auth.uid() and m.room_id::text=(storage.foldername(storage.objects.name))[1])
);
drop policy if exists "director uploads PDFs" on storage.objects;
create policy "director uploads PDFs" on storage.objects for insert to authenticated with check (
  bucket_id='scores'
  and (storage.foldername(storage.objects.name))[2] in ('festivity',public.shalom_week()::text)
  and public.shalom_can_write_pdf(storage.objects.name)
);
commit;
