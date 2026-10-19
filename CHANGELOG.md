# Alterações

## 0.3.10

- Remove o modo responsável da interface: todos que entram pelo código da banda podem enviar hinos e importar a programação, sem liberação por e-mail.
- Entrada por conta usa uma banda existente por padrão; criar outra banda exige uma escolha explícita. As permissões atuais de exclusão foram preservadas.
- Botão Recarregar dentro da partitura: busca uma nova cópia sem cache quando há conexão, reabre a cópia local offline e preserva página e anotações.
- Recupera automaticamente PDFs locais corrompidos pela rede. Limita a memória dos canvases e libera os recursos ao fechar ou recarregar, para reduzir falhas de leitura nos iPads.
- Banco existente: executar `supabase/migrations/20261018_member_uploads.sql` antes de disponibilizar o novo app. Apps Script não precisa ser alterado; publicar também a função `/api/drive` atualizada.

## 0.3.9

- Permite importar as partituras selecionadas mesmo quando outros hinos não foram encontrados ou ficaram sem versão escolhida.
- Mostra os hinos pendentes, preserva a mensagem para completar depois e mantém a proteção contra reenvio de partituras já cadastradas.
- Continua exigindo o dia dos hinos selecionados e pelo menos um PDF para enviar.

## 0.3.8

- Remove o serviço de leitura de notificações e sua permissão sensível, que pode bloquear a instalação pelo Google Play Protect.
- Programação continua disponível por copiar/colar e Compartilhar → Shalom, com busca no Drive e envio após revisão.
- O APK não oferece mais recebimento automático de mensagens em segundo plano.

## 0.3.7

- Importação da programação pelo texto recebido, com grupos, intérpretes e escolha de sábado, domingo ou ambos.
- Avulsos no Drive corresponde a Grupo de louvor; Mocidade corresponde a Jovens.
- Busca direcionada por hino em subpastas do Drive, com metadados paginados pela Drive API e escolha de versões ambíguas.
- Versões escolhidas são lembradas neste aparelho; envio parcial pode continuar sem repetir os hinos concluídos.
- APK recebe texto por Compartilhar e oferece leitura opcional de notificações do WhatsApp para guardar rascunhos, sem publicação automática ou interrupção do leitor.
- Ponte Google Apps Script somente leitura, restrita à pasta configurada, protegida por segredo no servidor e por acesso dos responsáveis da banda.

## 0.3.6

- Troca lateral de folhas com acompanhamento do dedo, retorno de gestos curtos e respeito à redução de movimento.
- Página atual e vizinhas ficam preparadas; os mesmos canvases são reutilizados ao avançar e voltar.
- Renderização sequencial, cache limitado e remoção de cópias/repaint de páginas em notificações de tamanho repetidas.
- Traço da caneta atualizado por quadro e controles sem blur no Safari antigo para reduzir o trabalho do tablet.
- Marcadores por partitura: nome, salto de página, exclusão e armazenamento local junto às anotações.
- Testes do pacote SystemJS realmente usado pelo Safari antigo, além de Chrome e WebKit.

## 0.3.5

- Leitura compatível sem worker no Safari antigo, com alternativas para Streams, clonagem de buffers e visibilidade das páginas.
- Recuperação automática quando o worker do PDF falha, sem alterar o PDF ou as anotações.
- Limites de espera na abertura e renderização; erros visíveis com opção de tentar novamente.
- Detecção de toque considera a capacidade do aparelho para evitar conflito com Pointer Events.

## 0.3.4

- Compilação e alternativas de APIs para Safari/iOS 12, com worker PDF clássico.
- Desenho por toque no iPad, espessura de caneta e armazenamento de PDFs como bytes para evitar falhas do Safari.
- Deslizar páginas sem desmontar a folha, renderização em buffer e preparo das páginas próximas.
- Ordem fixa dos seis grupos no repertório e na sequência de leitura.
- Lista de contas para liberar responsáveis com um toque; liberação por e-mail sem exigir entrada prévia.
- Suporte a Page Up/Page Down para pedais que funcionam como teclado.

## 0.3.3

- Marca exibida no canto superior esquerdo, identificação da banda junto ao status e crédito Carlos Bispo no rodapé.

- Menu de compartilhamento para o convite da banda e o PDF original no leitor.
- Compartilhamento Android envia uma cópia privada do PDF sem tornar o Storage público.
- Importação de PDFs do Google Drive no APK pelo seletor de documentos Android, sem Google Cloud.
- Seleção de múltiplos PDFs com validação antes do envio e remoção das cópias temporárias.

## 0.3.2

- Festividade com partituras permanentes separadas pelos seis grupos da banda.
- Envio e exclusão restritos aos responsáveis, com confirmação para remover partituras da festividade.
- Festividades e anotações locais preservadas na troca de semana; PDFs já baixados disponíveis offline.
- Navegação do leitor restrita às músicas da festividade do mesmo grupo.

## 0.3.1

- No modo contínuo, o toque à direita abre o próximo hino do dia; à esquerda, o anterior. Rolagem e arrastes não trocam a música.
- Ferramenta Cifras para inserir textos em qualquer ponto de cada página, com tamanho de fonte personalizado e escolha de cor.
- Cifras podem ser arrastadas, editadas e excluídas; ficam salvas neste aparelho, junto com os rabiscos, inclusive para leitura offline.
- Preserva as anotações existentes e o PDF original.

## 0.3.0

- PDF usa toda a área de leitura, com controles flutuantes que podem ser ocultados.
- Android oculta as barras do sistema e mantém a tela acesa durante a leitura.
- Toques nas laterais e gestos horizontais trocam páginas no modo por página.
- A última página avança para o próximo hino do mesmo dia, salvando os rabiscos. Voltar da primeira página abre a última página do hino anterior.
- Leitura contínua, zoom, caneta e metrônomo visual preservados.
- Ícone de instalação preto com a mesma nota da marca no app.
- Web verifica atualizações a cada minuto e ao retomar. Android consulta os lançamentos publicados e oferece download do APK.
- Checagem externa do Supabase quatro vezes por dia via GitHub Actions.

## 0.2.1

- Envio do PDF por bytes corrige a falha do seletor de arquivos Android.
- Políticas de Storage corrigidas para validar o caminho do PDF.
