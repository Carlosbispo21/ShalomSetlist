-- Execute DEPOIS de implantar weekly-cleanup e definir CLEANUP_SECRET.
-- Substitua os dois valores. Use um segredo aleatório longo, diferente da senha.
-- Não use a service_role key no lugar do segredo.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select vault.create_secret('https://SEU-PROJETO.supabase.co/functions/v1/weekly-cleanup', 'shalom_cleanup_url');
select vault.create_secret('SEU-SEGREDO-ALEATORIO-LONGO', 'shalom_cleanup_secret');
select cron.schedule('shalom-weekly-cleanup', '5 3 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'shalom_cleanup_url' limit 1),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cleanup-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'shalom_cleanup_secret' limit 1)),
    body := '{}'::jsonb
  );
$$);
-- 03:05 UTC = 00:05 em São Paulo. Rodar diariamente permite novas tentativas
-- caso falte conexão na segunda; o app oculta os hinos antigos à meia-noite.
