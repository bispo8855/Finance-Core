-- 0015_personal_workspace_rpc.sql
-- Aurys Personal — RPC de criação idempotente do workspace pessoal (fix AP4B.2a).
--
-- PROBLEMA (bug real): a criação inicial do workspace personal pelo CLIENT retorna 403,
-- por chicken-and-egg de RLS:
--   - workspaces SELECT só enxerga workspace de quem JÁ é membro;
--   - workspace_members INSERT exige que o usuário JÁ seja owner/admin do workspace.
-- O Business não sofre isso porque o workspace inicial nasce via trigger
-- handle_new_user() (SECURITY DEFINER) no signup.
--
-- SOLUÇÃO: função SECURITY DEFINER que roda com privilégios do dono (contorna a RLS
-- apenas para este fluxo controlado), usa auth.uid() internamente, trata a corrida via
-- o índice único parcial da 0014 (uq_workspaces_owner_personal) e garante a membership.
--
-- NÃO altera nenhuma policy de workspaces/workspace_members.
-- NÃO altera nenhuma tabela. NÃO cria personal_transactions.

CREATE OR REPLACE FUNCTION public.get_or_create_personal_workspace()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ws_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Já existe o workspace pessoal deste usuário?
  SELECT id INTO v_ws_id
  FROM public.workspaces
  WHERE owner_id = v_uid AND workspace_type = 'personal'
  LIMIT 1;

  -- Não existe → cria. A trava uq_workspaces_owner_personal (0014) garante no máximo
  -- um workspace personal por owner; numa corrida, quem perde cai no unique_violation
  -- e refaz o SELECT (idempotência garantida pelo banco, não pela ordem do cliente).
  IF v_ws_id IS NULL THEN
    BEGIN
      INSERT INTO public.workspaces (owner_id, name, workspace_type)
      VALUES (v_uid, 'Pessoal', 'personal')
      RETURNING id INTO v_ws_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO v_ws_id
      FROM public.workspaces
      WHERE owner_id = v_uid AND workspace_type = 'personal'
      LIMIT 1;
    END;
  END IF;

  -- Garante a membership de owner (idempotente — workspace_members tem UNIQUE(workspace_id,user_id)).
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_ws_id, v_uid, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  RETURN v_ws_id;
END;
$$;

-- Segurança de SECURITY DEFINER: o Postgres concede EXECUTE a PUBLIC por padrão.
-- Numa função definer isso exporia a criação a qualquer papel (inclusive anon). Revoga
-- PUBLIC e anon ANTES de conceder, e só então libera para authenticated (a função usa
-- auth.uid() e falha se null).
REVOKE ALL ON FUNCTION public.get_or_create_personal_workspace() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_or_create_personal_workspace() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_personal_workspace() TO authenticated;

-- Recarrega o schema cache do PostgREST para expor a RPC via supabase.rpc(...).
NOTIFY pgrst, 'reload schema';
