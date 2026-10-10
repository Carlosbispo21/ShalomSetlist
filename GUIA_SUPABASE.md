# Conectar a banda Shalom: passo a passo

Você pode testar o app e abrir seus PDFs antes de fazer esta configuração. Estes passos ativam o envio do celular para os tablets.

## 1. Criar uma conta gratuita

Abra [supabase.com](https://supabase.com) e crie uma conta. No painel, crie uma organização no plano **Free** se solicitado. Não escolha uma assinatura paga.

## 2. Criar o projeto

Escolha **New project**. Use o nome `Shalom`. Crie uma senha forte para o banco e guarde-a com você. Escolha a região de São Paulo se estiver disponível e confirme a criação. Aguarde o projeto ficar pronto.

**Não é necessário enviar sua senha para configurar o aplicativo.**

## 3. Criar o banco e o espaço dos PDFs

No menu do projeto, abra **SQL Editor → New query**. No computador, abra o arquivo `supabase/schema.sql` desta pasta, copie todo o conteúdo, cole no editor e clique em **Run**. Execute uma única vez, em um projeto novo.

Para a checagem externa de disponibilidade da versão 0.3.0, execute depois `supabase/migrations/20261010_app_releases_health.sql` em uma nova consulta. A configuração do agendamento está em `GUIA_DISPONIBILIDADE.md`.

Isso cria a banda, os músicos, a lista de hinos e um espaço privado para PDFs. As regras permitem que os músicos leiam e que só o responsável envie/remova os hinos.

## 4. Liberar a entrada dos tablets

Na área **Authentication**, procure a configuração **Anonymous Sign-Ins** e ative-a. Dependendo da versão do painel, fica em **Providers** ou **Sign In / Providers**. O tablet passa a ter uma identidade própria sem exigir e-mail de cada músico.

Mantenha a entrada por **Email** ativada para o responsável. Se a confirmação de e-mail estiver ativada, o responsável confirma o e-mail antes de entrar no app. Não ative CAPTCHA sem também adicionar a integração de CAPTCHA ao aplicativo.

## 5. Obter os dois dados públicos

Abra o diálogo **Connect** do projeto e localize:

- **Project URL**, parecida com `https://abcdefgh.supabase.co`.
- **Publishable key**, normalmente começando com `sb_publishable_`.

Também é possível encontrar a chave em **Settings → API Keys**. Se usar a chave antiga, escolha somente a **anon/public**.

Envie a URL e essa chave pública nesta conversa, ou preencha o arquivo `.env` conforme `.env.example`. **Não envie a chave secret/service_role, senha do banco ou token de acesso.** A chave pública é feita para uso no app; as permissões são garantidas pelas regras do banco.

Referência oficial: [chaves de API do Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

## 6. Conectar os aparelhos

Depois de incluir a configuração e recompilar o app:

1. No celular do responsável: **Nossa banda → Conectar à banda → Sou responsável**.
2. Crie a conta no app, confirme o e-mail se solicitado e entre. O código da banda aparecerá na tela.
3. Em cada tablet: **Conectar à banda → Sou músico**, e digite o código de 12 caracteres.
4. No celular: **Repertório → Enviar partituras**, escolha os PDFs, sábado/domingo e o grupo.
5. Aguarde os tablets baixarem. O símbolo **✓** ao lado da partitura indica que está salva no aparelho.

Teste com dois aparelhos antes do primeiro culto. Depois desligue a internet de um tablet e confirme que o PDF baixado continua abrindo.

## 7. Ativar a limpeza remota semanal

A tela já deixa de mostrar hinos antigos na segunda-feira. Para também liberar o espaço dos PDFs no servidor automaticamente, configure a função e o agendamento descritos na seção **Limpeza automática no servidor** do `README.md`.

Essa etapa usa a CLI do Supabase e um segredo próprio para a limpeza. O segredo fica no servidor e não nos tablets. Se preferir, faça primeiro os passos 1 a 6 e podemos terminar juntos o agendamento depois.

## Atualizar um projeto existente para vários responsáveis

Em uma **nova consulta** no SQL Editor, cole o conteúdo atual de `supabase/migrations/20261010_multiple_directors.sql` e execute. Não execute `schema.sql` novamente em um banco já criado. A migração preserva bandas, contas e PDFs e também atualiza as políticas de upload.

O envio por mais de um responsável e a hospedagem web estão explicados no `GUIA_HOSPEDAGEM.md`.

## Correção de envio no Android (versão 0.2.1)

O APK 0.2.1 envia os bytes do PDF para evitar `ERR_UPLOAD_FILE_CHANGED` do seletor Android. Para bancos criados com as regras anteriores, execute também `supabase/migrations/20261010_fix_pdf_storage_policies.sql`: ela corrige a verificação do caminho do PDF e preserva contas, bandas e arquivos.

Essa combinação foi validada com upload no aparelho conectado. O arquivo `supabase/diagnostico_upload.sql` apenas consulta as regras e pode ser usado em novos diagnósticos.

## iPad

Para instalar no iPad sem App Store, a versão web precisa ser hospedada em um endereço **HTTPS**. Depois, no Safari: **Compartilhar → Adicionar à Tela de Início**. O arquivo APK é somente para Android.
