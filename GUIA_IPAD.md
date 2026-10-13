# iPad e leitura

Versão 0.3.5: compilação para Safari/iOS 12, desenho por toque com o dedo, páginas preparadas em segundo plano e ajustes no cache dos PDFs.

Abra https://shalomsetlist.pages.dev/ no Safari. Aguarde a publicação concluir; quando houver aviso, atualize fora da partitura. Se o site antigo não abrir, feche a aba e abra o endereço novamente. Não apague os dados do site para atualizar: eles guardam PDFs e anotações locais.

## Caneta e páginas

- Ative **Caneta** e desenhe com o dedo. Escolha traço fino, médio ou grosso. Enquanto a caneta estiver ativa, o gesto de desenho não vira a folha.
- Desative Caneta/Cifras para navegar. No modo **Por página**, deslize à esquerda para avançar e à direita para voltar. Os toques nas bordas continuam funcionando.
- A folha atual fica visível até a próxima terminar de renderizar. O app prepara as páginas próximas para reduzir a espera.
- Com zoom acima de 100%, arraste para explorar a folha ampliada; use os botões para trocar de página.
- Pedais que enviam **seta esquerda/direita** ou **Page Up/Page Down** funcionam como comandos de navegação. Não é necessário parear o pedal dentro do app; conecte-o nas configurações do tablet. A compatibilidade do pedal físico precisa ser conferida no aparelho.
- O leitor preserva os PDFs e anotações antigos. Novos PDFs são armazenados como bytes para evitar falhas de Blob no IndexedDB do Safari.

## Responsáveis

Em **Nossa banda**, use **Tornar responsável** ao lado do e-mail. Também pode preencher o e-mail de uma conta criada que ainda não entrou na banda; a liberação já a associa à banda. A pessoa precisa confirmar o e-mail se o Supabase exigir confirmação e entrar com sua própria conta. Quem entrou apenas pelo código usa uma conta temporária e precisa criar uma conta com e-mail para enviar partituras.

A migração `supabase/migrations/20261013_director_access.sql` já foi executada neste projeto. Contas que pertencem a outra banda precisam primeiro entrar nesta banda pelo código; a liberação não transfere contas silenciosamente.

## Ordem dos grupos

O repertório e a sequência do leitor usam Crianças → Adolescentes → Jovens → Varões → Irmãs → Grupo de louvor. Dentro de cada grupo, permanece a sequência de envio. Festividade continua separada por grupo e sem limpeza semanal.

## Validação

Os testes usam Chrome e WebKit com toque. A configuração `ipad-legacy-apis` remove Pointer Events, ResizeObserver, Blob.arrayBuffer, crypto.randomUUID e AbortSignal.timeout para exercitar as alternativas. A compilação também verifica a sintaxe dos arquivos para navegadores antigos e usa worker PDF clássico.

WebKit no computador não é o Safari de um iPad com iOS 12. A validação final nessa versão exige abrir o site em um aparelho real; testes no computador não garantem todos os modelos, PDFs e limitações de memória.

Referências: [compilação para navegadores antigos no Vite](https://vite.dev/guide/build), [Pointer Events no Safari 13](https://webkit.org/blog/9674/new-webkit-features-in-safari-13/), [manual do piaScore](https://piascore.com/manual/) e [pedais no piaScore](https://help.piascore.com/hc/en-us/sections/360000119612-Page-turning).

## Se a partitura não abrir

A versão 0.3.5 usa uma forma de leitura sem worker no Safari antigo. Nos aparelhos mais novos, tenta essa forma automaticamente se o processamento em segundo plano falhar. A abertura e o preparo da página têm limites de espera; uma falha mostra o motivo e um botão para tentar novamente, em vez de manter o carregamento infinito.

As APIs de Streams e clonagem de dados também são supridas no ambiente que processa o PDF. Os testes agora removem IntersectionObserver, ReadableStream, structuredClone e Worker, além das APIs já verificadas. Ainda é necessário confirmar o comportamento no Safari do iPad antigo real.
