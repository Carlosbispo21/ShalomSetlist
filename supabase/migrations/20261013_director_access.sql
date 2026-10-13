-- Facilita a liberação de responsáveis. Preserva contas, bandas e PDFs.
begin;
create or replace function public.list_shalom_members()
returns table(user_id uuid, email text, role text, is_owner boolean, is_anonymous boolean)
language plpgsql security definer set search_path = '' as $$
declare current_room uuid;
begin
  select m.room_id into current_room from public.members m where m.user_id=auth.uid();
  if not public.is_shalom_director(current_room) then raise exception 'Somente responsáveis podem gerenciar os acessos'; end if;
  return query select m.user_id, coalesce(u.email,'')::text, m.role::text, r.owner_id=m.user_id, coalesce(u.is_anonymous,false)
    from public.members m join auth.users u on u.id=m.user_id join public.rooms r on r.id=m.room_id
    where m.room_id=current_room order by (r.owner_id=m.user_id) desc, m.role, u.email;
end $$;
create or replace function public.grant_shalom_director(target_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare current_room uuid; target_user uuid; target_room uuid;
begin
  select m.room_id into current_room from public.members m where m.user_id=auth.uid();
  if not public.is_shalom_director(current_room) then raise exception 'Somente responsáveis podem liberar o envio de partituras'; end if;
  select u.id into target_user from auth.users u where lower(u.email)=lower(trim(target_email)) and not coalesce(u.is_anonymous,false);
  if target_user is null then raise exception 'Conta não encontrada. A pessoa precisa criar uma conta com este e-mail primeiro'; end if;
  select m.room_id into target_room from public.members m where m.user_id=target_user;
  if target_room is not null and target_room<>current_room then raise exception 'Esta conta está em outra banda. Peça que ela entre nesta banda pelo código'; end if;
  if exists(select 1 from public.rooms r where r.owner_id=target_user and r.id<>current_room) then raise exception 'Esta conta criou outra banda. Use uma conta que pertença a esta banda'; end if;
  insert into public.members(user_id,room_id,role) values(target_user,current_room,'director')
    on conflict(user_id) do update set role='director';
end $$;
revoke all on function public.list_shalom_members(), public.grant_shalom_director(text) from public, anon;
grant execute on function public.list_shalom_members(), public.grant_shalom_director(text) to authenticated;
commit;
