import { describe, it, expect } from 'vitest';
import { buildMonthProjection, lastDayOfMonthISO } from '@/domain/finance/monthProjection';
import { Title, TitleStatus } from '@/types/financial';

function title(over: Partial<Title>): Title {
  return {
    id: 't_' + Math.random().toString(36).slice(2, 7),
    documentId: 'd1',
    installment: 1,
    totalInstallments: 1,
    dueDate: '2026-06-15',
    value: 100,
    status: 'previsto',
    side: 'receber',
    contactId: 'c1',
    categoryId: 'cat1',
    description: 'x',
    ...over,
  };
}

const MONTH = '2026-06';
const TODAY = '2026-06-15';

describe('lastDayOfMonthISO', () => {
  it('calcula o último dia do mês', () => {
    expect(lastDayOfMonthISO('2026-06')).toBe('2026-06-30');
    expect(lastDayOfMonthISO('2026-02')).toBe('2026-02-28');
    expect(lastDayOfMonthISO('2026-01')).toBe('2026-01-31');
  });
});

describe('buildMonthProjection', () => {
  it('soma previstos dos dois lados e aplica na fórmula', () => {
    const titles = [
      title({ side: 'receber', status: 'previsto', dueDate: '2026-06-20', value: 1000 }),
      title({ side: 'pagar', status: 'previsto', dueDate: '2026-06-25', value: 400 }),
    ];
    const p = buildMonthProjection(200, titles, MONTH, TODAY);
    expect(p.aReceberPrevisto).toBe(1000);
    expect(p.aPagarPrevisto).toBe(400);
    expect(p.projecao).toBe(800); // 200 + 1000 - 400
  });

  it('vencidos/atrasados entram (dueDate no passado, ainda em aberto)', () => {
    const titles = [title({ side: 'receber', status: 'atrasado', dueDate: '2026-05-10', value: 300 })];
    const p = buildMonthProjection(0, titles, MONTH, TODAY);
    expect(p.aReceberPrevisto).toBe(300);
    expect(p.projecao).toBe(300);
  });

  it('renegociado NÃO entra', () => {
    const titles = [title({ side: 'receber', status: 'renegociado' as TitleStatus, dueDate: '2026-06-18', value: 999 })];
    const p = buildMonthProjection(50, titles, MONTH, TODAY);
    expect(p.aReceberPrevisto).toBe(0);
    expect(p.projecao).toBe(50);
  });

  it('pago/recebido NÃO entram (já liquidados)', () => {
    const titles = [
      title({ side: 'receber', status: 'recebido', dueDate: '2026-06-01', value: 700 }),
      title({ side: 'pagar', status: 'pago', dueDate: '2026-06-02', value: 200 }),
    ];
    const p = buildMonthProjection(100, titles, MONTH, TODAY);
    expect(p.aReceberPrevisto).toBe(0);
    expect(p.aPagarPrevisto).toBe(0);
    expect(p.projecao).toBe(100);
  });

  it('título com vencimento no mês seguinte NÃO entra', () => {
    const titles = [title({ side: 'pagar', status: 'previsto', dueDate: '2026-07-05', value: 500 })];
    const p = buildMonthProjection(100, titles, MONTH, TODAY);
    expect(p.aPagarPrevisto).toBe(0);
    expect(p.projecao).toBe(100);
  });

  it('sem títulos → projeção = realizado', () => {
    const p = buildMonthProjection(150, [], MONTH, TODAY);
    expect(p).toEqual({ projecao: 150, aReceberPrevisto: 0, aPagarPrevisto: 0 });
  });

  it('sinais corretos: a receber soma, a pagar subtrai', () => {
    const titles = [
      title({ side: 'receber', status: 'previsto', dueDate: '2026-06-20', value: 1000 }),
      title({ side: 'receber', status: 'atrasado', dueDate: '2026-05-01', value: 300 }),
      title({ side: 'pagar', status: 'previsto', dueDate: '2026-06-10', value: 400 }),
      title({ side: 'pagar', status: 'previsto', dueDate: '2026-06-28', value: 100 }),
      title({ side: 'receber', status: 'renegociado' as TitleStatus, dueDate: '2026-06-05', value: 999 }), // ignorado
      title({ side: 'pagar', status: 'previsto', dueDate: '2026-07-01', value: 999 }), // mês seguinte, ignorado
    ];
    const p = buildMonthProjection(200, titles, MONTH, TODAY);
    expect(p.aReceberPrevisto).toBe(1300); // 1000 + 300
    expect(p.aPagarPrevisto).toBe(500); // 400 + 100
    expect(p.projecao).toBe(1000); // 200 + 1300 - 500
  });
});
