-- Somente leitura: não modifica bandas, contas, PDFs ou permissões.
select jsonb_build_object(
  'semana_servidor', public.shalom_week(),
  'politicas_storage', (
    select jsonb_agg(jsonb_build_object(
      'nome', policyname, 'operacao', cmd, 'tipo', permissive,
      'papeis', roles, 'condicao_leitura', qual, 'condicao_escrita', with_check
    ) order by policyname)
    from pg_policies where schemaname = 'storage' and tablename = 'objects'
  ),
  'bucket_pdf', (
    select jsonb_agg(jsonb_build_object('id', id, 'publico', public, 'limite', file_size_limit, 'tipos', allowed_mime_types))
    from storage.buckets where id = 'scores'
  )
) as diagnostico;
