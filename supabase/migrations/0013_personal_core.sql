-- 0013_personal_core.sql
-- Aurys Personal — persistência mínima (AP4B.1).
-- 10 tabelas particionadas por workspace_id (workspace_type='personal').
-- Padrão do projeto: gen_random_uuid(), TIMESTAMPTZ DEFAULT now(), NUMERIC(14,2),
-- CHECK para enums (espelham os tipos do AP2), trigger update_timestamp() (JÁ EXISTE
-- desde 0001/0010 — reusada, não recriada), RLS em TODAS as tabelas.
--
-- Isolamento por WORKSPACE (não por user_id como o Business): habilita Personal
-- compartilhado (casal) e usa workspace_type='personal' que já existe (0010).
-- A RLS valida EXISTS + join garantindo que o workspace é do tipo 'personal' —
-- dado pessoal nunca vive num workspace de negócio.
--
-- ⚠️ Apenas VERSIONADA no repo. NÃO aplicar em produção nesta etapa.
-- Nenhum ALTER em tabela do Business. Sem personal_transactions/personal_categories.

-- ============================================================================
-- 1. TABELAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.personal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  onboarding_completed_at TIMESTAMPTZ NULL,
  anchor_month TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.personal_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  balance_date DATE,
  is_reserve BOOLEAN DEFAULT false,
  confidence TEXT NOT NULL DEFAULT 'media' CHECK (confidence IN ('alta','media','baixa')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.personal_income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  day_of_month INT CHECK (day_of_month BETWEEN 1 AND 31),
  frequency TEXT NOT NULL DEFAULT 'mensal' CHECK (frequency IN ('mensal','avulsa')),
  nature TEXT NOT NULL DEFAULT 'rotina' CHECK (nature IN ('rotina','extraordinario','patrimonial')),
  variable BOOLEAN DEFAULT false,
  specific_date DATE NULL,
  confidence TEXT NOT NULL DEFAULT 'media' CHECK (confidence IN ('alta','media','baixa')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.personal_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  closing_day INT NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day INT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  credit_limit NUMERIC(14,2) NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.personal_card_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.personal_cards(id) ON DELETE CASCADE,
  cycle_start DATE,
  cycle_end DATE,
  due_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'estimada' CHECK (status IN ('fechada','aberta','estimada')),
  confidence TEXT NOT NULL DEFAULT 'media' CHECK (confidence IN ('alta','media','baixa')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.personal_fixed_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  day_of_month INT CHECK (day_of_month BETWEEN 1 AND 31),
  pay_method TEXT NOT NULL DEFAULT 'boleto' CHECK (pay_method IN ('debito','boleto','pix','cartao')),
  card_id UUID NULL REFERENCES public.personal_cards(id) ON DELETE SET NULL,
  essential BOOLEAN DEFAULT false,
  active_until DATE NULL,
  confidence TEXT NOT NULL DEFAULT 'media' CHECK (confidence IN ('alta','media','baixa')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.personal_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  group_label TEXT NOT NULL,
  monthly_amount NUMERIC(14,2) NOT NULL,
  start_month TEXT NOT NULL,
  end_month TEXT NOT NULL,
  card_id UUID NULL REFERENCES public.personal_cards(id) ON DELETE SET NULL,
  pay_method TEXT NOT NULL DEFAULT 'cartao' CHECK (pay_method IN ('debito','boleto','pix','cartao')),
  reimbursable BOOLEAN DEFAULT false,
  confidence TEXT NOT NULL DEFAULT 'media' CHECK (confidence IN ('alta','media','baixa')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.personal_reimbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  who TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  expected_date DATE NOT NULL,
  linked_to TEXT NULL,
  status TEXT NOT NULL DEFAULT 'previsto' CHECK (status IN ('previsto','recebido','atrasado')),
  confidence TEXT NOT NULL DEFAULT 'media' CHECK (confidence IN ('alta','media','baixa')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.personal_extraordinary_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  event_date DATE NOT NULL,
  klass TEXT NOT NULL CHECK (klass IN ('extraordinario','patrimonial')),
  destination TEXT NOT NULL DEFAULT 'livre' CHECK (destination IN ('reserva','intocavel','giro','quitacao','livre')),
  confidence TEXT NOT NULL DEFAULT 'media' CHECK (confidence IN ('alta','media','baixa')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.personal_daily_spending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  month_iso TEXT NOT NULL,
  min_amount NUMERIC(14,2) NOT NULL,
  normal_amount NUMERIC(14,2) NOT NULL,
  heavy_amount NUMERIC(14,2) NOT NULL,
  profile TEXT NOT NULL DEFAULT 'desconhecido' CHECK (profile IN ('maioria_cartao','meio_a_meio','maioria_pix','desconhecido')),
  confidence TEXT NOT NULL DEFAULT 'media' CHECK (confidence IN ('alta','media','baixa')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (workspace_id, month_iso)
);

-- ============================================================================
-- 2. ÍNDICES (workspace_id em todas)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_personal_settings_workspace_id            ON public.personal_settings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_personal_accounts_workspace_id            ON public.personal_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_personal_income_sources_workspace_id      ON public.personal_income_sources(workspace_id);
CREATE INDEX IF NOT EXISTS idx_personal_cards_workspace_id               ON public.personal_cards(workspace_id);
CREATE INDEX IF NOT EXISTS idx_personal_card_bills_workspace_id          ON public.personal_card_bills(workspace_id);
CREATE INDEX IF NOT EXISTS idx_personal_fixed_commitments_workspace_id   ON public.personal_fixed_commitments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_personal_installments_workspace_id        ON public.personal_installments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_personal_reimbursements_workspace_id      ON public.personal_reimbursements(workspace_id);
CREATE INDEX IF NOT EXISTS idx_personal_extraordinary_events_workspace_id ON public.personal_extraordinary_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_personal_daily_spending_workspace_id      ON public.personal_daily_spending(workspace_id);

-- ============================================================================
-- 3. TRIGGERS updated_at (reusa update_timestamp() — já existe desde 0001/0010)
-- ============================================================================
DROP TRIGGER IF EXISTS update_personal_settings_updated_at ON public.personal_settings;
CREATE TRIGGER update_personal_settings_updated_at BEFORE UPDATE ON public.personal_settings FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS update_personal_accounts_updated_at ON public.personal_accounts;
CREATE TRIGGER update_personal_accounts_updated_at BEFORE UPDATE ON public.personal_accounts FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS update_personal_income_sources_updated_at ON public.personal_income_sources;
CREATE TRIGGER update_personal_income_sources_updated_at BEFORE UPDATE ON public.personal_income_sources FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS update_personal_cards_updated_at ON public.personal_cards;
CREATE TRIGGER update_personal_cards_updated_at BEFORE UPDATE ON public.personal_cards FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS update_personal_card_bills_updated_at ON public.personal_card_bills;
CREATE TRIGGER update_personal_card_bills_updated_at BEFORE UPDATE ON public.personal_card_bills FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS update_personal_fixed_commitments_updated_at ON public.personal_fixed_commitments;
CREATE TRIGGER update_personal_fixed_commitments_updated_at BEFORE UPDATE ON public.personal_fixed_commitments FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS update_personal_installments_updated_at ON public.personal_installments;
CREATE TRIGGER update_personal_installments_updated_at BEFORE UPDATE ON public.personal_installments FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS update_personal_reimbursements_updated_at ON public.personal_reimbursements;
CREATE TRIGGER update_personal_reimbursements_updated_at BEFORE UPDATE ON public.personal_reimbursements FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS update_personal_extraordinary_events_updated_at ON public.personal_extraordinary_events;
CREATE TRIGGER update_personal_extraordinary_events_updated_at BEFORE UPDATE ON public.personal_extraordinary_events FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS update_personal_daily_spending_updated_at ON public.personal_daily_spending;
CREATE TRIGGER update_personal_daily_spending_updated_at BEFORE UPDATE ON public.personal_daily_spending FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ============================================================================
-- 4. ROW LEVEL SECURITY — habilitada em TODAS as 10 tabelas
-- ============================================================================
ALTER TABLE public.personal_settings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_accounts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_income_sources      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_cards               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_card_bills          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_fixed_commitments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_installments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_reimbursements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_extraordinary_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_daily_spending      ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. POLICIES — padrão único: membro do workspace E workspace_type='personal'.
--    Não basta pertencer ao workspace; ele PRECISA ser do tipo personal.
-- ============================================================================

DROP POLICY IF EXISTS "personal_settings_rw" ON public.personal_settings;
CREATE POLICY "personal_settings_rw" ON public.personal_settings FOR ALL
USING (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_settings.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_settings.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'));

DROP POLICY IF EXISTS "personal_accounts_rw" ON public.personal_accounts;
CREATE POLICY "personal_accounts_rw" ON public.personal_accounts FOR ALL
USING (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_accounts.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_accounts.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'));

DROP POLICY IF EXISTS "personal_income_sources_rw" ON public.personal_income_sources;
CREATE POLICY "personal_income_sources_rw" ON public.personal_income_sources FOR ALL
USING (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_income_sources.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_income_sources.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'));

DROP POLICY IF EXISTS "personal_cards_rw" ON public.personal_cards;
CREATE POLICY "personal_cards_rw" ON public.personal_cards FOR ALL
USING (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_cards.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_cards.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'));

DROP POLICY IF EXISTS "personal_card_bills_rw" ON public.personal_card_bills;
CREATE POLICY "personal_card_bills_rw" ON public.personal_card_bills FOR ALL
USING (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_card_bills.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_card_bills.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'));

DROP POLICY IF EXISTS "personal_fixed_commitments_rw" ON public.personal_fixed_commitments;
CREATE POLICY "personal_fixed_commitments_rw" ON public.personal_fixed_commitments FOR ALL
USING (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_fixed_commitments.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_fixed_commitments.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'));

DROP POLICY IF EXISTS "personal_installments_rw" ON public.personal_installments;
CREATE POLICY "personal_installments_rw" ON public.personal_installments FOR ALL
USING (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_installments.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_installments.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'));

DROP POLICY IF EXISTS "personal_reimbursements_rw" ON public.personal_reimbursements;
CREATE POLICY "personal_reimbursements_rw" ON public.personal_reimbursements FOR ALL
USING (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_reimbursements.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_reimbursements.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'));

DROP POLICY IF EXISTS "personal_extraordinary_events_rw" ON public.personal_extraordinary_events;
CREATE POLICY "personal_extraordinary_events_rw" ON public.personal_extraordinary_events FOR ALL
USING (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_extraordinary_events.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_extraordinary_events.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'));

DROP POLICY IF EXISTS "personal_daily_spending_rw" ON public.personal_daily_spending;
CREATE POLICY "personal_daily_spending_rw" ON public.personal_daily_spending FOR ALL
USING (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_daily_spending.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = personal_daily_spending.workspace_id AND wm.user_id = auth.uid() AND w.workspace_type = 'personal'));

-- ============================================================================
-- 6. Recarrega o schema cache do PostgREST
-- ============================================================================
NOTIFY pgrst, 'reload schema';
