import { describe, it, expect } from 'vitest';
import { inferFromLines } from '@/domain/personal/import/personalImportInference';
import { NormalizedLine } from '@/domain/personal/import/personalStatementParser';
import { categorize } from '@/domain/personal/import/personalCategories';

let seq = 0;
const line = (date: string, description: string, amount: number, direction: 'entrada' | 'saida'): NormalizedLine =>
  ({ date, description, amount, direction, sourceRow: seq++, confidence: 'alta', issues: [] });

describe('categorize — por comerciante', () => {
  it('mapeia merchants conhecidos', () => {
    expect(categorize('IFOOD *LANCHE').category).toBe('Restaurantes/Delivery');
    expect(categorize('UBER *TRIP').category).toBe('Transporte');
    expect(categorize('Supermercado Extra').category).toBe('Mercado');
    expect(categorize('NETFLIX.COM').category).toBe('Assinaturas/Serviços');
  });
  it('desconhecido → Outros com baixa confiança', () => {
    const g = categorize('XPTO 4839');
    expect(g.category).toBe('Outros');
    expect(g.confidence).toBe('baixa');
  });
});

describe('inferFromLines — blocos do summary', () => {
  it('renda recorrente em 2 meses vira renda provável', () => {
    const s = inferFromLines([
      line('2026-06-05', 'Salário ACME', 9000, 'entrada'),
      line('2026-07-05', 'Salário ACME', 9000, 'entrada'),
    ]);
    expect(s.rendasProvaveis).toHaveLength(1);
    expect(s.rendasProvaveis[0]).toMatchObject({ amount: 9000, occurrences: 2 });
    expect(s.rendasProvaveis[0].months).toEqual(['2026-06', '2026-07']);
  });

  it('conta fixa recorrente (2 meses, mesmo valor) vira fixa provável com dia', () => {
    const s = inferFromLines([
      line('2026-06-01', 'Aluguel Imobiliária', 1330, 'saida'),
      line('2026-07-01', 'Aluguel Imobiliária', 1330, 'saida'),
    ]);
    expect(s.fixasProvaveis).toHaveLength(1);
    expect(s.fixasProvaveis[0]).toMatchObject({ amount: 1330, dayOfMonth: 1, occurrences: 2 });
  });

  it('pagamento de fatura é IGNORADO da despesa (não é gasto)', () => {
    const s = inferFromLines([
      line('2026-07-10', 'PAGAMENTO DE FATURA CARTAO', 2689.4, 'saida'),
      line('2026-07-11', 'IFOOD *LANCHE', 45.9, 'saida'),
    ]);
    expect(s.pagamentosFatura).toHaveLength(1);
    expect(s.pagamentosFatura[0].amount).toBe(2689.4);
    // não entra em gastos variáveis
    expect(s.gastosVariaveis.total).toBe(45.9);
  });

  it('trilho sem contraparte identificável → dúvida para revisão (não vira gasto)', () => {
    const s = inferFromLines([
      line('2026-07-15', 'TED transferencia enviada', 500, 'saida'),
    ]);
    expect(s.gastosVariaveis.total).toBe(0);
    expect(s.transferenciasProprias).toHaveLength(0);
    expect(s.duvidosos.some((d) => d.reason.includes('sem contraparte'))).toBe(true);
  });

  it('PIX "entre contas" (indício de conta própria) → transferência própria, ignorada', () => {
    const s = inferFromLines([
      line('2026-07-15', 'PIX enviado entre contas', 500, 'saida'),
      line('2026-07-16', 'PIX recebido entre contas', 500, 'entrada'),
    ]);
    expect(s.transferenciasProprias).toHaveLength(2);
    expect(s.gastosVariaveis.total).toBe(0);
    expect(s.rendasProvaveis).toHaveLength(0);
  });

  it('reembolso/estorno não é renda estrutural', () => {
    const s = inferFromLines([
      line('2026-07-20', 'Estorno compra', 80, 'entrada'),
    ]);
    expect(s.rendasProvaveis).toHaveLength(0);
    expect(s.ignorados.some((i) => i.reason.includes('não é renda estrutural'))).toBe(true);
  });

  it('gastos variáveis viram categorias e dia a dia é RESÍDUO por mês', () => {
    const s = inferFromLines([
      // junho: 100 + 200 = 300
      line('2026-06-03', 'IFOOD', 100, 'saida'),
      line('2026-06-10', 'Uber viagem', 200, 'saida'),
      // julho: 150 + 50 = 200
      line('2026-07-03', 'IFOOD', 150, 'saida'),
      line('2026-07-10', 'Uber viagem', 50, 'saida'),
    ]);
    // Uber e IFOOD não recorrem como fixa (valores diferentes) → variáveis
    expect(s.gastosVariaveis.total).toBe(500);
    const cats = Object.fromEntries(s.gastosVariaveis.byCategory.map((c) => [c.category, c.total]));
    expect(cats['Restaurantes/Delivery']).toBe(250);
    expect(cats['Transporte']).toBe(250);
    // dia a dia = resíduo medido: min 200 (jul), heavy 300 (jun)
    expect(s.diaADia.porMes).toEqual([{ monthISO: '2026-06', total: 300, parcial: true }, { monthISO: '2026-07', total: 200, parcial: true }]);
    expect(s.diaADia.min).toBe(200);
    expect(s.diaADia.heavy).toBe(300);
    expect(s.diaADia.confidence).toBe('baixa'); // só 2 meses (parciais)
  });

  it('período e contagens no summary', () => {
    const s = inferFromLines([
      line('2026-06-05', 'Salário ACME', 9000, 'entrada'),
      line('2026-07-05', 'Salário ACME', 9000, 'entrada'),
      line('2026-07-10', 'IFOOD', 45, 'saida'),
    ]);
    expect(s.period.from).toBe('2026-06-05');
    expect(s.period.to).toBe('2026-07-10');
    expect(s.period.months).toEqual(['2026-06', '2026-07']);
    expect(s.counts.linhas).toBe(3);
    expect(s.counts.rendas).toBe(1);
  });

  it('categoria GATEIA recorrência — UBER recorrente NÃO vira fixa (fica em Transporte/variável)', () => {
    const s = inferFromLines([
      line('2026-06-12', 'UBER *TRIP', 25, 'saida'),
      line('2026-07-12', 'UBER *TRIP', 25, 'saida'),
    ]);
    expect(s.fixasProvaveis).toHaveLength(0);
    expect(s.gastosVariaveis.total).toBe(50);
    expect(s.gastosVariaveis.byCategory.find((c) => c.category === 'Transporte')?.total).toBe(50);
  });

  it('Supermercado recorrente NÃO vira fixa (fica em Mercado/variável)', () => {
    const s = inferFromLines([
      line('2026-06-15', 'Supermercado Extra', 400, 'saida'),
      line('2026-07-16', 'Supermercado Extra', 400, 'saida'),
    ]);
    expect(s.fixasProvaveis).toHaveLength(0);
    expect(s.gastosVariaveis.byCategory.find((c) => c.category === 'Mercado')?.total).toBe(800);
  });

  it('Netflix recorrente VIRA fixa (Assinaturas/Serviços é fixa por natureza)', () => {
    const s = inferFromLines([
      line('2026-06-08', 'NETFLIX.COM', 39.9, 'saida'),
      line('2026-07-08', 'NETFLIX.COM', 39.9, 'saida'),
    ]);
    expect(s.fixasProvaveis).toHaveLength(1);
    expect(s.fixasProvaveis[0].amount).toBe(39.9);
    expect(s.gastosVariaveis.total).toBe(0);
  });

  it('Aluguel recorrente VIRA fixa (Moradia)', () => {
    const s = inferFromLines([
      line('2026-06-01', 'Aluguel Imobiliária', 1330, 'saida'),
      line('2026-07-01', 'Aluguel Imobiliária', 1330, 'saida'),
    ]);
    expect(s.fixasProvaveis).toHaveLength(1);
    expect(s.fixasProvaveis[0]).toMatchObject({ amount: 1330, dayOfMonth: 1 });
  });

  it('Saúde recorrente é elegível a fixa, mas com confiança BAIXA', () => {
    const s = inferFromLines([
      line('2026-06-10', 'Unimed mensalidade', 500, 'saida'),
      line('2026-07-10', 'Unimed mensalidade', 500, 'saida'),
    ]);
    expect(s.fixasProvaveis).toHaveLength(1);
    expect(s.fixasProvaveis[0].confidence).toBe('baixa');
  });

  it('dia a dia residual AUMENTA quando Uber/Mercado deixam de ser fixas', () => {
    const s = inferFromLines([
      // jun: uber 25 + mercado 400 = 425 ; jul: uber 25 + mercado 400 = 425
      line('2026-06-12', 'UBER *TRIP', 25, 'saida'),
      line('2026-06-15', 'Supermercado Extra', 400, 'saida'),
      line('2026-07-12', 'UBER *TRIP', 25, 'saida'),
      line('2026-07-16', 'Supermercado Extra', 400, 'saida'),
    ]);
    // ambos recorrem mas são variáveis → entram no resíduo
    expect(s.fixasProvaveis).toHaveLength(0);
    expect(s.diaADia.porMes).toEqual([{ monthISO: '2026-06', total: 425, parcial: true }, { monthISO: '2026-07', total: 425, parcial: true }]);
    expect(s.diaADia.min).toBe(425);
    expect(s.diaADia.heavy).toBe(425);
  });

  it('NÃO calcula Sobra Real / saldo projetado — o summary não tem esses campos', () => {
    const s = inferFromLines([line('2026-07-05', 'Salário', 9000, 'entrada')]);
    const json = JSON.stringify(s).toLowerCase();
    expect(json).not.toContain('sobra');
    expect(json).not.toContain('saldoprojetado');
    expect(json).not.toContain('disponivelprudente');
  });
});

describe('AP4C.0.1 — calibração PF/PIX', () => {
  const titular = 'joao da silva teste';

  it('PIX ENVIADO a terceiro (empresa) → gasto categorizável, não transferência', () => {
    const s = inferFromLines([line('2026-08-24', 'PIX ENVIADO INTERNET SERVICOS E COBRA', 89.9, 'saida')], { titular });
    expect(s.transferenciasProprias).toHaveLength(0);
    // 'internet' → Assinaturas/Serviços (fixa por natureza + descrição) → vira fixa provável
    expect(s.fixasProvaveis.some((f) => f.description.includes('INTERNET'))).toBe(true);
    expect(s.duvidosos).toHaveLength(0);
  });

  it('PIX ENVIADO a pessoa (posto) → gasto, categoria Transporte', () => {
    const s = inferFromLines([line('2026-08-24', 'PIX ENVIADO AUTO POSTO ITAMARATI LIBE', 118.38, 'saida')], { titular });
    expect(s.transferenciasProprias).toHaveLength(0);
    expect(s.gastosVariaveis.byCategory.find((c) => c.category === 'Transporte')?.total).toBe(118.38);
  });

  it('PIX RECEBIDO de terceiro → recebimento/renda candidata (não transferência)', () => {
    const s = inferFromLines([
      line('2026-06-10', 'PIX RECEBIDO Cliente Fulano', 3800, 'entrada'),
      line('2026-07-10', 'PIX RECEBIDO Cliente Fulano', 3800, 'entrada'),
    ], { titular });
    expect(s.transferenciasProprias).toHaveLength(0);
    expect(s.rendasProvaveis).toHaveLength(1); // recorrente → renda provável
  });

  it('PIX com nome do TITULAR → transferência própria, ignorada', () => {
    const s = inferFromLines([line('2026-08-24', 'PIX ENVIADO Joao Da Silva Teste', 150, 'saida')], { titular });
    expect(s.transferenciasProprias).toHaveLength(1);
    expect(s.gastosVariaveis.total).toBe(0);
    expect(s.duvidosos).toHaveLength(0);
  });

  it('PIX a terceiro SEM contraparte discernível → revisão', () => {
    const s = inferFromLines([line('2026-08-24', 'PIX ENVIADO', 50, 'saida')], { titular });
    expect(s.duvidosos.some((d) => d.reason.includes('sem contraparte'))).toBe(true);
  });

  it('seguro/mensalidade/parcela detecta fixa provável mesmo com 1 mês', () => {
    const s = inferFromLines([line('2026-08-24', 'MENSALIDADE DE SEGURO Parc 011/012 INCENDIO RES', 51.95, 'saida')], { titular });
    expect(s.fixasProvaveis).toHaveLength(1);
    expect(s.fixasProvaveis[0].confidence).toBe('baixa'); // 1 mês, por descrição
  });

  it('Uber/Mercado continuam variáveis mesmo com termo repetido', () => {
    const s = inferFromLines([
      line('2026-06-12', 'UBER *TRIP', 25, 'saida'),
      line('2026-07-12', 'UBER *TRIP', 25, 'saida'),
      line('2026-06-15', 'Supermercado Extra', 400, 'saida'),
      line('2026-07-15', 'Supermercado Extra', 400, 'saida'),
    ], { titular });
    expect(s.fixasProvaveis).toHaveLength(0);
    expect(s.gastosVariaveis.total).toBe(850);
  });

  it('conta mista PF/PJ gera ALERTA, não classificação forçada', () => {
    const s = inferFromLines([line('2026-08-24', 'PAGAMENTO A FORNECEDORES', 990, 'entrada')], { titular });
    expect(s.alertaContaMista).toBeTruthy();
    expect(s.alertaContaMista).toContain('PF/PJ');
    expect(s.rendasProvaveis).toHaveLength(0); // não forçou renda
  });

  it('mês parcial gera issue e confiança baixa no dia a dia', () => {
    // só agosto, começando dia 10 (mês incompleto) → parcial
    const s = inferFromLines([
      line('2026-08-10', 'IFOOD', 40, 'saida'),
      line('2026-08-20', 'IFOOD', 60, 'saida'),
    ], { titular });
    expect(s.period.mesesParciais).toContain('2026-08');
    expect(s.diaADia.confidence).toBe('baixa');
    expect(s.diaADia.issues.length).toBeGreaterThan(0);
  });

  it('saldo é extraído do meta (movimento) e exposto no summary', () => {
    const s = inferFromLines([line('2026-08-24', 'IFOOD', 40, 'saida')], { titular, accountBalance: 25653.85 });
    expect(s.saldo).toEqual({ valor: 25653.85, fonte: 'movimento' });
  });

  it('saldo do rodapé quando não há saldo por movimento', () => {
    const s = inferFromLines([line('2026-08-24', 'IFOOD', 40, 'saida')], { footerBalance: 1000 });
    expect(s.saldo).toEqual({ valor: 1000, fonte: 'rodape' });
  });
});
