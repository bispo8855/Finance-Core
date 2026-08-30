-- 0017_personal_import_staging.sql
-- Aurys Personal — STAGING da entrada assistida por extrato (AP4C.1a).
--
-- Persiste o resultado do ImportSummary (parser+inferência AP4C.0/0.1) para o
-- usuário revisar/validar ANTES de aplicar em personal_*. Nada é aplicado aqui.
--
-- 3 tabelas: personal_import_batches (1 por importação), personal_import_items
-- (1 por movimento classificado) e personal_category_rules (regras de categoria).
-- summary_json e import_items COEXISTEM: o JSON guarda o resumo agregado; os items
-- são a lista por linha para o review. O inferido (inferred_*) é imutável; a decisão
-- do usuário vive em campos separados (user_decision/user_kind/user_category).
--
-- V1 (4C.1a): source_kind = apenas 'extrato'; fatura fica para AP4C.2. 1 conta por
-- importação. NÃO guarda o arquivo bruto (só file_name + file_hash).
--
-- RETENÇÃO (documentada + coluna retention_until):
--   parsed/review/discarded não aplicados → expurgar após ~30 dias;
--   applied → manter inicialmente ~12 meses.
--   retention_until é preenchido pela aplicação/rotina; a limpeza é externa a esta migration.
--
-- RLS no padrão personal: EXISTS em workspace_members JOIN workspaces com
-- workspace_type='personal' em USING e WITH CHECK. Reusa update_timestamp() (0001).
-- Não cria personal_transactions. Não altera tabelas do Business.

-- ============================================================================
-- 1. TABELAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.personal_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL DEFAULT 'extrato' CHECK (source_kind IN ('extrato')),
  file_name TEXT,
  file_hash TEXT,
  period_start DATE,
  period_end DATE,
  months_complete TEXT[] NOT NULL DEFAULT '{}',
  months_partial TEXT[] NOT NULL DEFAULT '{}',
  titular_raw TEXT,
  account_scope TEXT NULL CHECK (account_scope IN ('pessoal', 'misto', 'negocio')),
  detected_balance NUMERIC(14,2),
  balance_source TEXT NULL CHECK (balance_source IN ('movimento', 'rodape')),
  status TEXT NOT NULL DEFAULT 'parsed' CHECK (status IN ('parsed', 'review', 'applied', 'discarded')),
  summary_json JSONB,
  applied_at TIMESTAMPTZ NULL,
  retention_until DATE NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Alvo da FK composta dos items: amarra batch ao seu workspace.
  UNIQUE (id, workspace_id)
);

CREATE TABLE IF NOT EXISTS public.personal_import_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_row INT,
  raw_date DATE,
  raw_description TEXT,
  raw_amount NUMERIC(14,2),
  direction TEXT NOT NULL CHECK (direction IN ('entrada', 'saida')),
  inferred_kind TEXT NOT NULL CHECK (inferred_kind IN ('renda', 'fixa', 'variavel', 'transferencia_propria', 'pagamento_fatura', 'ignorado', 'duvidoso')),
  inferred_category TEXT,
  confidence TEXT NOT NULL DEFAULT 'media' CHECK (confidence IN ('alta', 'media', 'baixa')),
  reason TEXT,
  user_decision TEXT NULL CHECK (user_decision IN ('confirmado', 'corrigido', 'ignorado')),
  user_kind TEXT NULL,
  user_category TEXT NULL,
  applied_to_table TEXT NULL,
  applied_to_id UUID NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Integridade: o item só pode apontar para um batch do MESMO workspace.
  -- Impede item de um workspace referenciar batch de outro (a FK exige o par).
  FOREIGN KEY (batch_id, workspace_id)
    REFERENCES public.personal_import_batches (id, workspace_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.personal_category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL DEFAULT 'contains' CHECK (match_type IN ('contains', 'exact')),
  pattern TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'seed')),
  hits INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (workspace_id, match_type, pattern)
);

-- ============================================================================
-- 2. ÍNDICES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_personal_import_batches_workspace_id ON public.personal_import_batches(workspace_id);
CREATE INDEX IF NOT EXISTS idx_personal_import_batches_status       ON public.personal_import_batches(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_personal_import_items_batch_id       ON public.personal_import_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_personal_import_items_workspace_id   ON public.personal_import_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_personal_category_rules_workspace_id ON public.personal_category_rules(workspace_id);

-- ============================================================================
-- 3. TRIGGERS updated_at (reusa update_timestamp() existente)
-- ============================================================================
DROP TRIGGER IF EXISTS update_personal_import_batches_updated_at ON public.personal_import_batches;
CREATE TRIGGER update_personal_import_batches_updated_at BEFORE UPDATE ON public.personal_import_batches FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS update_personal_import_items_updated_at ON public.personal_import_items;
CREATE TRIGGER update_personal_import_items_updated_at BEFORE UPDATE ON public.personal_import_items FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS update_personal_category_rules_updated_at ON public.personal_category_rules;
CREATE TRIGGER update_personal_category_rules_updated_at BEFORE UPDATE ON public.personal_category_rules FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ============================================================================
-- 4. ROW LEVEL SECURITY — habilitada nas 3 tabelas
-- ============================================================================
ALTER TABLE public.personal_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_import_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_category_rules ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. POLICIES — membro do workspace E workspace_type='personal' (USING + WITH CHECK)
-- ============================================================================
DROP POLICY IF EXISTS "personal_import_batches_rw" ON public.personal_import_batches;
CREATE POLICY "personal_import_batches_rw" ON public.personal_import_batches FOR ALL
USING (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_import_batches.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_import_batches.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'));

DROP POLICY IF EXISTS "personal_import_items_rw" ON public.personal_import_items;
CREATE POLICY "personal_import_items_rw" ON public.personal_import_items FOR ALL
USING (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_import_items.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_import_items.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'));

DROP POLICY IF EXISTS "personal_category_rules_rw" ON public.personal_category_rules;
CREATE POLICY "personal_category_rules_rw" ON public.personal_category_rules FOR ALL
USING (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_category_rules.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_category_rules.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'));

-- ============================================================================
-- 6. Recarrega o schema cache do PostgREST
-- ============================================================================
NOTIFY pgrst, 'reload schema';
