-- Execute uma vez no SQL Editor do seu projeto Supabase.
create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Banda Shalom' check (char_length(name) between 1 and 80),
  owner_id uuid not null references auth.users(id) on delete cascade unique,
  join_code text not null unique default upper(encode(gen_random_bytes(6), 'hex')),
  created_at timestamptz not null default now()
);
create table if not exists public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  joined_at timestamptz not null default now()
);
create table if not exists public.scores (
  id uuid primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  group_name text not null check (group_name in ('Crianças','Adolescentes','Jovens','Varões','Irmãs','Grupo de louvor')),
  day text not null check (day in ('saturday','sunday')),
  week date not null,
  bpm integer not null check (bpm between 30 and 240),
  pages integer not null check (pages > 0),
  position integer not null default 0,
  filename text not null,
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  check (storage_path = room_id::text || '/' || week::text || '/' || id::text || '.pdf')
);
create index if not exists scores_room_week on public.scores(room_id, week);
create index if not exists members_room on public.members(room_id);
alter table public.rooms enable row level security;
alter table public.members enable row level security;
alter table public.scores enable row level security;
revoke all on public.rooms, public.members, public.scores from anon;
grant select on public.rooms, public.members, public.scores to authenticated;
grant insert, delete on public.scores to authenticated;
grant all on public.rooms, public.members, public.scores to service_role;

create or replace function public.shalom_week() returns date language sql stable
set search_path = '' as $$ select date_trunc('week', timezone('America/Sao_Paulo', now()))::date $$;

create policy "members read own membership" on public.members for select to authenticated using (user_id = auth.uid());
create policy "members read their room" on public.rooms for select to authenticated using (
  owner_id = auth.uid() or exists (select 1 from public.members m where m.room_id = rooms.id and m.user_id = auth.uid())
);
create policy "members read current scores" on public.scores for select to authenticated using (
  week = public.shalom_week() and exists (select 1 from public.members m where m.room_id = scores.room_id and m.user_id = auth.uid())
);
create policy "director inserts scores" on public.scores for insert to authenticated with check (
  week = public.shalom_week() and exists (select 1 from public.rooms r where r.id = scores.room_id and r.owner_id = auth.uid())
);
create policy "director deletes scores" on public.scores for delete to authenticated using (
  exists (select 1 from public.rooms r where r.id = scores.room_id and r.owner_id = auth.uid())
);

create or replace function public.create_shalom_room(room_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Entre com e-mail e senha para criar a banda';
  end if;
  insert into public.rooms(name, owner_id) values (left(trim(room_name),80), auth.uid())
    on conflict (owner_id) do update set name = excluded.name returning id into result;
  insert into public.members(user_id,room_id) values (auth.uid(),result)
    on conflict (user_id) do update set room_id = excluded.room_id;
  return result;
end $$;
create or replace function public.join_shalom_room(room_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  select id into result from public.rooms where join_code = upper(trim(room_code));
  if result is null then raise exception 'Código inválido'; end if;
  insert into public.members(user_id, room_id) values (auth.uid(), result)
    on conflict (user_id) do update set room_id = excluded.room_id;
  return result;
end $$;
revoke all on function public.create_shalom_room(text) from public, anon;
revoke all on function public.join_shalom_room(text) from public, anon;
grant execute on function public.create_shalom_room(text) to authenticated;
grant execute on function public.join_shalom_room(text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('scores','scores',false,20971520,array['application/pdf']) on conflict (id) do nothing;

create policy "members download current PDFs" on storage.objects for select to authenticated using (
  bucket_id = 'scores' and (storage.foldername(name))[2] = public.shalom_week()::text
  and exists (select 1 from public.members m where m.user_id = auth.uid() and m.room_id::text = (storage.foldername(name))[1])
);
create policy "director uploads PDFs" on storage.objects for insert to authenticated with check (
  bucket_id = 'scores' and (storage.foldername(name))[2] = public.shalom_week()::text
  and exists (select 1 from public.rooms r where r.owner_id = auth.uid() and r.id::text = (storage.foldername(storage.objects.name))[1])
);
create policy "director removes PDFs" on storage.objects for delete to authenticated using (
  bucket_id = 'scores' and exists (select 1 from public.rooms r where r.owner_id = auth.uid() and r.id::text = (storage.foldername(storage.objects.name))[1])
);

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='scores') then
    alter publication supabase_realtime add table public.scores;
  end if;
end $$;


-- Atualização incluída: múltiplos responsáveis
-- Execute uma vez no SQL Editor para atualizar uma instalação existente.
-- Também é seguro executar novamente. Não remove bandas, PDFs ou contas.
begin;
alter table public.members add column if not exists role text not null default 'musician';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'members_role_check' and conrelid = 'public.members'::regclass) then
    alter table public.members add constraint members_role_check check (role in ('director','musician'));
  end if;
end $$;
update public.members m set role = 'director' from public.rooms r where r.id = m.room_id and r.owner_id = m.user_id;

create or replace function public.is_shalom_director(target_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and not coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
    and exists (select 1 from public.members m where m.user_id = auth.uid() and m.room_id = target_room and m.role = 'director')
$$;
revoke all on function public.is_shalom_director(uuid) from public, anon;
grant execute on function public.is_shalom_director(uuid) to authenticated;

drop policy if exists "director inserts scores" on public.scores;
create policy "director inserts scores" on public.scores for insert to authenticated with check (
  week = public.shalom_week() and public.is_shalom_director(room_id)
);
drop policy if exists "director deletes scores" on public.scores;
create policy "director deletes scores" on public.scores for delete to authenticated using (public.is_shalom_director(room_id));
drop policy if exists "director uploads PDFs" on storage.objects;
create policy "director uploads PDFs" on storage.objects for insert to authenticated with check (
  bucket_id = 'scores' and (storage.foldername(storage.objects.name))[2] = public.shalom_week()::text
  and exists (select 1 from public.rooms r where r.id::text = (storage.foldername(storage.objects.name))[1] and public.is_shalom_director(r.id))
);
drop policy if exists "director removes PDFs" on storage.objects;
create policy "director removes PDFs" on storage.objects for delete to authenticated using (
  bucket_id = 'scores' and exists (select 1 from public.rooms r where r.id::text = (storage.foldername(storage.objects.name))[1] and public.is_shalom_director(r.id))
);

create or replace function public.create_shalom_room(room_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then raise exception 'Entre com e-mail e senha para criar a banda'; end if;
  select room_id into result from public.members where user_id = auth.uid();
  if result is not null then raise exception 'Esta conta já pertence a uma banda'; end if;
  insert into public.rooms(name, owner_id) values (left(trim(room_name),80), auth.uid())
    on conflict (owner_id) do update set name = excluded.name returning id into result;
  insert into public.members(user_id,room_id,role) values (auth.uid(),result,'director');
  return result;
end $$;
create or replace function public.join_shalom_room(room_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  select id into result from public.rooms where join_code = upper(trim(room_code));
  if result is null then raise exception 'Código inválido'; end if;
  if exists (select 1 from public.rooms where owner_id = auth.uid() and id <> result) then
    raise exception 'O criador de uma banda não pode entrar em outra banda';
  end if;
  -- Reentrar na mesma banda preserva o papel. Mudar de banda exige nova aprovação.
  insert into public.members(user_id,room_id,role) values (auth.uid(),result,'musician')
    on conflict (user_id) do update set
      role = case when public.members.room_id = excluded.room_id then public.members.role else 'musician' end,
      room_id = excluded.room_id;
  return result;
end $$;

create or replace function public.list_shalom_directors()
returns table(user_id uuid, email text, is_owner boolean)
language plpgsql security definer set search_path = '' as $$
declare current_room uuid;
begin
  select room_id into current_room from public.members where public.members.user_id = auth.uid();
  if not public.is_shalom_director(current_room) then raise exception 'Acesso restrito aos responsáveis'; end if;
  return query select m.user_id, u.email::text, (r.owner_id = m.user_id)
    from public.members m join auth.users u on u.id = m.user_id join public.rooms r on r.id = m.room_id
    where m.room_id = current_room and m.role = 'director' order by (r.owner_id = m.user_id) desc, u.email;
end $$;
create or replace function public.grant_shalom_director(target_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare current_room uuid; target_user uuid;
begin
  select room_id into current_room from public.members where user_id = auth.uid();
  if not public.is_shalom_director(current_room) then raise exception 'Acesso restrito aos responsáveis'; end if;
  select u.id into target_user from auth.users u join public.members m on m.user_id = u.id
    where lower(u.email) = lower(trim(target_email)) and m.room_id = current_room and not coalesce(u.is_anonymous,false);
  if target_user is null then raise exception 'Esta conta precisa entrar nesta banda com e-mail e código antes de receber permissão'; end if;
  update public.members set role = 'director' where user_id = target_user and room_id = current_room;
end $$;
create or replace function public.remove_shalom_director(target_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare current_room uuid;
begin
  select room_id into current_room from public.members where user_id = auth.uid();
  if not public.is_shalom_director(current_room) then raise exception 'Acesso restrito aos responsáveis'; end if;
  if target_user = auth.uid() then raise exception 'Não é possível remover a própria permissão'; end if;
  if exists (select 1 from public.rooms where id = current_room and owner_id = target_user) then raise exception 'Não é possível remover o criador da banda'; end if;
  update public.members set role = 'musician' where user_id = target_user and room_id = current_room;
  if not found then raise exception 'Conta não encontrada nesta banda'; end if;
end $$;
revoke all on function public.create_shalom_room(text), public.join_shalom_room(text), public.list_shalom_directors(), public.grant_shalom_director(text), public.remove_shalom_director(uuid) from public, anon;
grant execute on function public.create_shalom_room(text), public.join_shalom_room(text), public.list_shalom_directors(), public.grant_shalom_director(text), public.remove_shalom_director(uuid) to authenticated;
commit;


-- Correção incluída: permissões de escrita de PDFs
-- Corrige a regra que confundia o nome da banda com o caminho do PDF.
-- Preserva contas, bandas, repertório e arquivos existentes.
begin;
create or replace function public.shalom_can_write_pdf(pdf_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
    and exists (
      select 1 from public.members m
      where m.user_id = auth.uid() and m.role = 'director'
        and m.room_id::text = (storage.foldername(pdf_path))[1]
    )
$$;
revoke all on function public.shalom_can_write_pdf(text) from public, anon;
grant execute on function public.shalom_can_write_pdf(text) to authenticated;

drop policy if exists "director uploads PDFs" on storage.objects;
create policy "director uploads PDFs" on storage.objects for insert to authenticated with check (
  bucket_id = 'scores'
  and (storage.foldername(name))[2] = public.shalom_week()::text
  and public.shalom_can_write_pdf(name)
);
drop policy if exists "director removes PDFs" on storage.objects;
create policy "director removes PDFs" on storage.objects for delete to authenticated using (
  bucket_id = 'scores' and public.shalom_can_write_pdf(name)
);
commit;
