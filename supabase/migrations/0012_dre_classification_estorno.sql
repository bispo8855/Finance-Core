-- 0012_dre_classification_estorno.sql
-- Adiciona o valor 'estorno_devolucao' à coluna categories.dre_classification.
--
-- A coluna tem um CHECK inline criado em 0005 (nome auto-gerado
-- 'categories_dre_classification_check') restringindo aos 7 valores originais.
-- Trocamos o CHECK para incluir 'estorno_devolucao' (contra-receita: devoluções/estornos
-- de venda → linha Estornos/Chargebacks no Resultado Gerencial).

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_dre_classification_check;

ALTER TABLE categories ADD CONSTRAINT categories_dre_classification_check
  CHECK (dre_classification IN (
    'receita_bruta',
    'deducao_imposto',
    'custo_variavel',
    'despesa_fixa',
    'financeiro',
    'investimento',
    'outro',
    'estorno_devolucao'
  ));

-- NOTA (PostgREST): esta migration altera apenas um CHECK constraint (não muda colunas,
-- tabelas, relações nem funções expostas). O cache de schema do PostgREST/Supabase NÃO
-- precisa ser recarregado para isto. (Só seria necessário `NOTIFY pgrst, 'reload schema';`
-- em mudanças de colunas/relacionamentos/RPC.)
