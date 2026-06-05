import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as XLSX from 'xlsx';
import { processImportFile } from '@/services/importEngine';
import { conciliateBatch } from '@/services/conciliationService';
import { persistApprovedEvents } from '@/services/importPersister';
import { supabaseFinanceService } from '@/services/finance/supabaseFinanceService';
import { groupMovementsIntoEvents, calculateStatementBalances } from '@/domain/extract';

// Configurando mock em-memória para simular o banco PostgreSQL do Supabase para esta suite de testes
const db: Record<string, any[]> = {
  accounts: [],
  categories: [],
  contacts: [],
  documents: [],
  titles: [],
  movements: []
};

vi.mock('@/lib/supabaseClient', () => {
  const mockFrom = (table: string) => {
    return {
      select: (queryStr: string = '*') => {
        const rows = db[table] || [];
        return {
          eq: (col: string, val: any) => {
            const filtered = rows.filter(r => r[col] === val);
            return {
              single: async () => {
                if (filtered.length === 0) return { data: null, error: { code: 'PGRST116', message: 'No rows found' } };
                return { data: filtered[0], error: null };
              },
              select: () => ({
                single: async () => {
                  if (filtered.length === 0) return { data: null, error: { code: 'PGRST116', message: 'No rows found' } };
                  return { data: filtered[0], error: null };
                }
              }),
              then: (resolve: any) => resolve({ data: filtered, error: null })
            };
          },
          in: (col: string, vals: any[]) => {
            const filtered = rows.filter(r => vals.includes(r[col]));
            return {
              eq: (c: string, v: any) => {
                const f2 = filtered.filter(r => r[c] === v);
                return {
                  then: (resolve: any) => resolve({ data: f2, error: null })
                };
              },
              then: (resolve: any) => resolve({ data: filtered, error: null })
            };
          },
          then: (resolve: any) => resolve({ data: rows, error: null })
        };
      },
      insert: (data: any) => {
        const items = Array.isArray(data) ? data : [data];
        const inserted: any[] = [];
        for (const item of items) {
          const id = item.id || `id_${Math.random().toString(36).substring(2, 9)}`;
          const newItem = { id, ...item };
          db[table].push(newItem);
          inserted.push(newItem);
        }
        return {
          select: (queryStr: string = '*') => {
            return {
              single: async () => ({ data: inserted[0], error: null }),
              then: (resolve: any) => resolve({ data: inserted, error: null })
            };
          },
          then: (resolve: any) => resolve({ data: inserted, error: null })
        };
      },
      update: (data: any) => {
        return {
          eq: (col: string, val: any) => {
            const rows = db[table] || [];
            const updated: any[] = [];
            for (const row of rows) {
              if (row[col] === val) {
                Object.assign(row, data);
                updated.push(row);
              }
            }
            return {
              select: (queryStr: string = '*') => {
                return {
                  single: async () => ({ data: updated[0], error: null }),
                  then: (resolve: any) => resolve({ data: updated, error: null })
                };
              },
              eq: (col2: string, val2: any) => {
                return {
                  select: () => ({
                    single: async () => ({ data: updated[0], error: null })
                  }),
                  then: (resolve: any) => resolve({ data: updated, error: null })
                };
              },
              then: (resolve: any) => resolve({ data: updated, error: null })
            };
          }
        };
      },
      delete: () => {
        return {
          eq: (col: string, val: any) => {
            const rows = db[table] || [];
            db[table] = rows.filter(r => r[col] !== val);
            return {
              eq: (col2: string, val2: any) => {
                const rows2 = db[table] || [];
                db[table] = rows2.filter(r => r[col2] !== val2);
                return {
                  then: (resolve: any) => resolve({ data: null, error: null })
                };
              },
              then: (resolve: any) => resolve({ data: null, error: null })
            };
          },
          in: (col: string, vals: any[]) => {
            const rows = db[table] || [];
            db[table] = rows.filter(r => !vals.includes(r[col]));
            return {
              eq: (col2: string, val2: any) => {
                const rows2 = db[table] || [];
                db[table] = rows2.filter(r => r[col2] !== val2);
                return {
                  then: (resolve: any) => resolve({ data: null, error: null })
                };
              },
              then: (resolve: any) => resolve({ data: null, error: null })
            };
          }
        };
      }
    };
  };

  const mockAuth = {
    getUser: async () => {
      return { data: { user: { id: 'mock-user-id', email: 'marcelo.bispo@moveedu.com.br' } }, error: null };
    },
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
  };

  return {
    supabase: {
      from: mockFrom,
      auth: mockAuth
    }
  };
});

describe('Camada de Classificação Semântica de Saídas e Entradas', () => {
  beforeAll(() => {
    // 1. Inicializar conta bancária padrão
    db.accounts = [{
      id: 'acc_mp',
      user_id: 'mock-user-id',
      name: 'Mercado Pago Principal',
      initial_balance: 1000.00,
      opening_balance: 1000.00,
      opening_balance_date: '2026-05-01',
      institution: 'Mercado Pago',
      is_active: true
    }];

    // 2. Inicializar categorias padrão
    db.categories = [
      {
        id: 'cat_venda',
        user_id: 'mock-user-id',
        name: 'Venda de Produtos',
        kind: 'receita',
        dre_classification: 'receita_bruta',
        is_active: true
      },
      {
        id: 'cat_venda_esp',
        user_id: 'mock-user-id',
        name: 'Vendas Especiais',
        kind: 'receita',
        dre_classification: 'receita_bruta',
        is_active: true
      },
      {
        id: 'cat_pending',
        user_id: 'mock-user-id',
        name: 'Movimentação Pendente de Classificação',
        kind: 'financeiro',
        dre_classification: 'outro',
        is_active: true
      },
      {
        id: 'cat_embalagens',
        user_id: 'mock-user-id',
        name: 'Embalagens',
        kind: 'custo',
        dre_classification: 'custo_variavel',
        is_active: true
      }
    ];

    // 3. Inicializar contatos
    db.contacts = [
      {
        id: 'contact_fornecedor_conhecido',
        user_id: 'mock-user-id',
        name: 'Fornecedor Conhecido Ltda',
        kind: 'fornecedor',
        is_active: true
      }
    ];

    // 4. Inicializar lançamentos históricos (para testar busca por categoria padrão)
    db.documents = [
      {
        id: 'doc_hist_1',
        user_id: 'mock-user-id',
        type: 'compra',
        contact_id: 'contact_fornecedor_conhecido',
        category_id: 'cat_embalagens',
        competence_date: '2026-05-01',
        total_amount: 100.00,
        description: 'Compra de caixas de papelão',
        created_at: '2026-05-01T12:00:00Z'
      }
    ];

    // 5. Inicializar títulos previstos (para testar conciliação de Pix QR Pix)
    db.documents.push({
      id: 'doc_previsto_pix',
      user_id: 'mock-user-id',
      type: 'venda',
      contact_id: 'contact_ml_mp',
      category_id: 'cat_venda_esp',
      competence_date: '2026-05-15',
      total_amount: 150.00,
      description: 'Venda de Balcão QR Pix [#REF_PIX_MATCH]',
      reference_id: 'REF_PIX_MATCH',
      source_type: 'Mercado Pago',
      created_at: '2026-05-15T12:00:00Z'
    });

    db.titles.push({
      id: 'title_previsto_pix',
      user_id: 'mock-user-id',
      document_id: 'doc_previsto_pix',
      side: 'receber',
      installment_num: 1,
      installment_total: 1,
      due_date: '2026-05-15',
      amount: 150.00,
      status: 'previsto'
    });
  });

  it('deve validar todos os cenários da classificação semântica, proteção global e fechamento do caixa', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));

    // 1. Criar o buffer de dados do extrato Mercado Pago/Mercado Livre
    // As colunas refletem um arquivo de extrato da conta
    const headers = ['release_date', 'transaction_type', 'reference_id', 'transaction_net_amount', 'partial_balance'];
    const rows = [
      // 1. Liberação de dinheiro (positive)
      ['2026-05-15', 'Liberação de dinheiro', 'REF_LIB', '99,32', '1099,32'],
      // 2. Pix positivo conciliado com título (positive)
      ['2026-05-15', 'Pagamento com Código QR Pix', 'REF_PIX_MATCH', '150,00', '1249,32'],
      // 3. Pix positivo sem conciliação (positive)
      ['2026-05-15', 'Pagamento com Código QR Pix', 'REF_PIX_UNMATCH', '200,00', '1449,32'],
      // 4. Pix enviado para pessoa física (negative)
      ['2026-05-15', 'Pix enviado Aurisneide Silva', 'REF_PIX_PF', '-115,00', '1334,32'],
      // 5. Pix enviado para empresa com fornecedor conhecido (negative)
      ['2026-05-15', 'Pix enviado Fornecedor Conhecido Ltda', 'REF_PIX_PJ_KNOWN', '-120,00', '1214,32'],
      // 6. Pix enviado para empresa com histórico/evidência de mercadoria (negative)
      ['2026-05-15', 'Pix enviado Dryz Comercio Importacao e Exportacao Ltda - estoque', 'REF_PIX_PJ_PROD', '-140,86', '1073.46'],
      // 7. Pix enviado para empresa sem histórico (negative)
      ['2026-05-15', 'Pix enviado Outra Empresa Ltda', 'REF_PIX_PJ_UNKNOWN', '-300,00', '773,46'],
      // 8. Pagamento de Cartão de Crédito (negative)
      ['2026-05-15', 'Pagamento Cartão de crédito', 'REF_CC', '-113,90', '659,56'],
      // 9. Débito por dinheiro retido / Retenção (negative)
      ['2026-05-15', 'Débito por dívida/dinheiro retido', 'REF_DEBT', '-3,53', '656,03'],
      // 10. Tarifa operacional clara (negative)
      ['2026-05-15', 'Tarifa operacional Mercado Pago', 'REF_TARIFF', '-15,00', '641,03']
    ];

    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ExtratoMP');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    // 2. Executar o processador da importação (processImportFile)
    const batch = await processImportFile(buffer, 'extrato_mp.xlsx', 'xlsx', 'Mercado Pago', 'bank');
    expect(batch.events).toHaveLength(10);

    // 3. Executar o motor de conciliação (conciliateBatch)
    const snapshotBefore = await supabaseFinanceService.getSnapshot();
    const conciliationResult = conciliateBatch(batch.events, snapshotBefore);
    const processedEvents = conciliationResult.events;

    // --- ASSERÇÕES DOS REQUISITOS ---

    // Requisito 1 & 9: Liberação de dinheiro positiva → recebido/venda (Venda de Produtos)
    const evLib = processedEvents.find(e => e.reference === 'REF_LIB')!;
    expect(evLib.detectedTypeLabel).toBe('Liberação de dinheiro');
    expect(evLib.suggestedCategoryName).toBe('Venda de Produtos');
    expect(evLib.classificationConfidence).toBe('alta');
    expect(evLib.classificationStatus).toBe('classified');

    // Requisito 9: Pix positivo conciliado com título → venda/categoria do título
    const evPixMatch = processedEvents.find(e => e.reference === 'REF_PIX_MATCH')!;
    expect(evPixMatch.reconciliationType).toBe('match');
    expect(evPixMatch.reconciliationId).toBe('title_previsto_pix');
    expect(evPixMatch.suggestedCategoryName).toBe('Vendas Especiais'); // Usou a categoria do título
    expect(evPixMatch.classificationConfidence).toBe('alta');
    expect(evPixMatch.classificationStatus).toBe('classified');

    // Requisito 9: Pix positivo sem conciliação → Recebimentos via Pix em revisão ou confiança média
    const evPixUnmatch = processedEvents.find(e => e.reference === 'REF_PIX_UNMATCH')!;
    expect(evPixUnmatch.reconciliationType).toBe('none');
    expect(evPixUnmatch.suggestedCategoryName).toBe('Recebimentos via Pix');
    expect(evPixUnmatch.classificationConfidence).toBe('media');
    expect(evPixUnmatch.classificationStatus).toBe('pending_review');
    expect(evPixUnmatch.status).toBe('pendente'); // Bloqueia auto-aprovação

    // Requisito 3 & 9: Pix enviado para pessoa física → Transferência / Retirada, sem DRE
    const evPixPF = processedEvents.find(e => e.reference === 'REF_PIX_PF')!;
    expect(evPixPF.suggestedCategoryName).toBe('Transferência / Retirada');
    expect(evPixPF.classificationConfidence).toBe('media');
    expect(evPixPF.classificationStatus).toBe('pending_review');

    // Requisito 2 & 9: Pix enviado para empresa com fornecedor conhecido → categoria padrão (Embalagens)
    const evPixKnown = processedEvents.find(e => e.reference === 'REF_PIX_PJ_KNOWN')!;
    expect(evPixKnown.suggestedCategoryName).toBe('Embalagens'); // Usou histórico de categoria
    expect(evPixKnown.classificationConfidence).toBe('alta');
    expect(evPixKnown.classificationStatus).toBe('classified');

    // Requisito 2 & 9: Pix enviado para empresa com histórico/descrição de produto → Compra de mercadoria
    const evPixProd = processedEvents.find(e => e.reference === 'REF_PIX_PJ_PROD')!;
    expect(evPixProd.suggestedCategoryName).toBe('Compra de mercadoria');
    expect(evPixProd.classificationConfidence).toBe('alta');
    expect(evPixProd.classificationStatus).toBe('classified');

    // Requisito 2 & 9: Pix enviado para empresa sem histórico → Pagamento de Fornecedor em revisão
    const evPixUnknown = processedEvents.find(e => e.reference === 'REF_PIX_PJ_UNKNOWN')!;
    expect(evPixUnknown.suggestedCategoryName).toBe('Pagamento de Fornecedor');
    expect(evPixUnknown.classificationConfidence).toBe('revisar');
    expect(evPixUnknown.classificationStatus).toBe('pending_review');

    // Requisito 4 & 9: Pagamento de Cartão de Crédito → Pagamento de Cartão de Crédito, sem DRE
    const evCC = processedEvents.find(e => e.reference === 'REF_CC')!;
    expect(evCC.suggestedCategoryName).toBe('Pagamento de Cartão de Crédito');
    expect(evCC.classificationConfidence).toBe('media');
    expect(evCC.classificationStatus).toBe('pending_review');

    // Requisito 5 & 9: Débito por dinheiro retido → Retenção/Ajuste, sem DRE
    const evDebt = processedEvents.find(e => e.reference === 'REF_DEBT')!;
    expect(evDebt.suggestedCategoryName).toBe('Retenção');
    expect(evDebt.classificationConfidence).toBe('media');
    expect(evDebt.classificationStatus).toBe('pending_review');

    // Requisito 6 & 9: Tarifa clara → Tarifa
    const evTariff = processedEvents.find(e => e.reference === 'REF_TARIFF')!;
    expect(evTariff.suggestedCategoryName).toBe('Tarifa');
    expect(evTariff.classificationConfidence).toBe('alta');
    expect(evTariff.classificationStatus).toBe('classified');

    // Requisito 1 & 9: Proteção global de receita em saída (saída negativa nunca pode virar "Venda de Produtos")
    // Simulando que por alguma regra modificada, tentamos forçar "Venda de Produtos" em uma saída negativa (ex: evTariff)
    const testOutflowEvent = {
      ...evTariff,
      id: 'test_outflow_protection_id',
      netAmount: -50.00,
      grossAmount: 0,
      feeAmount: -50.00,
      suggestedCategoryName: 'Venda de Produtos',
      categoryId: undefined,
      status: 'aprovado' as const
    };
    
    // 4. Aprovar todos os eventos para podermos persistir e verificar fechamento do caixa
    for (const ev of processedEvents) {
      ev.status = 'aprovado';
    }

    const eventsToPersist = [...processedEvents, testOutflowEvent];

    // 5. Persistir no banco de dados em-memória (persistApprovedEvents)
    // Isso vai rodar a lógica de criação das categorias on-demand e da proteção global
    const persistedCount = await persistApprovedEvents(eventsToPersist, 'Mercado Pago');
    expect(persistedCount).toBe(11); // 10 originais + 1 teste de proteção

    // 6. Consultar snapshot atualizado do banco de dados em-memória
    const snapshotAfter = await supabaseFinanceService.getSnapshot();

    // Requisito 8: Categorias criadas on-demand com tipos corretos
    const categoriesDB = snapshotAfter.categories;
    
    const catTransfer = categoriesDB.find(c => c.name === 'Transferência / Retirada')!;
    expect(catTransfer).toBeDefined();
    expect(catTransfer.type).toBe('financeiro');
    expect(catTransfer.dreClassification).toBe('outro');

    const catCard = categoriesDB.find(c => c.name === 'Pagamento de Cartão de Crédito')!;
    expect(catCard).toBeDefined();
    expect(catCard.type).toBe('financeiro');
    expect(catCard.dreClassification).toBe('outro');

    const catRetention = categoriesDB.find(c => c.name === 'Retenção')!;
    expect(catRetention).toBeDefined();
    expect(catRetention.type).toBe('financeiro');
    expect(catRetention.dreClassification).toBe('outro');

    const catSupplier = categoriesDB.find(c => c.name === 'Pagamento de Fornecedor')!;
    expect(catSupplier).toBeDefined();
    expect(catSupplier.type).toBe('custo');
    expect(catSupplier.dreClassification).toBe('custo_variavel');

    const catPurchase = categoriesDB.find(c => c.name === 'Compra de mercadoria')!;
    expect(catPurchase).toBeDefined();
    expect(catPurchase.type).toBe('custo');
    expect(catPurchase.dreClassification).toBe('custo_variavel');

    const catTariff = categoriesDB.find(c => c.name === 'Tarifa')!;
    expect(catTariff).toBeDefined();
    expect(catTariff.type).toBe('despesa');
    expect(catTariff.dreClassification).toBe('despesa_fixa');

    // Testar se o evento de proteção global foi salvo com categoria pendente e não de receita
    const persistedProtectedDoc = snapshotAfter.documents.find(d => d.description.includes('Tarifa operacional') && d.totalValue === 50.00);
    expect(persistedProtectedDoc).toBeDefined();
    const resolvedCat = categoriesDB.find(c => c.id === persistedProtectedDoc!.categoryId)!;
    expect(resolvedCat.name).toBe('Movimentação Pendente de Classificação'); // Proteção global funcionou!
    expect(resolvedCat.type).not.toBe('receita');

    // Requisito 9: Fechamento do caixa: Saldo inicial + Créditos - Débitos = Saldo final
    // Para as movimentações reais no período:
    const balances = calculateStatementBalances(
      snapshotAfter.movements,
      snapshotAfter.accounts,
      'current_month',
      'all'
    );

    // Saldo inicial = 1000.00
    // Créditos (inflows) = 99.32 (liberação) + 150.00 (pix match) + 200.00 (pix unmatch) = 449.32
    // Débitos (outflows) = 115.00 (pix pf) + 120.00 (pix known) + 140.86 (pix prod) + 300.00 (pix unknown) + 113.90 (cc) + 3.53 (debt) + 15.00 (tariff) + 50.00 (protection event) = 858.29
    // Saldo final = 1000.00 + 449.32 - 858.29 = 591.03
    expect(balances.previousBalance).toBeCloseTo(1000.00, 2);
    expect(balances.inflows).toBeCloseTo(449.32, 2);
    expect(balances.outflows).toBeCloseTo(858.29, 2);
    expect(balances.finalBalance).toBeCloseTo(591.03, 2);

    // Saldo inicial + Créditos - Débitos = Saldo final
    expect(balances.previousBalance + balances.inflows - balances.outflows).toBeCloseTo(balances.finalBalance, 2);
  });
});
