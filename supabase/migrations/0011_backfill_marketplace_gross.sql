-- 0011_backfill_marketplace_gross.sql
--
-- Corrige documentos de marketplace afetados pela dupla dedução de taxa em liberações/repasses
-- ML/MP (bug da Opção A). Assinatura do bug: a taxa foi gravada mas o bruto ficou zerado/nulo,
-- fazendo o extrato tratar o LÍQUIDO como bruto e descontar a taxa novamente (adjustment twin).
--
-- Assinatura:  marketplace_fee > 0  AND  (gross_amount = 0 OR gross_amount IS NULL)
-- Correção:    marketplace_fee = 0,  gross_amount = total_amount  (o líquido é o valor real)
--
-- ⚠️ NÃO EXECUTAR EM PRODUÇÃO SEM VALIDAÇÃO. Rode primeiro o SELECT de conferência abaixo,
--    confira contagem/soma por tenant (user_id) e só então aplique o UPDATE.

-- ============================================================================
-- (1) CONFERÊNCIA — rodar ANTES (não altera nada). Contagem e soma por tenant.
-- ============================================================================
-- SELECT
--   user_id,
--   COUNT(*)                         AS docs_afetados,
--   SUM(marketplace_fee)             AS soma_taxa_fantasma,
--   SUM(total_amount)                AS soma_liquido
-- FROM documents
-- WHERE marketplace_fee > 0
--   AND (gross_amount = 0 OR gross_amount IS NULL)
-- GROUP BY user_id
-- ORDER BY docs_afetados DESC;
--
-- (opcional) amostra de linhas para inspeção manual:
-- SELECT id, user_id, description, total_amount, gross_amount, marketplace_fee, source_type, competence_date
-- FROM documents
-- WHERE marketplace_fee > 0 AND (gross_amount = 0 OR gross_amount IS NULL)
-- ORDER BY competence_date DESC
-- LIMIT 50;

-- ============================================================================
-- (2) CORREÇÃO — aplicar somente após validar o SELECT acima.
-- ============================================================================
UPDATE documents
SET gross_amount   = total_amount,
    marketplace_fee = 0
WHERE marketplace_fee > 0
  AND (gross_amount = 0 OR gross_amount IS NULL);

-- ============================================================================
-- (3) VERIFICAÇÃO PÓS-UPDATE — deve retornar 0 linhas.
-- ============================================================================
-- SELECT COUNT(*) AS restantes
-- FROM documents
-- WHERE marketplace_fee > 0 AND (gross_amount = 0 OR gross_amount IS NULL);
