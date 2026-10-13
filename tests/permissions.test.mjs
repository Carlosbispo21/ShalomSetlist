import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('permissões de múltiplos responsáveis no PostgreSQL', async t => {
  const db = new PGlite();
  const owner = '11111111-1111-4111-8111-111111111111', second = '22222222-2222-4222-8222-222222222222';
  const musician = '33333333-3333-4333-8333-333333333333', anonymous = '44444444-4444-4444-8444-444444444444';
  const outsider = '55555555-5555-4555-8555-555555555555';
  const band = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
    create table public.rooms(id uuid primary key default gen_random_uuid(), name text, owner_id uuid unique references auth.users, join_code text unique);
    create table public.members(user_id uuid primary key references auth.users, room_id uuid references public.rooms);
    create table public.scores(id uuid primary key,room_id uuid references public.rooms,week date,title text);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    create function storage.foldername(path text) returns text[] language sql immutable as $$ select (string_to_array(path,'/'))[1:array_length(string_to_array(path,'/'),1)-1] $$;
    create function public.shalom_week() returns date language sql stable as $$ select date_trunc('week',timezone('America/Sao_Paulo',now()))::date $$;
    alter table public.rooms enable row level security; alter table public.members enable row level security;
    alter table public.scores enable row level security; alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to authenticated;
    grant select on public.rooms,public.members,public.scores to authenticated;
    grant insert,delete on public.scores to authenticated;
    grant select,insert,delete on storage.objects to authenticated;
    create policy own_membership on public.members for select to authenticated using(user_id=auth.uid());
    create policy own_room on public.rooms for select to authenticated using(exists(select 1 from public.members m where m.room_id=rooms.id and m.user_id=auth.uid()));
    create policy own_scores on public.scores for select to authenticated using(exists(select 1 from public.members m where m.room_id=scores.room_id and m.user_id=auth.uid()));
    create policy own_storage on storage.objects for select to authenticated using(exists(select 1 from public.members m where m.room_id::text=(storage.foldername(name))[1] and m.user_id=auth.uid()));
  `);
  await db.query('insert into auth.users(id,email,is_anonymous) values ($1,$2,false),($3,$4,false),($5,$6,false),($7,$8,true),($9,$10,false)', [owner,'owner@example.test',second,'second@example.test',musician,'musician@example.test',anonymous,'anonymous@example.test',outsider,'outsider@example.test']);
  await db.query('insert into public.rooms values($1,$2,$3,$4),($5,$6,$7,$8)',[band,'Shalom',owner,'A1B2C3D4E5F6',other,'Outra banda',outsider,'F6E5D4C3B2A1']);
  await db.query('insert into public.members values($1,$2),($3,$2),($4,$2),($5,$2),($6,$7)',[owner,band,second,musician,anonymous,outsider,other]);
  const migration = await readFile(new URL('../supabase/migrations/20261010_multiple_directors.sql',import.meta.url),'utf8');
  await db.exec(migration);
  await db.exec(migration); // Atualização também suporta nova execução.
  const accessMigration = await readFile(new URL('../supabase/migrations/20261013_director_access.sql',import.meta.url),'utf8');
  await db.exec(accessMigration); await db.exec(accessMigration);
  async function actAs(id, anon = false) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[id,JSON.stringify({is_anonymous:anon})]);
    await db.exec('set role authenticated');
  }
  const week = (await db.query('select public.shalom_week()::text as week')).rows[0].week;
  await t.test('reproduz o bloqueio da regra instalada e corrige a referência ao caminho do PDF',async () => {
    await db.exec(`drop policy "director uploads PDFs" on storage.objects;
      create policy "director uploads PDFs" on storage.objects for insert to authenticated with check (
        bucket_id='scores' and exists(select 1 from public.rooms r where r.id::text=(storage.foldername(r.name))[1] and public.is_shalom_director(r.id))
      );`);
    await actAs(owner);
    await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['scores',`${band}/${week}/diagnostic.pdf`]),/row-level security/);
    await db.exec('reset role');
    const fix=await readFile(new URL('../supabase/migrations/20261010_fix_pdf_storage_policies.sql',import.meta.url),'utf8');
    await db.exec(fix); await db.exec(fix);
    await actAs(owner);
    await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['scores',`${band}/${week}/diagnostic.pdf`]);
    assert.equal((await db.query('delete from storage.objects returning id')).rows.length,1);
  });
  await t.test('migração preserva a banda e promove o criador; permite mais um responsável',async () => {
    await actAs(owner);
    assert.equal((await db.query('select public.is_shalom_director($1) as allowed',[band])).rows[0].allowed,true);
    await db.query('select public.grant_shalom_director($1)',['second@example.test']);
    assert.equal((await db.query('select * from public.list_shalom_directors()')).rows.length,2);
  });
  await t.test('segundo responsável pode enviar e remover repertório e PDFs',async () => {
    await actAs(second);
    await db.query('insert into public.scores values($1,$2,$3,$4)',['cccccccc-cccc-4ccc-8ccc-cccccccccccc',band,week,'Teste']);
    await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['scores',`${band}/${week}/test.pdf`]);
    assert.equal((await db.query('delete from public.scores returning id')).rows.length,1);
    assert.equal((await db.query('delete from storage.objects returning id')).rows.length,1);
  });
  await t.test('músico não pode enviar, se promover ou editar seu papel diretamente',async () => {
    await actAs(musician);
    await assert.rejects(db.query('insert into public.scores values($1,$2,$3,$4)',['cccccccc-cccc-4ccc-8ccc-cccccccccccc',band,week,'Teste']),/row-level security/);
    await assert.rejects(db.query('select public.grant_shalom_director($1)',['musician@example.test']),/Somente responsáveis/);
    await assert.rejects(db.query("update public.members set role='director' where user_id=$1",[musician]),/permission denied/);
    await assert.rejects(db.query('select * from public.list_shalom_directors()'),/Acesso restrito/);
  });
  await t.test('criador e o próprio responsável não podem perder a permissão por essa ação',async () => {
    await actAs(second);
    await assert.rejects(db.query('select public.remove_shalom_director($1)',[owner]),/criador/);
    await assert.rejects(db.query('select public.remove_shalom_director($1)',[second]),/própria/);
  });
  await t.test('convite não promove contas anônimas nem contas de outra banda',async () => {
    await actAs(owner);
    await assert.rejects(db.query('select public.grant_shalom_director($1)',['outsider@example.test']),/outra banda/);
    await assert.rejects(db.query('select public.grant_shalom_director($1)',['anonymous@example.test']),/Conta não encontrada/);
    await actAs(anonymous,true);
    await assert.rejects(db.query('select public.create_shalom_room($1)',['Banda indevida']),/e-mail e senha/);
  });
  await t.test('reentrar pelo código preserva permissões; revogar bloqueia novos envios',async () => {
    await actAs(second);
    await db.query('select public.join_shalom_room($1)',['A1B2C3D4E5F6']);
    assert.equal((await db.query('select public.is_shalom_director($1) as allowed',[band])).rows[0].allowed,true);
    await actAs(owner);
    await db.query('select public.remove_shalom_director($1)',[second]);
    await actAs(second);
    assert.equal((await db.query('select public.is_shalom_director($1) as allowed',[band])).rows[0].allowed,false);
    await assert.rejects(db.query('insert into public.scores values($1,$2,$3,$4)',['cccccccc-cccc-4ccc-8ccc-cccccccccccc',band,week,'Teste']),/row-level security/);
  });
  await t.test('liberação por e-mail associa conta criada sem exigir entrada prévia e lista músicos',async()=>{
    await db.exec('reset role');
    const created='66666666-6666-4666-8666-666666666666';
    await db.query('insert into auth.users(id,email,is_anonymous) values($1,$2,false)',[created,'created@example.test']);
    await actAs(owner);
    await db.query('select public.grant_shalom_director($1)',[' CREATED@example.test ']);
    const directory=(await db.query('select * from public.list_shalom_members()')).rows;
    assert.equal(directory.find(member=>member.user_id===created).role,'director');
    assert.equal(directory.find(member=>member.user_id===musician).role,'musician');
    await actAs(created);
    assert.equal((await db.query('select public.is_shalom_director($1) as allowed',[band])).rows[0].allowed,true);
    await actAs(musician);
    await assert.rejects(db.query('select * from public.list_shalom_members()'),/Somente responsáveis/);
  });
  await db.close();
});
