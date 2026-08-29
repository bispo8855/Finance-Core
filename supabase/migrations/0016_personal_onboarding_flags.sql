-- 0016_personal_onboarding_flags.sql
-- Aurys Personal — flags EXPLÍCITOS do fluxo de onboarding (pré-requisito AP4B.3a).
--
-- MOTIVO: 0 linhas em personal_cards / personal_fixed_commitments é AMBÍGUO — pode
-- significar "não uso/não tenho" OU "ainda não respondi essa etapa". Tratar 0 linhas
-- como "não usa" seria gambiarra silenciosa (esconde incerteza). Estes flags registram
-- a resposta EXPLÍCITA do usuário, permitindo que podeGerarLeituraConfiavel distinga
-- "declarou que não usa" de "pulou a etapa".
--
-- LUGAR: personal_settings — é metadado do FLUXO de onboarding, não dado financeiro.
-- O motor AP2 já opera com arrays vazios (cards:[], fixedCommitments:[]) e NÃO usa
-- estes flags; eles servem só à camada de onboarding.
--
-- default false = etapa ainda não respondida; true = usuário declarou não usar/não ter.
--
-- Aditivo puro em personal_settings. NÃO altera Business, RLS/policies, motor, adapter,
-- outras tabelas nem UI.

ALTER TABLE public.personal_settings
  ADD COLUMN IF NOT EXISTS declared_no_cards BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS declared_no_fixed_commitments BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
