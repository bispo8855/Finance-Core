-- 0014_personal_workspace_unique.sql
-- Aurys Personal — trava de unicidade do workspace pessoal (pré-requisito da AP4B.2a).
--
-- MOTIVO: a tabela public.workspaces (0010) NÃO possui UNIQUE (owner_id, workspace_type).
-- Sem essa trava, getOrCreatePersonalWorkspace (SELECT -> INSERT) seria idempotente
-- apenas "na prática": duas execuções concorrentes (React StrictMode em dev, dois hooks
-- montando em paralelo, double-click) criariam DOIS workspaces personal para o mesmo
-- usuário, partindo os dados em dois silos — sem que a RLS acuse nada, pois ambos são
-- válidos. Corrupção silenciosa.
--
-- SOLUÇÃO: índice único PARCIAL. Garante no BANCO no máximo um workspace
-- workspace_type='personal' por owner_id. Com ele, o service trata o erro 23505
-- (unique_violation) refazendo o SELECT — quem perde a corrida usa o workspace
-- que o outro criou. Idempotência garantida pelo banco, não pela ordem do cliente.
--
-- SEGURANÇA:
--   - NÃO altera nenhuma tabela (é só um índice);
--   - é CONDICIONAL (WHERE workspace_type = 'personal'), portanto NÃO afeta
--     workspaces 'business' — o usuário pode ter quantos business quiser;
--   - nenhum ALTER em tabela do Business.
--
-- PRÉ-REQUISITO (rodar ANTES; deve retornar 0 linhas):
--   SELECT owner_id, count(*) FROM public.workspaces
--   WHERE workspace_type = 'personal' GROUP BY owner_id HAVING count(*) > 1;
--   Se retornar linhas, PARAR e resolver os duplicados antes de aplicar.

CREATE UNIQUE INDEX IF NOT EXISTS uq_workspaces_owner_personal
  ON public.workspaces (owner_id)
  WHERE workspace_type = 'personal';

-- VALIDAÇÃO (rodar DEPOIS; deve retornar 1 linha com o indexdef abaixo):
--   SELECT indexname, indexdef FROM pg_indexes
--   WHERE tablename = 'workspaces' AND indexname = 'uq_workspaces_owner_personal';
--   Esperado:
--     CREATE UNIQUE INDEX uq_workspaces_owner_personal ON public.workspaces
--     USING btree (owner_id) WHERE (workspace_type = 'personal'::text)

NOTIFY pgrst, 'reload schema';
