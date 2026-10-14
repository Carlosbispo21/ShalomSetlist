# Conferir e organizar o acervo

Intérprete é o cantor ou grupo que canta o hino: em **Eu Creio - Sarah Beatriz**, o título é Eu Creio e a intérprete é Sarah Beatriz. Esse nome ajuda a distinguir versões. Quando não estiver informado, use apenas o título; o script não inventa o intérprete.

O padrão proposto é **Grupo / Título - Intérprete / PDF / Título - Intérprete - Versão.pdf**, omitindo intérprete e versão quando não houver. Avulsos continua reconhecido como Grupo de louvor, e Mocidade como Jovens. Não é necessário trocar os nomes dessas duas pastas para o app funcionar.

## Primeiro, o relatório

A ferramenta em [integrations/google-drive-audit](integrations/google-drive-audit) é separada da integração já usada pelo app. Ela tem autorização somente de leitura: não renomeia, não move, não converte nem apaga arquivos. Lista:

- Caminhos que fogem de Grupo / Hino / PDF.
- PDFs, imagens, outros formatos e extensões divergentes do tipo informado pelo Drive.
- Nomes genéricos, espaçamento irregular e sugestões para revisão.
- Arquivos com checksum e tamanho iguais, para revisão de possíveis cópias; cópias entre grupos podem ser intencionais.
- A capacidade de edição da conta em cada arquivo, sem conceder nova permissão.

O relatório usa metadados: não abre o conteúdo de cada PDF nem confirma a legibilidade das páginas. Atalhos são identificados e não são percorridos, evitando sair do acervo compartilhado. Título, intérprete, versão e ordem das páginas de imagens precisam de revisão quando não estiverem claros nos nomes.

### Instalar a conferência

1. Crie **outro projeto** no Apps Script, chamado **Conferência do acervo**. Use a conta que acessa a pasta shalom. Não substitua o projeto já conectado ao Cloudflare.
2. Copie [Code.gs](integrations/google-drive-audit/Code.gs) para Código.gs. Adicione um arquivo HTML chamado **Index** e copie [Index.html](integrations/google-drive-audit/Index.html).
3. Nas configurações, exiba o manifesto e substitua appsscript.json por [este manifesto](integrations/google-drive-audit/appsscript.json). Ele usa Drive API v3 com leitura apenas.
4. Execute **testarAuditoria** e autorize a leitura. O teste mostra somente a quantidade de itens do primeiro lote.
5. Implante como **Aplicativo da Web**, **Executar como: você**, **Quem pode acessar: somente você**. O acervo é privado: essa ferramenta não deve ser publicada para qualquer pessoa. Abra sua URL `/exec` logado na conta que publicou.
6. Clique em **Iniciar conferência**. Cada chamada lê no máximo mil itens de uma pasta e retorna antes de continuar a próxima; todo o acervo não precisa caber em uma única execução do Apps Script.
7. Use os filtros para revisar imagens, nomes e caminhos. A tabela exibe até trezentos itens; **Baixar relatório e progresso** inclui todos os itens já lidos e o ponto de continuação em um JSON no seu computador.

Mantenha a aba aberta enquanto roda. Para sair, pause e baixe o progresso; ao voltar, use **Retomar relatório** e **Continuar conferência**. A pausa termina depois do lote atual. O progresso não é salvo automaticamente se fechar a aba. Acervos grandes podem demorar, mas a leitura é retomável. Se a estrutura mudar durante a conferência, inicie uma nova leitura para obter um retrato consistente.

Não configure novos segredos no Cloudflare e não envie a SHALOM_KEY para essa ferramenta. Nenhum relatório é enviado ao Supabase ou publicado no GitHub.

## Aplicar a organização

Esta etapa ainda precisa do relatório real. Para renomear, mover ou criar PDFs no Drive, a conta precisa de acesso de editor e o organizador deverá receber autorização de escrita, separada da ponte de leitura usada pelo app.

Sua preferência para as imagens é **converter para PDF e preservar os originais**. A conversão deverá gerar PDFs reais, sem apenas trocar a extensão. Se várias imagens compõem o mesmo hino, confira a ordem das páginas antes de juntá-las. Imagens sem título ou ordem claros ficam para revisão.

O plano de alterações deve registrar ID, nome e pasta atuais, nome e pasta de destino, conflitos e arquivos novos. Renomeações e mudanças de pasta devem preservar os IDs existentes; o histórico permitirá reverter essas alterações. Não remover cópias, variantes ou originais automaticamente. Não modificar a pasta raiz nem as permissões de compartilhamento.

Referências: [metadados e capacidades dos arquivos no Drive](https://developers.google.com/workspace/drive/api/reference/rest/v3/files), [limites do Apps Script](https://developers.google.com/apps-script/guides/services/quotas) e [chamadas assíncronas pelo HTML Service](https://developers.google.com/apps-script/guides/html/reference/run).
