-- Add marketplace-specific fields to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(12,2);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS marketplace_fee NUMERIC(12,2);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(12,2);

-- Comment for documentation
COMMENT ON COLUMN documents.gross_amount IS 'Valor bruto da venda no marketplace';
COMMENT ON COLUMN documents.marketplace_fee IS 'Taxa de comissão do marketplace';
COMMENT ON COLUMN documents.shipping_cost IS 'Custo de frete/logística';
