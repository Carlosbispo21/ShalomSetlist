# Checagem de disponibilidade

A rotina `.github/workflows/supabase-health.yml` roda quatro vezes por dia, às 02:23, 08:23, 14:23 e 20:23 UTC. Não depende de um celular ligado. Consulta a função `shalom_health` e não modifica dados nem acessa partituras ou contas.

Neste projeto, o endpoint já foi verificado e o workflow foi ativado no repositório `Carlosbispo21/ShalomSetlist`. Veja as execuções em [Actions](https://github.com/Carlosbispo21/ShalomSetlist/actions/workflows/supabase-health.yml). Para testar novamente, use **Run workflow**.

## Configuração em outro projeto

1. Execute `supabase/migrations/20261010_app_releases_health.sql` no SQL Editor.
2. Em GitHub → Settings → Secrets and variables → Actions → **Variables**, cadastre `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`. A segunda é a chave `sb_publishable_…`; ela é pública e as permissões do banco continuam sendo aplicadas. Não use chave secreta/service_role.
3. Mantenha o workflow na branch padrão e habilite Actions.

O Supabase informa que poucas consultas diárias normalmente são suficientes para evitar a pausa por inatividade. Isso reduz o risco, mas não garante disponibilidade no plano gratuito. Se já estiver pausado, abra o painel do Supabase e use **Resume project**; a checagem não retoma projetos pausados.

O GitHub pode atrasar agendamentos e, em repositórios públicos sem atividade por 60 dias, desabilitar rotinas agendadas. Confira periodicamente a página Actions e os avisos por e-mail. Um workflow desabilitado precisa ser reativado.

Fontes: [pausa no Supabase](https://supabase.com/docs/guides/platform/free-project-pausing), [agendamentos no GitHub](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
