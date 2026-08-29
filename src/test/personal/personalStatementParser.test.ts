import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseStatement, csvToRows, xlsxToRows, parseAmount, parseDate, detectColumns,
} from '@/domain/personal/import/personalStatementParser';

describe('parseAmount — números BR/US', () => {
  it('BR 1.234,56 e 99,23', () => { expect(parseAmount('1.234,56')).toBe(1234.56); expect(parseAmount('99,23')).toBe(99.23); });
  it('US 1,234.56 e 99.23', () => { expect(parseAmount('1,234.56')).toBe(1234.56); expect(parseAmount('99.23')).toBe(99.23); });
  it('negativos e lixo', () => { expect(parseAmount('-120,00')).toBe(-120); expect(parseAmount('R$ 50,00')).toBe(50); expect(Number.isNaN(parseAmount(''))).toBe(true); });
});

describe('parseDate — DMY (BR) e ISO', () => {
  it('DD/MM/YYYY', () => expect(parseDate('16/08/2026', 'DMY')).toBe('2026-08-16'));
  it('DD/MM/YY', () => expect(parseDate('05/07/26', 'DMY')).toBe('2026-07-05'));
  it('ISO passa direto', () => expect(parseDate('2026-08-16')).toBe('2026-08-16'));
  it('data inválida → vazio', () => expect(parseDate('32/13/2026', 'DMY')).toBe(''));
});

describe('csvToRows + parseStatement — CSV simples (valor único com sinal)', () => {
  const csv = [
    'Data;Histórico;Valor',
    '05/07/2026;Salário ACME;9000,00',
    '10/07/2026;IFOOD *LANCHE;-45,90',
    '12/07/2026;Aluguel Imobiliária;-1330,00',
  ].join('\n');

  it('lê 3 linhas, direção pelo sinal', () => {
    const rows = csvToRows(csv);
    const { lines, mapping } = parseStatement(rows);
    expect(mapping.headerRow).toBe(0);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ date: '2026-07-05', amount: 9000, direction: 'entrada' });
    expect(lines[1]).toMatchObject({ date: '2026-07-10', amount: 45.9, direction: 'saida' });
    expect(lines[2]).toMatchObject({ amount: 1330, direction: 'saida' });
  });
});

describe('detectColumns — cabeçalhos com nomes diferentes', () => {
  it('reconhece débito/crédito separados e histórico', () => {
    const rows = [
      ['Date', 'Description', 'Debit', 'Credit'],
      ['2026-07-05', 'Salario', '', '9000.00'],
      ['2026-07-10', 'Uber', '25.00', ''],
    ];
    const map = detectColumns(rows);
    expect(map.dateCol).toBe(0);
    expect(map.descCol).toBe(1);
    expect(map.debitCol).toBe(2);
    expect(map.creditCol).toBe(3);
    const { lines } = parseStatement(rows);
    expect(lines[0]).toMatchObject({ amount: 9000, direction: 'entrada' });
    expect(lines[1]).toMatchObject({ amount: 25, direction: 'saida' });
  });

  it('sem colunas reconhecíveis → issue global', () => {
    const { mapping, issues } = parseStatement([['foo', 'bar'], ['1', '2']]);
    expect(mapping.headerRow).toBe(-1);
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe('xlsxToRows — XLSX simples (via lib xlsx)', () => {
  it('lê uma planilha gerada em memória', () => {
    const aoa = [
      ['Data', 'Descrição', 'Valor'],
      ['05/07/2026', 'Salário ACME', '9000,00'],
      ['11/07/2026', 'Mercado Extra', '-320,00'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Extrato');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    const rows = xlsxToRows(buffer);
    const { lines } = parseStatement(rows);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ description: 'Salário ACME', amount: 9000, direction: 'entrada' });
    expect(lines[1]).toMatchObject({ amount: 320, direction: 'saida' });
  });
});
