import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { inferFromLines } from '@/domain/personal/import/personalImportInference';
import { NormalizedLine } from '@/domain/personal/import/personalStatementParser';
import { mapImportSummaryToStagingItems, mapImportSummaryToBatch } from '@/domain/personal/import/importStaging';

let seq = 0;
const line = (date: string, description: string, amount: number, direction: 'entrada' | 'saida'): NormalizedLine =>
  ({ date, description, amount, direction, sourceRow: seq++, confidence: 'alta', issues: [] });

function sampleSummary() {
  return inferFromLines([
    line('2026-06-05', 'Salário ACME', 9000, 'entrada'),
    line('2026-07-05', 'Salário ACME', 9000, 'entrada'),
    line('2026-06-01', 'Aluguel Imobiliária', 1330, 'saida'),
    line('2026-07-01', 'Aluguel Imobiliária', 1330, 'saida'),
    line('2026-07-09', 'IFOOD *ALMOCO', 45, 'saida'),
    line('2026-07-10', 'PAGAMENTO DE FATURA CARTAO', 2000, 'saida'),
    line('2026-07-11', 'PIX ENVIADO Joao Da Silva Teste', 150, 'saida'),
    line('2026-07-12', 'Estorno compra', 80, 'entrada'),
  ], { titular: 'joao da silva teste' });
}

describe('mapImportSummaryToStagingItems — ImportSummary vira import_items com kinds corretos', () => {
  const items = mapImportSummaryToStagingItems(sampleSummary());
  const kind = (kinds: string) => items.filter((i) => i.inferred_kind === kinds);

  it('cada movimento vira um item com inferred_kind', () => {
    expect(items.length).toBe(8);
    expect(kind('renda').length).toBe(2);          // salário 2 meses
    expect(kind('fixa').length).toBe(2);           // aluguel 2 meses
    expect(kind('variavel').length).toBe(1);       // ifood
    expect(kind('pagamento_fatura').length).toBe(1);
    expect(kind('transferencia_propria').length).toBe(1); // PIX titular
    expect(kind('ignorado').length).toBe(1);       // estorno
  });

  it('item traz raw_date/raw_description/raw_amount/direction e categoria inferida', () => {
    const ifood = items.find((i) => i.raw_description.includes('IFOOD'))!;
    expect(ifood).toMatchObject({ inferred_kind: 'variavel', inferred_category: 'Restaurantes/Delivery', direction: 'saida', raw_amount: 45 });
    const fatura = items.find((i) => i.inferred_kind === 'pagamento_fatura')!;
    expect(fatura.inferred_category).toBeNull();
  });

  it('mapper NÃO inclui campos de decisão do usuário (só o inferido)', () => {
    for (const i of items) {
      expect(i).not.toHaveProperty('user_kind');
      expect(i).not.toHaveProperty('user_category');
      expect(i).not.toHaveProperty('user_decision');
    }
  });
});

describe('mapImportSummaryToBatch', () => {
  it('deriva período, meses completos/parciais e saldo', () => {
    const s = inferFromLines([
      line('2026-06-01', 'Aluguel', 1000, 'saida'),
      line('2026-07-31', 'IFOOD', 40, 'saida'),
    ], { accountBalance: 313.5 });
    const b = mapImportSummaryToBatch(s);
    expect(b.period_start).toBe('2026-06-01');
    expect(b.period_end).toBe('2026-07-31');
    // 01/06 (dia 1) a 31/07 (último dia) → ambos os meses COMPLETOS
    expect(b.months_partial).toEqual([]);
    expect(b.months_complete).toEqual(['2026-06', '2026-07']);
    expect(b.detected_balance).toBe(313.5);
    expect(b.balance_source).toBe('movimento');
    expect(b.summary_json).toBe(s);
  });
});

describe('migration 0017 — conteúdo', () => {
  const sql = fs.readFileSync(path.resolve('supabase/migrations/0017_personal_import_staging.sql'), 'utf8');

  it('cria exatamente as 3 tabelas de staging', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.personal_import_batches');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.personal_import_items');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.personal_category_rules');
  });
  it('RLS habilitada nas 3', () => {
    expect((sql.match(/ENABLE ROW LEVEL SECURITY/g) || []).length).toBe(3);
  });
  it('policies exigem workspace_type=personal em USING e WITH CHECK (6 ocorrências)', () => {
    expect((sql.match(/workspace_type = 'personal'/g) || []).length).toBe(6);
    expect((sql.match(/CREATE POLICY/g) || []).length).toBe(3);
  });
  it('source_kind só aceita extrato; unique de category_rules; retention_until presente', () => {
    expect(sql).toContain("source_kind IN ('extrato')");
    expect(sql).toContain('UNIQUE (workspace_id, match_type, pattern)');
    expect(sql).toContain('retention_until DATE NULL');
  });

  it('integridade: batch tem UNIQUE (id, workspace_id) e item tem FK composta ao mesmo workspace', () => {
    // alvo da FK
    expect(sql).toMatch(/UNIQUE\s*\(id,\s*workspace_id\)/);
    // FK composta (batch_id, workspace_id) → batches(id, workspace_id)
    const fk = /FOREIGN KEY\s*\(batch_id,\s*workspace_id\)\s*REFERENCES\s+public\.personal_import_batches\s*\(id,\s*workspace_id\)\s*ON DELETE CASCADE/;
    expect(sql).toMatch(fk);
    // batch_id NÃO usa mais a FK simples só para batches(id)
    expect(sql).not.toMatch(/batch_id UUID NOT NULL REFERENCES public\.personal_import_batches\(id\)/);
  });

  it('NÃO cria personal_transactions', () => {
    expect(sql).not.toMatch(/CREATE TABLE.*personal_transactions/);
  });
});
