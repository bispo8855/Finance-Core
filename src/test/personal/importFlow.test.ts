import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  summarizeRows,
  hashContent,
  persistImport,
  ImportPersistDeps,
} from '@/domain/personal/import/importFlow';
import { ImportSummary } from '@/domain/personal/import/personalImportInference';

// Extrato sintético (nada real): preâmbulo com titular, cabeçalho e movimentos.
const SAMPLE_ROWS: string[][] = [
  ['Joao Da Silva Teste'],
  ['Extrato conta corrente'],
  ['Data', 'Descricao', 'Valor', 'Saldo'],
  ['05/06/2026', 'Salario ACME', '9000', '9000'],
  ['05/07/2026', 'Salario ACME', '9000', '12000'],
  ['01/06/2026', 'Aluguel Imobiliaria', '-1330', ''],
  ['01/07/2026', 'Aluguel Imobiliaria', '-1330', ''],
  ['09/07/2026', 'IFOOD ALMOCO', '-45', ''],
  ['10/07/2026', 'PAGAMENTO DE FATURA CARTAO', '-2000', ''],
  ['11/07/2026', 'PIX ENVIADO Joao Da Silva Teste', '-150', ''],
  ['12/07/2026', 'Estorno compra', '80', ''],
];

describe('summarizeRows — upload dispara parser + inferência', () => {
  const r = summarizeRows(SAMPLE_ROWS);

  it('gera um ImportSummary a partir das linhas do extrato', () => {
    expect(r.summary.counts.linhas).toBe(8);
    expect(r.summary.rendasProvaveis.length).toBe(1);   // salário recorrente
    expect(r.summary.fixasProvaveis.length).toBe(1);     // aluguel recorrente
    expect(r.summary.pagamentosFatura.length).toBe(1);   // fatura ignorada
    expect(r.summary.transferenciasProprias.length).toBe(1); // PIX ao titular
    expect(r.summary.ignorados.length).toBe(1);          // estorno
    expect(r.summary.counts.variaveis).toBe(1);          // ifood
  });

  it('extrai o titular do preâmbulo', () => {
    expect(r.titularRaw).toBe('Joao Da Silva Teste');
  });

  it('itens por movimento existem (base dos import_items)', () => {
    expect(r.summary.itens.length).toBe(8);
  });
});

describe('hashContent — SHA-256 determinístico e sensível ao conteúdo', () => {
  it('mesmo conteúdo → mesmo hash; conteúdo diferente → hash diferente', async () => {
    const a = await hashContent(JSON.stringify(SAMPLE_ROWS));
    const b = await hashContent(JSON.stringify(SAMPLE_ROWS));
    const c = await hashContent(JSON.stringify([...SAMPLE_ROWS, ['x']]));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/); // SHA-256 = 64 hex
  });

  it('bate com o vetor conhecido de SHA-256 (empty string)', async () => {
    expect(await hashContent('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});

describe('persistImport — grava STAGING (batch + items), nada em personal_*', () => {
  it('cria batch com file_name/file_hash/summary_json e insere items', async () => {
    const r = summarizeRows(SAMPLE_ROWS);
    const createImportBatch = vi.fn(async () => ({ id: 'batch-1' }));
    const insertImportItems = vi.fn(async () => r.summary.itens.length);
    const deps: ImportPersistDeps = { createImportBatch, insertImportItems };

    const out = await persistImport('ws-1', { name: 'extrato.xls', hash: 'abc123' }, r, deps);

    expect(out).toEqual({ batchId: 'batch-1', itemCount: 8 });
    expect(createImportBatch).toHaveBeenCalledWith('ws-1', {
      fileName: 'extrato.xls',
      fileHash: 'abc123',
      titularRaw: 'Joao Da Silva Teste',
      summary: r.summary,
    });
    expect(insertImportItems).toHaveBeenCalledWith('ws-1', 'batch-1', r.summary);
  });

  it('as deps de persistência NÃO incluem applyBatch (staging-only por desenho)', () => {
    const deps: ImportPersistDeps = { createImportBatch: vi.fn(), insertImportItems: vi.fn() };
    expect(Object.keys(deps).sort()).toEqual(['createImportBatch', 'insertImportItems']);
    expect('applyBatch' in deps).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Guardas de ESCOPO (AP4C.1b): a UI de importação não pode aplicar em personal_*,
// não pode ter applyBatch e não pode tocar motor/adapter/Business.
// ---------------------------------------------------------------------------
describe('escopo AP4C.1b — arquivos novos não aplicam nem tocam o proibido', () => {
  const root = path.resolve('.');
  const read = (rel: string) => fs.readFileSync(path.resolve(root, rel), 'utf8');
  const newFiles = [
    'src/domain/personal/import/importFlow.ts',
    'src/hooks/personal/usePersonalImport.ts',
    'src/pages/PersonalImport.tsx',
    'src/components/personal/import/AurysFindings.tsx',
    'src/components/personal/import/ImportUploadCard.tsx',
  ];
  const forbidden = [
    'personal_accounts',
    'personal_income_sources',
    'personal_fixed_commitments',
    'personal_daily_spending',
    'personal_transactions',
    'applyBatch',
    'personalInputsAdapter',
    'buildPersonalInputs',
    'buildPersonalMonth',
  ];

  for (const f of newFiles) {
    it(`${f} não referencia tabelas/aplicação/motor proibidos`, () => {
      const src = read(f);
      for (const term of forbidden) expect(src).not.toContain(term);
    });
  }

  it('a rota /personal/import está registrada no App.tsx', () => {
    expect(read('src/App.tsx')).toContain('/personal/import');
    expect(read('src/App.tsx')).toContain('PersonalImport');
  });

  it('nenhuma migration nova foi criada (0018+ inexistente)', () => {
    const migs = fs.readdirSync(path.resolve(root, 'supabase/migrations'));
    expect(migs.some((m) => /^0018/.test(m))).toBe(false);
  });
});

// Sanidade de tipos: garante que ImportSummary continua com os blocos usados pela tela.
describe('contrato do ImportSummary consumido pela tela', () => {
  it('tem os campos dos 9 blocos + avisos', () => {
    const r = summarizeRows(SAMPLE_ROWS);
    const s: ImportSummary = r.summary;
    expect(s).toHaveProperty('saldo');
    expect(s).toHaveProperty('rendasProvaveis');
    expect(s).toHaveProperty('fixasProvaveis');
    expect(s).toHaveProperty('transferenciasProprias');
    expect(s).toHaveProperty('pagamentosFatura');
    expect(s).toHaveProperty('gastosVariaveis');
    expect(s).toHaveProperty('duvidosos');
    expect(s).toHaveProperty('ignorados');
    expect(s).toHaveProperty('alertaContaMista');
    expect(s.period).toHaveProperty('mesesParciais');
  });
});
