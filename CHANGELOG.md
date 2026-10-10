# Alterações

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
