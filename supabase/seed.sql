-- seed.sql
-- Inserções iniciais recomendadas (Opcional).

-- ATENÇÃO: Substitua '00000000-0000-0000-0000-000000000000' pelo ID real de um usuário criado 
-- no menu "Authentication" do seu Supabase. O RLS exige um user_id válido!
-- Exemplo: p_user_id UUID := '123e4567-e89b-12d3-a456-426614174000';

DO $$
DECLARE
  p_user_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN

  -- Apenas executa caso o UUID seja alterado (ignora a string literal de placeholder)
  IF p_user_id = '00000000-0000-0000-0000-000000000000' THEN
    RAISE EXCEPTION 'Nenhum user_id especificado. Edite o arquivo seed.sql com um UUID válido do Supabase Auth.';
  END IF;

  -- 1) CONTA PADRÃO
  INSERT INTO accounts (id, user_id, name, initial_balance)
  VALUES (gen_random_uuid(), p_user_id, 'Banco Principal', 0.00);

  -- 2) CATEGORIAS PADRÃO
  INSERT INTO categories (id, user_id, name, kind, dre_classification)
  VALUES 
    -- Receitas
    (gen_random_uuid(), p_user_id, 'Venda de Produtos', 'receita', 'receita_bruta'),
    (gen_random_uuid(), p_user_id, 'Prestação de Serviços', 'receita', 'receita_bruta'),
    (gen_random_uuid(), p_user_id, 'Receitas Avulsas', 'receita', 'receita_bruta'),
    (gen_random_uuid(), p_user_id, 'Salário', 'receita', 'receita_bruta'),
    
    -- Deduções (tipo despesa, mas vai pra dedução de imposto)
    (gen_random_uuid(), p_user_id, 'Impostos sobre Faturamento', 'despesa', 'deducao_imposto'),

    -- Custos (Diretos)
    (gen_random_uuid(), p_user_id, 'Compra de Mercadorias / Estoque', 'custo', 'custo_variavel'),
    (gen_random_uuid(), p_user_id, 'Matéria-Prima / Insumos', 'custo', 'custo_variavel'),
    (gen_random_uuid(), p_user_id, 'Comissões sobre Venda', 'custo', 'custo_variavel'),
    (gen_random_uuid(), p_user_id, 'Fretes de Venda', 'custo', 'custo_variavel'),

    -- Despesas (Operacionais / Fixas)
    (gen_random_uuid(), p_user_id, 'Pró-labore', 'despesa', 'despesa_fixa'),
    (gen_random_uuid(), p_user_id, 'Salários e Encargos', 'despesa', 'despesa_fixa'),
    (gen_random_uuid(), p_user_id, 'Aluguel e Condomínio', 'despesa', 'despesa_fixa'),
    (gen_random_uuid(), p_user_id, 'Água, Luz, Internet', 'despesa', 'despesa_fixa'),
    (gen_random_uuid(), p_user_id, 'Manutenção e Limpeza', 'despesa', 'despesa_fixa'),
    (gen_random_uuid(), p_user_id, 'Marketing e Publicidade', 'despesa', 'despesa_fixa'),
    (gen_random_uuid(), p_user_id, 'Software e Assinaturas (SaaS)', 'despesa', 'despesa_fixa'),
    (gen_random_uuid(), p_user_id, 'Honorários Contábeis/Jurídicos', 'despesa', 'despesa_fixa'),
    (gen_random_uuid(), p_user_id, 'Material de Escritório', 'despesa', 'despesa_fixa'),
    (gen_random_uuid(), p_user_id, 'Despesas de Viagem', 'despesa', 'despesa_fixa'),
    (gen_random_uuid(), p_user_id, 'Terceirizações', 'despesa', 'despesa_fixa'),

    -- Investimentos
    (gen_random_uuid(), p_user_id, 'Aplicações Financeiras', 'investimento', 'investimento'),
    (gen_random_uuid(), p_user_id, 'Compra de Equipamentos', 'investimento', 'investimento'),
    (gen_random_uuid(), p_user_id, 'Reformas e Infraestrutura', 'investimento', 'investimento'),

    -- Financeiro (Movimentações Neutras / Juros)
    (gen_random_uuid(), p_user_id, 'Pagamento de Empréstimos', 'financeiro', 'financeiro'),
    (gen_random_uuid(), p_user_id, 'Tarifas Bancárias', 'financeiro', 'financeiro'),
    (gen_random_uuid(), p_user_id, 'Saques e Transferências', 'financeiro', 'financeiro'),
    (gen_random_uuid(), p_user_id, 'Aportes de Capital', 'financeiro', 'financeiro'),
    (gen_random_uuid(), p_user_id, 'Juros / Multas Financeiras', 'financeiro', 'financeiro');

END $$;
