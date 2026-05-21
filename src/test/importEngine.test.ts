import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { processImportFile } from '@/services/importEngine';

describe('Import Engine - Mercado Livre Sales', () => {
  it('should parse ML sales and infer settlement status correctly', async () => {
    const headers = ['N.º de venda', 'Data da venda', 'Título do anuncio', 'Total (BRL)', 'Estado da venda', 'Liberação do dinheiro'];
    const rows = [
      ['1000001', '15/05/2026', 'Produto A', '99,32', 'Liberado', '15/05/2026'],
      ['1000002', '15/05/2026', 'Produto B', '185,47', 'Liberado', '15/05/2026'],
      ['1000003', '15/05/2026', 'Produto C', '185,47', 'Pendente', '25/05/2026'],
      ['1000004', '15/05/2026', 'Produto D', '185,47', 'Em revisão', '25/05/2026'],
    ];

    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const batch = await processImportFile(buffer, 'test.xlsx', 'xlsx', 'Mercado Livre', 'sales');

    const mapped = batch.events.map(e => ({
      title: e.title,
      amount: e.netAmount,
      settlementStatus: e.settlementStatus,
      settlementReason: e.settlementReason,
      primaryType: e.primaryType
    }));

    console.log('Parsed Events:', JSON.stringify(mapped, null, 2));

    expect(batch.events.length).toBe(4);
    
    const eventA = batch.events.find(e => e.title === 'Produto A');
    expect(eventA).toBeDefined();
    expect(eventA!.settlementStatus).toBe('settled');

    const eventB = batch.events.find(e => e.title === 'Produto B');
    expect(eventB).toBeDefined();
    expect(eventB!.settlementStatus).toBe('settled');

    const eventC = batch.events.find(e => e.title === 'Produto C');
    expect(eventC).toBeDefined();
    expect(eventC!.settlementStatus).toBe('predicted');

    const eventD = batch.events.find(e => e.title === 'Produto D');
    expect(eventD).toBeDefined();
    expect(eventD!.settlementStatus).toBe('review');
  });
});
