# Importar a programação pelo Google Drive

A pasta configurada é [shalom](https://drive.google.com/drive/folders/1_uL6Lhot0KkzTIn5pxAtkNm1ZKmadsV4). A integração percorre as subpastas; Avulsos corresponde a Grupo de louvor e Mocidade a Jovens. Não precisa reorganizar a pasta nem usar a conta original se sua conta já consegue baixar os PDFs.

## Configuração única no Google

1. Abra https://script.google.com/home/start com a conta que acessa as partituras e crie um projeto chamado “Importação de partituras”.
2. Substitua `Código.gs` pelo conteúdo de [Code.gs](integrations/google-drive/Code.gs).
3. Em **Configurações do projeto**, marque a opção de exibir `appsscript.json`. Volte ao editor e substitua seu conteúdo pelo arquivo [appsscript.json](integrations/google-drive/appsscript.json). Ele ativa o serviço **Drive API v3** com escopo somente leitura. O serviço também aparece em Serviços → Drive. No projeto padrão do Apps Script, a API é habilitada automaticamente; não precisa criar outro projeto Google Cloud.
4. No editor, selecione a função **testarPasta** e clique em **Executar**. Autorize sua própria conta a ler o Drive. O teste consulta os cinco hinos da mensagem de exemplo e mostra a quantidade de PDFs correspondentes, sem percorrer todo o acervo.
5. Execute a função **criarChave**. Em Configurações do projeto → Propriedades do script, copie o valor de `SHALOM_KEY`. Ele é uma chave privada para esta integração: copie diretamente para o Cloudflare, sem colocá-lo no GitHub ou neste chat.
6. Clique em **Implantar → Nova implantação → Aplicativo da Web**. Escolha **Executar como: você** e **Quem pode acessar: qualquer pessoa**. O script exige a chave privada; o servidor do app verifica a conta de responsável antes de consultar o Google. Copie a URL terminada em `/exec`.

Não compartilhe senha da conta Google. Os PDFs originais não são renomeados, alterados ou apagados. Se alterar o código do script, edite a implantação e publique uma nova versão.

## Configuração única no Cloudflare

1. Entre no [painel do Cloudflare](https://dash.cloudflare.com/) e abra **Workers & Pages**.
2. Clique no projeto **shalomsetlist**, depois em **Settings (Configurações) → Variables and Secrets (Variáveis e segredos)**.
3. Se aparecer a seleção de ambiente, escolha **Production (Produção)**. Clique em **Add (Adicionar)** para cada campo abaixo e salve. Escolha **Text** para a URL e o identificador da banda; escolha **Secret** para a chave.

| Nome | Valor |
|---|---|
| `SHALOM_DRIVE_URL` | `https://script.google.com/macros/s/AKfycbz8e5CPx3QUddepi7lwoWDzRSynAtRfM_2ZF9o0Pv-yT_22sTeGw_UY1naafDiTuPSsYQ/exec` |
| `SHALOM_DRIVE_KEY` | O mesmo valor de `SHALOM_KEY`; salve como segredo |
| `SHALOM_DRIVE_ROOM_ID` | Identificador da sua banda: aparece em Importar programação → Conectar a pasta do Drive |
| `VITE_SUPABASE_URL` | A URL do Supabase já configurada no projeto |
| `VITE_SUPABASE_ANON_KEY` | A chave pública já configurada no projeto |

O código da implantação Google já faz parte da URL; não precisa cadastrá-lo separadamente. A chave é outro valor: copie `SHALOM_KEY` em **Apps Script → Configurações do projeto → Propriedades do script** diretamente para `SHALOM_DRIVE_KEY`. Não envie essa chave no chat.

Na versão 0.3.7 ou posterior do app, entre como responsável e abra **Importar programação → Conectar a pasta do Drive** para copiar o identificador da banda. Ele é um UUID, diferente do código de entrada dos músicos. Se a tela nova ainda não estiver disponível, execute no SQL Editor do Supabase esta consulta somente de leitura e copie o `id` da banda correta:

```sql
select id, name from public.rooms order by name;
```

Depois de salvar, abra **Deployments (Implantações)**, localize a implantação de produção mais recente e use **⋯ → Retry deployment (Repetir implantação)**. O código da integração precisa estar no GitHub nessa implantação. As variáveis `SHALOM_DRIVE_*` são usadas somente no servidor e não devem ter o prefixo `VITE_`. Não é usada a chave `service_role` do Supabase. Não é necessária uma migração SQL. A Function fica em [functions/api/drive.js](functions/api/drive.js); manter o fluxo de build pelo GitHub permite publicar também essa Function.

## Uso semanal

Entre como responsável, abra **Importar programação** e cole a mensagem. Escolha o dia padrão quando a mensagem não informar. Cabeçalhos Sábado e Domingo são reconhecidos; cada hino também pode ter o dia corrigido individualmente.

Toque em **Buscar PDFs no Drive**. Nomes de arquivo e das pastas do hino entram na busca. Diferenças de acentos e maiúsculas são ignoradas. Sugestões por prefixo e versões com o mesmo nome exigem escolha manual. Um PDF classificado em outro grupo não é escolhido. Confira a lista e toque em **Enviar programação para a banda**.

A busca lista nomes em blocos de até mil itens pela Drive API e só entra nas pastas dos hinos solicitados ou em contêineres como PDF, Hinos e Partituras. Pastas de músicas não solicitadas ficam fora da varredura. Use até 50 hinos por importação. Se as pastas das músicas tiverem códigos ou outros nomes que não contenham o título, ajuste esses nomes ou forneça exemplos para adaptar a busca.

O envio acrescenta os hinos ao repertório atual; não apaga os anteriores. PDFs já cadastrados com o mesmo nome de arquivo, grupo, semana e dia são preservados sem novo envio. Se uma transferência falhar, os hinos concluídos permanecem e o botão tenta os restantes.

A versão escolhida de cada hino fica lembrada neste aparelho e nesta banda. Nas próximas consultas, ela é selecionada se ainda fizer parte dos resultados correspondentes. Outro responsável ou outro aparelho poderá precisar escolher sua versão.

## WhatsApp no APK

- **Compartilhar → Shalom:** selecione a mensagem no WhatsApp e compartilhe seu texto com o app. Se o WhatsApp não oferecer o compartilhamento externo desse texto, copie e cole em Importar programação.
- **Recebimento por notificações:** em Importar programação, use **Configurar recebimento automático** e ative a permissão do Shalom nos ajustes do Android. O Android concede acesso às notificações; o código filtra WhatsApp/WhatsApp Business e guarda apenas textos com formato de programação, sem ler histórico ou guardar contatos. Desative a permissão nesses mesmos ajustes para parar.
- O recebimento guarda um rascunho neste celular e não interrompe a partitura aberta. Confira os dias e PDFs antes de enviar. Notificações ocultas, silenciadas, truncadas ou bloqueadas pelo sistema podem não conter o texto necessário; nesses casos use Compartilhar ou copiar/colar.
- No Safari/iPad, use copiar/colar. O acesso às notificações do WhatsApp é uma função do APK Android.

## Custos e validação

A solução usa Apps Script, Cloudflare e o Supabase existente, respeitando as cotas dos planos gratuitos. Não usa IA paga nem a API comercial do WhatsApp. Os testes locais cobrem leitura da mensagem, subpastas e controle de acesso. A leitura da pasta real e o comportamento das notificações precisam ser confirmados depois da configuração nas contas e no celular.

Referências: [Apps Script Web Apps](https://developers.google.com/apps-script/guides/web), [cotas do Apps Script](https://developers.google.com/apps-script/guides/services/quotas), [variáveis das Pages Functions](https://developers.cloudflare.com/pages/functions/bindings/) e [NotificationListenerService Android](https://developer.android.com/reference/android/service/notification/NotificationListenerService).
