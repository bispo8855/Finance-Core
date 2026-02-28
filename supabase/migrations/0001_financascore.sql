-- 0001_financascore.sql
-- Migration para criar a estrutura inicial do FinancasCore no Supabase.

-- 1. Create updated_at function
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create tables
CREATE TABLE accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL,
  initial_balance NUMERIC(14,2) DEFAULT 0
);

CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('receita', 'custo', 'despesa', 'investimento', 'financeiro'))
);

CREATE TABLE contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('cliente', 'fornecedor', 'ambos'))
);

CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  type TEXT NOT NULL CHECK (type IN ('venda', 'compra', 'despesa', 'receita_avulsa')),
  contact_id UUID NULL REFERENCES contacts(id),
  category_id UUID NOT NULL REFERENCES categories(id),
  competence_date DATE NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL,
  description TEXT NULL
);

CREATE TABLE titles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('receber', 'pagar')),
  installment_num INT NOT NULL,
  installment_total INT NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('previsto', 'atrasado', 'pago', 'recebido', 'renegociado', 'cancelado'))
);

CREATE TABLE movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  title_id UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id),
  payment_date DATE NOT NULL,
  paid_amount NUMERIC(14,2) NOT NULL,
  fee_amount NUMERIC(14,2) DEFAULT 0,
  notes TEXT NULL
);

-- 3. Setup triggers for updated_at
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_titles_updated_at BEFORE UPDATE ON titles FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_movements_updated_at BEFORE UPDATE ON movements FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- 4. Enable RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Criamos políticas FOR ALL consolidadas (junta SELECT, INSERT, UPDATE, DELETE) atreladas ao user_id = auth.uid()
CREATE POLICY "Users can manage their own accounts" ON accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own categories" ON categories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own contacts" ON contacts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own documents" ON documents
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own titles" ON titles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own movements" ON movements
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Indexes
-- Índice base por tenant (user_id)
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_titles_user_id ON titles(user_id);
CREATE INDEX idx_movements_user_id ON movements(user_id);

-- Índices adicionais para buscas e foreign keys
CREATE INDEX idx_documents_contact_id ON documents(contact_id);
CREATE INDEX idx_documents_category_id ON documents(category_id);
CREATE INDEX idx_documents_competence_date ON documents(competence_date);

CREATE INDEX idx_titles_document_id ON titles(document_id);
CREATE INDEX idx_titles_due_date ON titles(due_date);
CREATE INDEX idx_titles_status ON titles(status);

CREATE INDEX idx_movements_title_id ON movements(title_id);
CREATE INDEX idx_movements_account_id ON movements(account_id);
CREATE INDEX idx_movements_payment_date ON movements(payment_date);
