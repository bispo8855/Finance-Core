-- 0009_conciliation_fields.sql
-- Campos de rastreabilidade para conciliação de importações

-- Fonte de origem do documento (ex: 'Mercado Livre', 'Mercado Pago', etc)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_type TEXT;

-- ID do lote de importação para rastreabilidade
ALTER TABLE documents ADD COLUMN IF NOT EXISTS import_batch_id TEXT;

-- Index composto para conciliação rápida por reference_id + source_type
CREATE INDEX IF NOT EXISTS idx_documents_reference_source 
  ON documents(reference_id, source_type) 
  WHERE reference_id IS NOT NULL;

-- Index para buscar documentos por source_type
CREATE INDEX IF NOT EXISTS idx_documents_source_type 
  ON documents(source_type) 
  WHERE source_type IS NOT NULL;

-- Index para buscar documentos por batch
CREATE INDEX IF NOT EXISTS idx_documents_import_batch 
  ON documents(import_batch_id) 
  WHERE import_batch_id IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN documents.source_type IS 'Origem/marketplace que gerou o documento (ex: Mercado Livre, Shopee)';
COMMENT ON COLUMN documents.import_batch_id IS 'ID do lote de importação para rastreabilidade';
