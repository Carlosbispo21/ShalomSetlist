import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('festividades persistem e respeitam permissões e caminhos privados', async t => {
  const db = new PGlite();
  const owner='11111111-1111-4111-8111-111111111111', musician='22222222-2222-4222-8222-222222222222', outsider='33333333-3333-4333-8333-333333333333';
  const band='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
    create table public.rooms(id uuid primary key,name text,owner_id uuid unique references auth.users,join_code text);
    create table public.members(user_id uuid primary key references auth.users,room_id uuid references public.rooms);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text default auth.uid()::text);
    create function storage.foldername(path text) returns text[] language sql immutable as $$ select (string_to_array(path,'/'))[1:array_length(string_to_array(path,'/'),1)-1] $$;
    create function public.shalom_week() returns date language sql stable as $$ select date '2026-10-12' $$;
  `);
  await db.exec(schema.match(/create table if not exists public.scores \([\s\S]+?\r?\n\);/)[0]);
  await db.exec(`
    alter table public.members enable row level security; alter table public.scores enable row level security; alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to authenticated;
    grant select on public.members,public.rooms,public.scores to authenticated;
    grant insert,delete on public.scores to authenticated; grant select,insert,delete on storage.objects to authenticated;
    create policy own_membership on public.members for select to authenticated using(user_id=auth.uid());
  `);
  await db.query('insert into auth.users(id,email) values($1,$2),($3,$4),($5,$6)',[owner,'owner@test.local',musician,'musician@test.local',outsider,'outsider@test.local']);
  await db.query('insert into public.rooms values($1,$2,$3,$4),($5,$6,$7,$8)',[band,'Shalom',owner,'CODE',other,'Outra',outsider,'OTHER']);
  await db.query('insert into public.members values($1,$2),($3,$2),($4,$5)',[owner,band,musician,outsider,other]);
  for (const file of ['20261010_multiple_directors.sql','20261010_fix_pdf_storage_policies.sql','20261010_festivities.sql','20261010_festivities.sql'])
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url),'utf8'));
  async function actor(id, anonymous=false) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[id,JSON.stringify({is_anonymous:anonymous})]);
    await db.exec('set role authenticated');
  }
  const eventId='cccccccc-cccc-4ccc-8ccc-cccccccccccc', weeklyId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  async function score(id,scope,week,path) {
    return db.query('insert into public.scores(id,room_id,title,group_name,day,week,bpm,pages,filename,storage_path,scope) values($1,$2,$3,$4,$5,$6,80,1,$7,$8,$9)',[id,band,'Hino','Jovens','saturday',week,'hino.pdf',path,scope]);
  }
  await t.test('responsável envia PDF permanente e metadados sem semana', async () => {
    await actor(owner);
    await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['scores',`${band}/festivity/${eventId}.pdf`]);
    await score(eventId,'festivity',null,`${band}/festivity/${eventId}.pdf`);
  });
  await t.test('limpeza semanal antiga e nova preservam festividade e seu arquivo', async () => {
    await db.exec('reset role');
    await score(weeklyId,'weekly','2026-10-05',`${band}/2026-10-05/${weeklyId}.pdf`);
    assert.equal((await db.query("delete from public.scores where week < public.shalom_week() returning id")).rows.length,1);
    assert.equal((await db.query("delete from public.scores where scope='weekly' and week < public.shalom_week() returning id")).rows.length,0);
    assert.equal((await db.query('select id from public.scores')).rows[0].id,eventId);
    assert.equal((await db.query('select name from storage.objects')).rows.length,1);
  });
  await t.test('músico inclusive anônimo lê, mas não envia nem remove festividade', async () => {
    await actor(musician,true);
    assert.equal((await db.query('select * from public.scores')).rows.length,1);
    assert.equal((await db.query('select * from storage.objects')).rows.length,1);
    assert.equal((await db.query('delete from public.scores returning id')).rows.length,0);
    assert.equal((await db.query('delete from storage.objects returning id')).rows.length,0);
    await assert.rejects(score(weeklyId,'festivity',null,`${band}/festivity/${weeklyId}.pdf`),/row-level security/);
    await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['scores',`${band}/festivity/${weeklyId}.pdf`]),/row-level security/);
  });
  await t.test('outra banda não tem acesso aos PDFs ou metadados permanentes', async () => {
    await actor(outsider);
    assert.equal((await db.query('select * from public.scores')).rows.length,0);
    assert.equal((await db.query('select * from storage.objects')).rows.length,0);
  });
  await t.test('caminho e semana impedem misturar festividade com pasta de limpeza', async () => {
    await actor(owner);
    await assert.rejects(score(weeklyId,'festivity',null,`${band}/2026-10-12/${weeklyId}.pdf`),/check constraint/);
    await assert.rejects(score(weeklyId,'festivity','2026-10-12',`${band}/festivity/${weeklyId}.pdf`),/row-level security|check constraint/);
    await assert.rejects(score(weeklyId,'weekly',null,`${band}/festivity/${weeklyId}.pdf`),/row-level security|check constraint/);
    await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['scores',`${band}/2026-10-05/${weeklyId}.pdf`]),/row-level security/);
  });
  await t.test('responsável pode excluir manualmente PDF e metadados permanentes', async () => {
    await actor(owner);
    assert.equal((await db.query('delete from storage.objects returning id')).rows.length,1);
    assert.equal((await db.query('delete from public.scores returning id')).rows.length,1);
  });
  await t.test('nova regra permite enviar pelo código sem liberar conta, preservando isolamento e exclusões',async()=>{
    await db.exec('reset role');
    const migration=await readFile(new URL('../supabase/migrations/20261018_member_uploads.sql',import.meta.url),'utf8');
    await db.exec(migration);await db.exec(migration);
    for(const anonymous of [false,true]) {
      await actor(musician,anonymous);
      for(const [id,scope,week,folder] of [[eventId,'festivity',null,'festivity'],[weeklyId,'weekly','2026-10-12','2026-10-12']]) {
        const path=`${band}/${folder}/${id}.pdf`;
        await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['scores',path]);
        await score(id,scope,week,path);
        assert.equal((await db.query('delete from public.scores returning id')).rows.length,0);
        assert.equal((await db.query('delete from storage.objects returning id')).rows.length,0);
        await actor(outsider);
        assert.equal((await db.query('select * from public.scores')).rows.length,0);
        assert.equal((await db.query('select * from storage.objects')).rows.length,0);
        await assert.rejects(score(id,scope,week,path),/row-level security/);
        await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['scores',path]),/row-level security/);
        await actor(owner);
        await db.query('delete from storage.objects');await db.query('delete from public.scores');
        await actor(musician,anonymous);
      }
    }
    await actor(musician,true);
    await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['scores',`${band}/2026-10-05/expired.pdf`]),/row-level security/);
    const orphan=`${band}/festivity/orphan.pdf`;
    await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['scores',orphan]);
    await actor(owner);
    await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['scores',`${band}/festivity/owner-orphan.pdf`]);
    await actor(musician,true);
    assert.deepEqual((await db.query('delete from storage.objects returning name')).rows.map(row=>row.name),[orphan]);
    await actor('44444444-4444-4444-8444-444444444444',true);
    await assert.rejects(score(eventId,'festivity',null,`${band}/festivity/${eventId}.pdf`),/row-level security/);
    assert.equal((await db.query('select * from storage.objects')).rows.length,0);
  });
  await db.close();
});
