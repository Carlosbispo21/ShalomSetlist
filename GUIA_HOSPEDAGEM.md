# Publicar o Shalom para Android e iPad

O Cloudflare Pages hospeda a interface do app. As contas, o repertório e os PDFs ficam no seu Supabase. Pelo GitHub, configure a URL e a chave **pública** nas variáveis de build do Cloudflare, conforme abaixo. Os APKs e o ZIP já compilados neste computador incluem essa configuração.

Guia revisado para a versão **0.3.1**. Use o fluxo pelo GitHub para publicar a web automaticamente.

## Publicar pelo GitHub no Cloudflare Pages

O código está no repositório [Carlosbispo21/ShalomSetlist](https://github.com/Carlosbispo21/ShalomSetlist). O arquivo `.env` local, os APKs, caches e arquivos pessoais ficam fora do Git. Os APKs são distribuídos em **Releases**.

1. No Cloudflare, abra **Workers & Pages → Create application → Pages → Connect to Git**. Autorize o acesso ao repositório `ShalomSetlist`.
2. Selecione a branch **main**. Use estas configurações:

   | Campo | Valor |
   | --- | --- |
   | Framework | React (Vite), ou nenhum preset com os campos abaixo |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | Raiz do repositório, sem subpasta |
   | Node | `22` (o repositório também contém `.nvmrc`) |

3. Em **Environment variables**, adicione para Production e Preview:
   - `VITE_SUPABASE_URL`: `https://vzccxwihuhcjydyjrzym.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: a chave pública `sb_publishable_…` que está no seu `.env` local.
   - `NODE_VERSION`: `22`.
4. Clique em **Save and Deploy**. O Cloudflare mostrará a URL HTTPS `…pages.dev`.
5. No Supabase → Authentication → URL Configuration, defina essa URL em **Site URL** e, se usar confirmação de e-mail, em **Redirect URLs**.
6. No iPad, abra essa URL no Safari e use **Compartilhar → Adicionar à Tela de Início**.

Para conectar à banda já criada, o responsável entra com o mesmo e-mail e senha usados no Android; os músicos usam o código da banda. A versão web atual inclui o leitor em tela cheia, a troca de hino no modo contínuo e a ferramenta **Cifras**, descrita em [GUIA_CIFRAS.md](GUIA_CIFRAS.md).

Depois da conexão, cada `git push` na branch `main` publica a versão web automaticamente. Os aparelhos abertos verificam o service worker a cada minuto e ao retomar o app; mostram **Nova versão disponível** quando a publicação estiver pronta. O aviso aguarda a saída do leitor.

Se o seu projeto Pages atual foi criado com **Direct Upload**, crie um projeto Pages com integração Git para usar esse fluxo. Confira a [integração oficial do Cloudflare](https://developers.cloudflare.com/pages/get-started/git-integration/).

## Alternativa: publicação por ZIP

1. Crie uma conta gratuita em [Cloudflare](https://dash.cloudflare.com/sign-up).
2. Abra **Workers & Pages** e escolha criar um projeto **Pages**, com **Direct Upload / Upload assets**. Os nomes do painel podem variar; escolha a opção de Pages para enviar arquivos prontos.
3. Defina o nome do projeto, por exemplo `shalom-partituras`. Se o nome estiver ocupado, escolha outro.
4. Envie o arquivo **`artifacts/shalom-web.zip`** desta pasta. O `index.html` precisa estar na raiz do ZIP, como no pacote entregue. Também pode enviar a pasta `dist` diretamente.
5. Clique em **Deploy / Deploy site**. O painel mostrará seu endereço, parecido com `https://shalom-partituras.pages.dev`. O endereço real depende da disponibilidade do nome.
6. No Supabase, em **Authentication → URL Configuration**, defina **Site URL** como o endereço publicado. Se usar confirmação de e-mail, inclua esse endereço em **Redirect URLs**. Atualmente seu projeto já permite entrar sem confirmação de e-mail.
7. Abra a URL no celular e em um tablet. No celular do primeiro responsável, crie a conta. Nos demais aparelhos, conecte com o código da banda.

O plano gratuito e o subdomínio `pages.dev` são suficientes para esta versão. Não é necessário comprar domínio. Os serviços têm limites de uso; mantenha os PDFs compactos e a limpeza do servidor configurada.

Documentação oficial: [Direct Upload do Cloudflare Pages](https://developers.cloudflare.com/pages/get-started/direct-upload/), [limites do plano gratuito](https://developers.cloudflare.com/pages/platform/limits/).

## Instalar no iPad

No **Safari**, abra a URL HTTPS publicada. Use **Compartilhar → Adicionar à Tela de Início** e abra o app pelo ícone. Conecte à banda e espere os indicadores de download antes de testar sem internet.

## Mais de um responsável

1. O primeiro responsável cria a banda pelo app.
2. A outra pessoa abre **Banda → Conectar à banda → Sou responsável**, marca **Entrar em uma banda existente**, informa o código e cria sua conta com e-mail e senha, ou entra em uma conta que já tenha.
3. Um responsável já autorizado abre **Banda → Responsáveis** e adiciona o e-mail dessa conta.
4. No aparelho dessa pessoa, toque em **Atualizar repertório**. A permissão também é atualizada automaticamente com a sincronização.

Todos os responsáveis podem enviar/remover hinos e gerenciar responsáveis. O criador da banda não pode ser rebaixado por essa tela. Remover a permissão de alguém mantém a conta como músico. O código da banda permite receber partituras, mas não dá permissão de responsável.

## Atualizações

**Web com integração GitHub:** envie as alterações com `git push` para `main`. O Cloudflare compila e publica automaticamente no mesmo endereço. Não é necessário enviar ZIP nesse fluxo. Se alterar as variáveis de build, solicite um novo deployment para incorporar os novos valores.

**Web por Direct Upload:** execute `npm run build`, compacte o **conteúdo** de `dist` e envie o novo ZIP como deployment **Production** no mesmo projeto Pages.

Na versão web, o aviso **Nova versão disponível** permite aplicar uma atualização. A consulta acontece a cada minuto e ao retomar o app. O aviso fica no repertório; ele não interrompe a leitura de um PDF. Quando um aparelho estiver com uma versão antiga que ainda não tem esse aviso, feche todas as abas/instâncias do app e abra novamente.

No Android, a partir da versão **0.3.0**, o app verifica `latest.json` na branch `main` do GitHub e mostra o mesmo aviso quando há um APK mais novo publicado em Releases. O botão abre o download; o Android pede confirmação de instalação. Instale por cima, com a mesma assinatura, para manter a banda e as anotações. Nos aparelhos anteriores à 0.3.0, instale o [APK mais recente](https://github.com/Carlosbispo21/ShalomSetlist/releases/latest) manualmente uma primeira vez para ativar esse recurso. Atualizar somente o site não substitui o APK.

Antes de publicar, registre as mudanças na próxima versão de `CHANGELOG.md`. Para preparar e publicar a próxima versão no mesmo computador:

```powershell
node scripts/build-release.mjs --bump
git add .
git commit -m "Atualiza Shalom"
git push
npm run release:publish
git pull --ff-only
```

O build incrementa a versão patch, executa verificações e gera APK/ZIP. A publicação usa seu login do GitHub, envia o APK e só anuncia a versão após concluir o upload. A assinatura de teste usada pelo Gradle precisa permanecer a mesma; preserve seu arquivo de assinatura ao trocar de computador. Os APKs entregues ainda são de teste.

O bucket `app-releases` criado no Supabase pode ser usado como alternativa para arquivos públicos de atualização; o fluxo atual distribui pelo GitHub, sem consumir armazenamento dos PDFs. O bucket `scores` permanece privado.

## Disponibilidade do Supabase

A rotina externa já configurada está descrita em `GUIA_DISPONIBILIDADE.md`. Ela consulta o banco quatro vezes por dia; reduz a chance de pausa por inatividade no plano gratuito, sem garantir disponibilidade nem retomar projetos já pausados.

## Limpeza automática dos PDFs

A limpeza da tela/local e as regras de leitura já acompanham a semana. Para liberar espaço dos PDFs antigos no Supabase com o app fechado, configure a função `weekly-cleanup` e o Cron descritos no `README.md`. A hospedagem da interface não configura esse agendamento por conta própria.
