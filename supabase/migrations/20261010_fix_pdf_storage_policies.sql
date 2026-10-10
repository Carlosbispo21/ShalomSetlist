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
