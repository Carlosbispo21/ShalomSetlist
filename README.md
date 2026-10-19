# Shalom · Partituras

Aplicativo para a banda da igreja: repertório semanal por sábado/domingo e por Crianças, Adolescentes, Jovens, Varões, Irmãs e Grupo de louvor. React + TypeScript, Capacitor para Android e PWA para iPad.

## O que esta primeira versão faz

- Importa um ou vários PDFs, valida arquivos e permite definir grupo, dia e BPM.
- Lê PDF em tela cheia com ferramentas flutuantes, por página (toque nas laterais, botões ou gesto) ou em rolagem contínua. A última página abre o próximo hino do mesmo dia. Zoom de 75% a 200%.
- Caneta com três cores, desfazer e apagar os traços da página. As anotações ficam no aparelho e não alteram o PDF original.
- Cifras e notas digitadas em qualquer ponto da folha, com fonte em pontos, cor, edição e movimentação. Toque nas laterais no modo contínuo para trocar de hino do mesmo dia.
- Metrônomo visual de 30 a 240 BPM com bolinha no canto superior e indicação de quatro batidas. Sem som.
- Salva PDFs em IndexedDB; após o download, a leitura funciona sem internet.
- Mantém a tela acesa durante a leitura quando o aparelho oferece suporte.
- Verifica versões web e APKs publicados e oferece atualização ao sair do leitor.
- Com Supabase configurado: banda com código de 12 caracteres, envio por qualquer membro com login anônimo e conta com e-mail/senha opcional, PDFs privados, permissões por banda e notificações de novos hinos. Uma consulta a cada 30 segundos também recupera atualizações perdidas.
- Na segunda à meia-noite em `America/Sao_Paulo`, o repertório anterior deixa de aparecer; os arquivos locais antigos são removidos ao abrir/retomar o app ou na checagem de um minuto. O Cron abaixo apaga os arquivos no servidor sem depender de um aparelho aberto.

Os exemplos são partituras fictícias criadas para testar o leitor. Não são hinos oficiais. O app inicia vazio; toque em **Explorar com exemplos** se quiser experimentar.

## Rodar no computador

```powershell
npm install
npm run dev
```

Abra `http://localhost:5173`. Copie `.env.example` para `.env` e preencha a chave publicável do Supabase para conectar a banda. Sem `.env`, o app funciona no modo local.

Veja `GUIA_HOSPEDAGEM.md` para a integração GitHub → Cloudflare Pages e `GUIA_DISPONIBILIDADE.md` para a checagem externa do Supabase. Consulte `CHANGELOG.md` para as alterações de cada versão e `GUIA_CIFRAS.md` para usar as cifras.

```powershell
npm test
npm run build
npm run test:e2e
```

Os testes de navegador usam Chrome instalado. `dist/` contém a versão web para hospedagem. Não envie `.env` ou credenciais privadas ao repositório.

## Conectar o celular e os tablets gratuitamente

1. Crie um projeto no plano **Free** em https://supabase.com. Não é preciso colocar uma chave administrativa no aplicativo.
2. Abra SQL Editor e execute **uma vez** `supabase/schema.sql`. Isso cria tabelas, regras de acesso, bucket privado de PDFs e configuração Realtime.
3. Em Authentication → Providers, habilite **Anonymous Sign-Ins**. Mantenha e-mail/senha habilitado. O app respeita a confirmação de e-mail: se ativada, confirme o e-mail antes de entrar. Para uma banda fechada, você também pode criar previamente a conta do responsável pelo painel e manter cadastro público desativado.
4. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com a URL e a chave pública `anon` (legacy) ou publishable do projeto. Nunca use `service_role` ou secret key aqui.
5. Reinicie `npm run dev`, ou recompile `npm run build` e o APK. A configuração é embutida na compilação; um APK anterior à configuração continua no modo local.
6. Para criar a primeira banda, abra **Nossa banda → Conectar à banda → Com minha conta**, marque **Criar uma nova banda** e crie sua conta. Para uma banda existente, use o código já compartilhado.
7. Em qualquer aparelho, abra **Pelo código** e digite o código da banda. Todos já podem usar **Enviar partituras** e **Importar programação**, sem cadastro ou liberação por e-mail.

Todos os membros podem ler e enviar PDFs da própria banda. As permissões de exclusão existentes foram preservadas. O código permite entrar na banda: compartilhe somente com seus músicos. As anotações não são sincronizadas. PDFs locais adicionados antes da conexão permanecem locais; envie-os novamente após conectar à banda para distribuí-los.

### Atualizar o envio para todos os membros (0.3.10)

Em um banco existente atualizado até a 0.3.9, execute `supabase/migrations/20261018_member_uploads.sql` no SQL Editor. A migração pode ser repetida e preserva bandas, contas e PDFs. Em projeto novo, `supabase/schema.sql` já inclui a regra. Publique também o app e `functions/api/drive.js`; só atualizar a interface não libera o envio no banco.

Quem entra pelo código já pode enviar partituras semanais e de festividades, inclusive com sessão anônima. Não há liberação de desenvolvedor ou responsável para enviar hinos. As regras de exclusão continuam restritas aos acessos anteriores; um músico só pode limpar o próprio upload incompleto, sem remover PDFs publicados.

Os testes de permissões executam PostgreSQL local, verificando tanto as migrações históricas quanto a regra atual, inclusive isolamento entre bandas.

O botão **Recarregar** dentro da partitura reinicia o leitor e baixa uma nova cópia quando conectado; offline, reabre o arquivo local. Preserva a página e as anotações, sem apagar os dados do site. Uma cópia local inválida recebe uma tentativa automática de recuperação pela rede.

Leia `GUIA_HOSPEDAGEM.md` para conectar o GitHub ao Cloudflare Pages e instalar no iPad pelo Safari. O envio de `artifacts/shalom-web.zip` também está explicado como alternativa.

### Correção de upload na versão 0.2.1

O envio materializa o PDF em bytes antes da requisição, evitando `ERR_UPLOAD_FILE_CHANGED` ao usar arquivos do seletor Android. Erros indicam se a falha ocorreu na leitura, no upload ou no cadastro. Uma resposta perdida no cadastro é verificada antes de remover um PDF já enviado.

Em banco existente, execute `supabase/migrations/20261010_fix_pdf_storage_policies.sql` para corrigir a regra de escrita do Storage. Ela verifica o caminho do arquivo por uma função de permissão e evita a referência incorreta ao nome da banda. O script inicial `supabase/schema.sql` inclui essa correção. O envio foi validado no Android conectado após aplicar o APK 0.2.1 e essa migração.

### Limpeza automática no servidor

1. Instale a CLI oficial do Supabase e faça login. Vincule o projeto com `supabase link --project-ref SEU-PROJETO`.
2. Defina um segredo aleatório: `supabase secrets set CLEANUP_SECRET=SEU-SEGREDO-ALEATORIO-LONGO`.
3. Implante `supabase functions deploy weekly-cleanup --no-verify-jwt`. A função exige o cabeçalho `x-cleanup-secret`, verificado no servidor, em todas as chamadas. As credenciais administrativas padrão da função permanecem no servidor.
4. Substitua a URL e o segredo em `supabase/cron.sql` e execute uma vez no SQL Editor. Vault guarda o segredo. O job roda diariamente às 00:05 de São Paulo, removendo apenas semanas anteriores. Verifique os logs da função e a tabela `cron.job_run_details` após configurar.

Mesmo antes de configurar o Cron, as regras de leitura no servidor e a tela do app ocultam semanas antigas. Porém os PDFs continuam ocupando armazenamento remoto até a limpeza: configure o job para recuperar a cota gratuita.

## Android: APK

Pré-requisitos: Node.js 22, Android Studio, JDK 21, SDK Android API 36, Build Tools e licenças aceitas.

```powershell
npm run android:sync
```

Para a primeira criação da plataforma, se `android/` não existir, execute antes `npx cap add android` após `npm run build`.

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
Set-Location android
.\gradlew.bat assembleDebug
```

Saída: `android/app/build/outputs/apk/debug/app-debug.apk`. Esse APK é para teste, assinado com a chave de debug. Instale no aparelho e autorize a instalação por essa origem quando o Android solicitar. Para atualizar os aparelhos existentes, preserve a assinatura usada nas versões anteriores. Os comandos de preparação e publicação estão em `GUIA_HOSPEDAGEM.md`; não é necessário publicar na Play Store.

## iPad sem App Store

Hospede `dist/` em um serviço estático com HTTPS (por exemplo, plano gratuito de Cloudflare Pages). No Safari do iPad, abra a URL, toque em **Compartilhar → Adicionar à Tela de Início → Adicionar**. Abra pelo ícone criado, conecte à banda e aguarde o download das partituras.

HTTPS é necessário para a instalação PWA, cache do aplicativo e algumas funções do navegador. Um endereço HTTP na rede local pode abrir a tela, mas não substitui uma instalação offline. Não é preciso conta paga Apple para essa instalação pelo Safari. Publicação nativa pela App Store normalmente exige Apple Developer Program e um Mac para compilar; não é a rota proposta para manter custo zero.

## Custos e limites

O código e as dependências são gratuitos. O plano Free do Supabase tem limites de armazenamento, tráfego e conexões; confira os limites vigentes em https://supabase.com/docs/guides/platform/billing-on-supabase. Comprima PDFs muito grandes e mantenha a limpeza ativa. Não existe promessa de hospedagem ilimitada gratuita. Não habilite um plano pago se a exigência é não ter custo.

O sistema usa o relógio do aparelho para a limpeza local e o relógio do servidor para limitar leituras. Mantenha a data/hora automáticas nos tablets. Com o app fechado, a limpeza física local ocorre na próxima abertura; os sistemas Android/iPadOS não permitem prometer execução à meia-noite com o aplicativo encerrado. O navegador pode remover dados locais se faltar espaço; abra o app e confirme os indicadores de download antes do culto. A fonte personalizada tem fallback para a fonte do sistema, incluindo offline.

## Estrutura

- `src/App.tsx`: repertório, conexão, importação e navegação.
- `src/Reader.tsx`: PDF.js, caneta, zoom e metrônomo.
- `src/domain.ts`: calendário de São Paulo e tipos do repertório.
- `src/db.ts`: PDFs e anotações locais.
- `src/sync.ts`: integração Supabase.
- `supabase/`: banco, permissões e limpeza agendada.

Para validar a sincronização de verdade, configure Supabase, abra dois aparelhos/contextos diferentes, entre pelo código nos dois, envie um PDF em cada aparelho e confirme recebimento, download e isolamento de outra banda. Essa validação depende de um projeto real; os testes locais não a substituem.
