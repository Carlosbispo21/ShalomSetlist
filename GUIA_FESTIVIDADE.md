# Festividade

Abra **Festividade**, escolha o grupo e use **Enviar partituras**. O grupo selecionado já aparece no formulário; você pode alterá-lo antes do envio. Não é necessário escolher sábado ou domingo.

As partituras ficam disponíveis até um responsável removê-las, mesmo depois da troca de semana. Os músicos da banda recebem os PDFs pela sincronização. Os arquivos já abertos ficam disponíveis offline neste aparelho, junto com seus rabiscos e cifras.

Na leitura, a troca de música percorre somente as partituras da festividade do grupo selecionado. O repertório semanal continua separado e é limpo na segunda-feira.

Para excluir, use a lixeira e confirme **Remover partitura**. Na banda conectada, a exclusão remove o PDF para todos; anotações são locais e acompanham a remoção na próxima sincronização. Um aparelho offline recebe a alteração ao voltar à internet.

## Banco de dados

Em projetos existentes, execute uma vez `supabase/migrations/20261010_festivities.sql` no SQL Editor. Você já executou essa migração neste projeto. Novas instalações podem usar o `schema.sql` atualizado.

Festividades usam `scope = 'festivity'`, semana nula e pasta permanente `festivity`. Isso preserva seus arquivos também com a função de limpeza anterior. Ao publicar novamente `weekly-cleanup`, use o código atualizado deste repositório, que limita explicitamente a limpeza ao repertório semanal.
