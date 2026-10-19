# iPad e leitura

Versão 0.3.10: envio pelo código da banda, botão Recarregar, recuperação de PDF e menor uso de memória, além dos gestos, marcadores e ajustes para Safari antigo.

Abra https://shalomsetlist.pages.dev/ no Safari. Aguarde a publicação concluir; quando houver aviso, atualize fora da partitura. Se o site antigo não abrir, feche a aba e abra o endereço novamente. Não apague os dados do site para atualizar: eles guardam PDFs e anotações locais.

## Caneta e páginas

- Ative **Caneta** e desenhe com o dedo. Escolha traço fino, médio ou grosso. Enquanto a caneta estiver ativa, o gesto de desenho não vira a folha.
- Desative Caneta/Cifras para navegar. No modo **Por página**, deslize à esquerda para avançar e à direita para voltar. Os toques nas bordas continuam funcionando.
- A folha atual fica visível até a próxima terminar de renderizar. O app prepara as páginas próximas para reduzir a espera.
- A folha acompanha o gesto horizontal e desliza para a próxima. Um arraste curto volta à página atual. As folhas já preparadas são reutilizadas, sem redesenhar o PDF a cada troca.
- Com zoom acima de 100%, arraste para explorar a folha ampliada; use os botões para trocar de página.
- Pedais que enviam **seta esquerda/direita** ou **Page Up/Page Down** funcionam como comandos de navegação. Não é necessário parear o pedal dentro do app; conecte-o nas configurações do tablet. A compatibilidade do pedal físico precisa ser conferida no aparelho.
- O leitor preserva os PDFs e anotações antigos. Novos PDFs são armazenados como bytes para evitar falhas de Blob no IndexedDB do Safari.

## Marcadores

Na barra flutuante, abra **Marcadores**, escreva um nome como “Refrão” ou “Retorno” e toque em **+**. O marcador guarda a página atual. Toque no nome para voltar àquela página; use a lixeira para excluir. O salto abre o modo Por página e desativa as ferramentas de desenho.

Os marcadores são pessoais e ficam neste aparelho, junto aos rabiscos e cifras; funcionam offline com o PDF já baixado. Não são enviados para os outros músicos. Não é necessária uma migração SQL.

## Recarregar quando a folha ficar em branco

Na versão 0.3.10, toque em **Recarregar** na barra superior da própria partitura. Com internet, baixa uma nova cópia ignorando o cache; offline, reinicia a leitura do PDF salvo. A página atual, os rabiscos, cifras e marcadores são preservados. Se a barra estiver escondida, use **Mostrar controles**.

Uma cópia local inválida recebe uma tentativa automática de recuperação pela rede. O leitor limita o tamanho das imagens e libera os canvases ao fechar ou recarregar para reduzir o uso de memória. Esses ajustes precisam ser conferidos nos dois iPads reais; testes WebKit não reproduzem todas as limitações do iOS 12.

## Enviar hinos

Basta entrar em **Nossa banda → Conectar à banda → Pelo código**. Qualquer membro pode enviar hinos, sem cadastrar e-mail ou virar responsável. A regra exige a migração `supabase/migrations/20261018_member_uploads.sql` no servidor e a nova versão publicada.

## Ordem dos grupos

O repertório e a sequência do leitor usam Crianças → Adolescentes → Jovens → Varões → Irmãs → Grupo de louvor. Dentro de cada grupo, permanece a sequência de envio. Festividade continua separada por grupo e sem limpeza semanal.

## Validação

Os testes usam Chrome e WebKit com toque. A configuração `ipad-legacy-apis` carrega o pacote SystemJS para navegadores antigos e remove Pointer Events, ResizeObserver, Blob.arrayBuffer, crypto.randomUUID e AbortSignal.timeout para exercitar as alternativas. Os testes conferem o acompanhamento do gesto, reutilização das telas já preparadas, persistência de marcadores e retorno offline. A compilação também verifica a sintaxe dos arquivos para navegadores antigos e usa worker PDF clássico.

WebKit no computador não é o Safari de um iPad com iOS 12. A validação final nessa versão exige abrir o site em um aparelho real; testes no computador não garantem todos os modelos, PDFs e limitações de memória.

Referências: [compilação para navegadores antigos no Vite](https://vite.dev/guide/build), [Pointer Events no Safari 13](https://webkit.org/blog/9674/new-webkit-features-in-safari-13/), [manual do piaScore](https://piascore.com/manual/) e [pedais no piaScore](https://help.piascore.com/hc/en-us/sections/360000119612-Page-turning).

## Se a partitura não abrir

A versão 0.3.5 usa uma forma de leitura sem worker no Safari antigo. Nos aparelhos mais novos, tenta essa forma automaticamente se o processamento em segundo plano falhar. A abertura e o preparo da página têm limites de espera; uma falha mostra o motivo e um botão para tentar novamente, em vez de manter o carregamento infinito.

As APIs de Streams e clonagem de dados também são supridas no ambiente que processa o PDF. Os testes agora removem IntersectionObserver, ReadableStream, structuredClone e Worker, além das APIs já verificadas. Ainda é necessário confirmar o comportamento no Safari do iPad antigo real.
