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
