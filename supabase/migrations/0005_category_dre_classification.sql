-- 0005_category_dre_classification.sql
-- Adiciona a coluna dre_classification à tabela categories com backfill

ALTER TABLE categories ADD COLUMN IF NOT EXISTS dre_classification TEXT CHECK (dre_classification IN ('receita_bruta', 'deducao_imposto', 'custo_variavel', 'despesa_fixa', 'financeiro', 'investimento', 'outro'));

-- Backfill para registros existentes baseados na coluna kind
-- Impostos antigos continuarão como 'despesa_fixa' até que o usuário ajuste manualmente
UPDATE categories 
SET dre_classification = CASE
  WHEN kind = 'receita' THEN 'receita_bruta'
  WHEN kind = 'custo' THEN 'custo_variavel'
  WHEN kind = 'despesa' THEN 'despesa_fixa'
  WHEN kind = 'financeiro' THEN 'financeiro'
  WHEN kind = 'investimento' THEN 'investimento'
  ELSE 'outro'
END
WHERE dre_classification IS NULL;
