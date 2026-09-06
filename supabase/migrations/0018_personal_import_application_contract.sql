-- 0018_personal_import_application_contract.sql
-- Aurys Personal — AP4C.1c-0.1 (contrato de aplicação, sem aplicar nada).
--
-- Objetivo: congelar NO STAGING a identidade dos grupos inferidos (group_key)
-- e permitir rastrear qual conta recebeu o saldo quando a aplicação existir
-- (applied_account_id), COM integridade de workspace. Esta migration NÃO aplica
-- dados, NÃO cria applyBatch, NÃO cria UI e NÃO altera personal_* de entrada.
-- Apenas amplia o staging. Aditiva e idempotente (guardas DO/IF NOT EXISTS).

-- ============================================================================
-- 1. personal_import_items.group_key
--    Identidade CONGELADA do grupo que formou uma renda/fixa (produzida na
--    inferência; nunca rederivada no apply-time). NULL quando o movimento não
--    forma um grupo aplicável (variável, transferência, dúvida, ignorado…).
-- ============================================================================
ALTER TABLE public.personal_import_items
  ADD COLUMN IF NOT EXISTS group_key TEXT NULL;

-- Consulta por lote + grupo (montar o plano de aplicação por grupo).
CREATE INDEX IF NOT EXISTS idx_personal_import_items_batch_group
  ON public.personal_import_items (batch_id, group_key);

-- ============================================================================
-- 2. Alvo da FK composta: UNIQUE (id, workspace_id) em personal_accounts.
--    Necessário para amarrar a conta destino ao MESMO workspace do batch.
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.personal_accounts'::regclass
      AND contype = 'u'
      AND conname = 'personal_accounts_id_workspace_id_key'
  ) THEN
    ALTER TABLE public.personal_accounts
      ADD CONSTRAINT personal_accounts_id_workspace_id_key UNIQUE (id, workspace_id);
  END IF;
END $$;

-- ============================================================================
-- 3. personal_import_batches.applied_account_id + FK COMPOSTA workspace-safe.
--    Garante no banco que applied_account_id pertence ao MESMO workspace do
--    batch. Enquanto applied_account_id é NULL (não aplicado) a FK não é
--    checada (MATCH SIMPLE). Ao excluir a conta, apenas applied_account_id vira
--    NULL — workspace_id (NOT NULL) é preservado via SET NULL por coluna (PG15+).
-- ============================================================================
ALTER TABLE public.personal_import_batches
  ADD COLUMN IF NOT EXISTS applied_account_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.personal_import_batches'::regclass
      AND contype = 'f'
      AND conname = 'personal_import_batches_applied_account_fkey'
  ) THEN
    ALTER TABLE public.personal_import_batches
      ADD CONSTRAINT personal_import_batches_applied_account_fkey
      FOREIGN KEY (applied_account_id, workspace_id)
      REFERENCES public.personal_accounts (id, workspace_id)
      ON DELETE SET NULL (applied_account_id);
  END IF;
END $$;

-- ============================================================================
-- 4. Recarrega o schema cache do PostgREST
-- ============================================================================
NOTIFY pgrst, 'reload schema';
