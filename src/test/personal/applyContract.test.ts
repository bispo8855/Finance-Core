import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  hasExplicitAccountTarget,
  batchNeedsReimport,
  decideIncomeRoutine,
  isEssential,
  ESSENTIAL_CATEGORIES,
  PRUDENCE_DAILY_MIN_BLOCKER,
  AccountTarget,
} from '@/domain/personal/import/applyContract';

describe('AccountTarget — saldo só entra com alvo de conta explícito', () => {
  it('titular NUNCA é identidade de conta; exige AccountTarget válido', () => {
    expect(hasExplicitAccountTarget(null)).toBe(false);
    expect(hasExplicitAccountTarget(undefined)).toBe(false);
    expect(hasExplicitAccountTarget({ kind: 'existing', accountId: '' })).toBe(false);
    expect(hasExplicitAccountTarget({ kind: 'new', label: '   ' })).toBe(false);
    expect(hasExplicitAccountTarget({ kind: 'existing', accountId: 'acc-1' })).toBe(true);
    expect(hasExplicitAccountTarget({ kind: 'new', label: 'Conta corrente' })).toBe(true);
  });

  it('o tipo AccountTarget é discriminado por kind (existing | new)', () => {
    const a: AccountTarget = { kind: 'existing', accountId: 'x' };
    const b: AccountTarget = { kind: 'new', label: 'y' };
    expect(a.kind).toBe('existing');
    expect(b.kind).toBe('new');
  });
});

describe('batchNeedsReimport — sem backfill heurístico', () => {
  it('renda/fixa sem group_key → exige reimportação', () => {
    expect(batchNeedsReimport([{ inferred_kind: 'renda', group_key: null }])).toBe(true);
    expect(batchNeedsReimport([{ inferred_kind: 'fixa', group_key: null }])).toBe(true);
  });
  it('renda/fixa com group_key → não exige', () => {
    expect(batchNeedsReimport([
      { inferred_kind: 'renda', group_key: 'renda:salario acme' },
      { inferred_kind: 'fixa', group_key: 'fixa:aluguel imobiliaria' },
    ])).toBe(false);
  });
  it('outros kinds sem group_key não travam a aplicação', () => {
    expect(batchNeedsReimport([
      { inferred_kind: 'variavel', group_key: null },
      { inferred_kind: 'ignorado', group_key: null },
      { inferred_kind: 'transferencia_propria', group_key: null },
    ])).toBe(false);
  });
});

describe('decideIncomeRoutine — renda confirmada ≠ recorrência confirmada', () => {
  it('1 ocorrência confirmada como RENDA (não recorrente) → none', () => {
    expect(decideIncomeRoutine({ occurrences: 1, userConfirmedIncome: true })).toBe('none');
  });
  it('1 ocorrência + userConfirmedRecurring=true → monthly', () => {
    expect(decideIncomeRoutine({ occurrences: 1, userConfirmedRecurring: true })).toBe('monthly');
  });
  it('ocorrência em ≥2 meses distintos → monthly', () => {
    expect(decideIncomeRoutine({ occurrences: 2 })).toBe('monthly');
  });
  it('renda pontual (1 ocorrência, sem confirmações) → none', () => {
    expect(decideIncomeRoutine({ occurrences: 1 })).toBe('none');
  });
  it('confirmar renda + confirmar recorrência → monthly (recorrência é que decide)', () => {
    expect(decideIncomeRoutine({ occurrences: 1, userConfirmedIncome: true, userConfirmedRecurring: true })).toBe('monthly');
  });
});

describe('isEssential — categorias e utilidades essenciais', () => {
  it('categorias essenciais', () => {
    expect(isEssential('Moradia')).toBe(true);
    expect(isEssential('Saúde')).toBe(true);
    expect(isEssential('Educação')).toBe(true);
    expect(isEssential('Dívidas/Financiamentos')).toBe(true);
  });
  it('utilidades essenciais por descrição (água/energia/luz/gás/internet)', () => {
    expect(isEssential('Outros', 'CONTA DE AGUA SABESP')).toBe(true);
    expect(isEssential('Outros', 'ENERGIA ELETRICA')).toBe(true);
    expect(isEssential('Outros', 'CONTA DE LUZ')).toBe(true);
    expect(isEssential('Outros', 'GAS ENCANADO')).toBe(true);
    expect(isEssential('Outros', 'INTERNET FIBRA')).toBe(true);
  });
  it('não-essencial', () => {
    expect(isEssential('Restaurantes/Delivery', 'IFOOD ALMOCO')).toBe(false);
    expect(isEssential(null, 'UBER VIAGEM')).toBe(false);
  });
  it('o conjunto essencial não inclui Assinaturas/Serviços', () => {
    expect(ESSENTIAL_CATEGORIES.has('Moradia')).toBe(true);
    // Assinaturas/Serviços NÃO é essencial por natureza (é categoria válida, mas fora do conjunto).
    expect(ESSENTIAL_CATEGORIES.has('Assinaturas/Serviços')).toBe(false);
  });
});

describe('bloqueador do prudence (registrado, NÃO corrigido nesta fatia)', () => {
  it('o contrato registra o bloqueador do diaMin=0', () => {
    expect(PRUDENCE_DAILY_MIN_BLOCKER).toMatch(/diaMin=0/);
    expect(PRUDENCE_DAILY_MIN_BLOCKER).toMatch(/AP4C\.1c-2/);
  });
  // Correção do planner fica para a fatia que corrigir o disponível prudente.
  it.todo('prudence.ts: herdar estimativa de dailySpending em vez de diaMin=0');
});

describe('migration 0018 — contrato de aplicação', () => {
  const sql = fs.readFileSync(
    path.resolve('supabase/migrations/0018_personal_import_application_contract.sql'),
    'utf8',
  );

  it('adiciona group_key em personal_import_items', () => {
    expect(sql).toMatch(/ALTER TABLE\s+public\.personal_import_items\s+ADD COLUMN IF NOT EXISTS\s+group_key\s+TEXT\s+NULL/);
  });
  it('cria índice (batch_id, group_key)', () => {
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS[^;]*personal_import_items\s*\(batch_id,\s*group_key\)/);
  });
  it('adiciona applied_account_id (coluna) em personal_import_batches', () => {
    expect(sql).toMatch(/ALTER TABLE\s+public\.personal_import_batches\s+ADD COLUMN IF NOT EXISTS\s+applied_account_id\s+UUID\s+NULL/);
  });

  it('cria UNIQUE (id, workspace_id) em personal_accounts (alvo da FK composta)', () => {
    expect(sql).toMatch(/personal_accounts[\s\S]*?UNIQUE\s*\(id,\s*workspace_id\)/);
  });

  it('FK COMPOSTA (applied_account_id, workspace_id) → personal_accounts(id, workspace_id) com SET NULL por coluna', () => {
    const fk = /FOREIGN KEY\s*\(applied_account_id,\s*workspace_id\)\s*REFERENCES\s+public\.personal_accounts\s*\(id,\s*workspace_id\)\s*ON DELETE SET NULL\s*\(applied_account_id\)/;
    expect(sql).toMatch(fk);
  });

  it('NÃO existe FK simples apenas por applied_account_id', () => {
    expect(sql).not.toMatch(/FOREIGN KEY\s*\(applied_account_id\)\s*REFERENCES/);
    expect(sql).not.toMatch(/applied_account_id\s+UUID\s+NULL\s+REFERENCES/);
    // e o SET NULL não pode ser "cru" (que tentaria anular workspace_id também)
    expect(sql).not.toMatch(/REFERENCES\s+public\.personal_accounts\s*\(id,\s*workspace_id\)\s*ON DELETE SET NULL\s*;/);
  });

  it('é aditiva: sem DROP COLUMN e sem aplicação em personal_* de entrada', () => {
    expect(sql).not.toMatch(/DROP COLUMN/i);
    expect(sql).not.toMatch(/INSERT INTO/i);
    expect(sql).not.toMatch(/CREATE TABLE/i);
  });
});
