import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as XLSX from 'xlsx';
import { processImportFile } from '@/services/importEngine';
import { conciliateBatch } from '@/services/conciliationService';
import { persistApprovedEvents } from '@/services/importPersister';
import { supabaseFinanceService } from '@/services/finance/supabaseFinanceService';
import { groupMovementsIntoEvents, calculateStatementBalances } from '@/domain/extract';

// Configurando mock em-memória para simular o banco PostgreSQL do Supabase
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

describe('Validação End-to-End da Importação e Liquidação', () => {
  beforeAll(() => {
    // Inicializar dados iniciais (Seed)
    db.accounts = [{
      id: 'acc_principal',
      user_id: 'mock-user-id',
      name: 'Banco Principal',
      initial_balance: 1000.00,
      opening_balance: 1000.00,
      opening_balance_date: '2026-05-01',
      institution: 'Itaú',
      is_active: true
    }];

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
        id: 'cat_pending',
        user_id: 'mock-user-id',
        name: 'Movimentação Pendente de Classificação',
        kind: 'financeiro',
        dre_classification: 'outro',
        is_active: true
      }
    ];

    db.contacts = [];
    db.documents = [];
    db.titles = [];
    db.movements = [];

    // --- CASO 1: CONCILIAÇÃO (Título previsto pré-existente para Produto A) ---
    // Criamos um lançamento de venda previsto para o Produto A de valor R$ 99,32
    // A referência deve bater com "1000001" do pedido
    db.documents.push({
      id: 'doc_previsto_a',
      user_id: 'mock-user-id',
      type: 'venda',
      contact_id: 'contact_ml',
      category_id: 'cat_venda',
      competence_date: '2026-05-15',
      total_amount: 99.32,
      description: 'Venda Mercado Livre #1000001',
      gross_amount: 99.32,
      marketplace_fee: 0,
      shipping_cost: 0,
      reference_id: '1000001',
      source_type: 'Mercado Livre',
      created_at: '2026-05-15T12:00:00Z'
    });

    db.titles.push({
      id: 'title_previsto_a',
      user_id: 'mock-user-id',
      document_id: 'doc_previsto_a',
      side: 'receber',
      installment_num: 1,
      installment_total: 1,
      due_date: '2026-05-25',
      amount: 99.32,
      status: 'previsto'
    });
  });

  it('deve rodar o fluxo completo de ponta a ponta sem falhas e com integridade de dados', async () => {
    // 1. Criar o buffer de dados simulando a planilha de vendas do Mercado Livre
    const headers = ['N.º de venda', 'Data da venda', 'Título do anuncio', 'Total (BRL)', 'Estado da venda', 'Liberação do dinheiro'];
    const rows = [
      ['1000001', '15/05/2026', 'Produto A', '99,32', 'Liberado', '15/05/2026'], // Liquidado -> deve conciliar
      ['1000002', '15/05/2026', 'Produto B', '185,47', 'Liberado', '15/05/2026'], // Liquidado -> novo e liquidado
      ['1000003', '15/05/2026', 'Produto C', '185,47', 'Pendente', '25/05/2026'], // Previsto -> novo e previsto (venc. futuro)
      ['1000004', '15/05/2026', 'Produto D', '185,47', 'Em revisão', '25/05/2026'], // Em revisão -> status review
    ];

    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'VendasML');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    // 2. Passo 1: Executar o processador da importação (processImportFile)
    const batch = await processImportFile(buffer, 'vendas_ml.xlsx', 'xlsx', 'Mercado Livre', 'sales');
    
    expect(batch.events).toHaveLength(4);

    // Validando a detecção das colunas
    const evA = batch.events.find(e => e.title === 'Produto A')!;
    const evB = batch.events.find(e => e.title === 'Produto B')!;
    const evC = batch.events.find(e => e.title === 'Produto C')!;
    const evD = batch.events.find(e => e.title === 'Produto D')!;

    // Conferir se o external_order_id (reference) foi preservado
    expect(evA.reference).toBe('1000001');
    expect(evB.reference).toBe('1000002');
    expect(evC.reference).toBe('1000003');
    expect(evD.reference).toBe('1000004');

    // 3. Passo 2: Executar o motor de conciliação (conciliateBatch)
    const snapshotBefore = await supabaseFinanceService.getSnapshot();
    const conciliationResult = conciliateBatch(batch.events, snapshotBefore);

    const cEvA = conciliationResult.events.find(e => e.title === 'Produto A')!;
    const cEvB = conciliationResult.events.find(e => e.title === 'Produto B')!;
    const cEvC = conciliationResult.events.find(e => e.title === 'Produto C')!;
    const cEvD = conciliationResult.events.find(e => e.title === 'Produto D')!;

    // Verificação da conciliação do Produto A
    expect(cEvA.reconciliationType).toBe('match');
    expect(cEvA.reconciliationId).toBe('title_previsto_a');
    expect(cEvA.matchConfidence).toBe('strong');
    expect(cEvA.settlementStatus).toBe('settled');

    // Verificação de Produto B e C (não conciliados)
    expect(cEvB.reconciliationType).toBe('none');
    expect(cEvB.settlementStatus).toBe('settled');

    expect(cEvC.reconciliationType).toBe('none');
    expect(cEvC.settlementStatus).toBe('predicted');

    // Verificação do Produto D (Em revisão)
    expect(cEvD.reconciliationType).toBe('none');
    expect(cEvD.settlementStatus).toBe('review');
    
    // 4. Passo 3: Simular aprovação dos eventos autorizados (A, B, C)
    // Deixaremos Produto D como 'pendente' (ou seja, não aprovado) para simular
    // a retenção de itens bloqueados no Import Review.
    cEvA.status = 'aprovado';
    cEvB.status = 'aprovado';
    cEvC.status = 'aprovado';
    cEvD.status = 'pendente'; // Fica aguardando revisão manual

    // 5. Passo 4: Persistir os eventos aprovados (persistApprovedEvents)
    const persistedCount = await persistApprovedEvents(
      [cEvA, cEvB, cEvC, cEvD],
      'Mercado Livre',
      batch.batchId
    );

    // Apenas os 3 aprovados devem ser persistidos
    expect(persistedCount).toBe(3);

    // 6. Passo 5: Consultar o Snapshot atualizado e validar a integridade
    const snapshotAfter = await supabaseFinanceService.getSnapshot();

    // --- ANÁLISE DOS RESULTADOS E NÃO-DUPLICIDADE ---

    // A. Produto A: Reconciliado com título pré-existente
    // - O título original 'title_previsto_a' deve estar com status 'recebido'
    // - NÃO devem ser criados novos documentos ou títulos para o Produto A
    const titleA = snapshotAfter.titles.find(t => t.id === 'title_previsto_a')!;
    expect(titleA.status).toBe('recebido');

    const totalDocsForA = snapshotAfter.documents.filter(d => d.referenceId === '1000001');
    expect(totalDocsForA).toHaveLength(1); // Somente o pré-existente

    // B. Produto B: Liquidado criado como Recebido
    // - Novo documento criado
    // - Novo título criado com status 'recebido'
    // - Movimento de caixa correspondente criado
    const docB = snapshotAfter.documents.find(d => d.referenceId === '1000002')!;
    expect(docB).toBeDefined();
    
    const titleB = snapshotAfter.titles.find(t => t.documentId === docB.id)!;
    expect(titleB.status).toBe('recebido');

    const movementB = snapshotAfter.movements.find(m => m.titleId === titleB.id)!;
    expect(movementB).toBeDefined();
    expect(movementB.valuePaid).toBe(185.47);

    // C. Produto C: Previsto (Data Futura)
    // - Novo documento criado
    // - Novo título criado com status 'previsto'
    // - NENHUM movimento de caixa criado
    const docC = snapshotAfter.documents.find(d => d.referenceId === '1000003')!;
    expect(docC).toBeDefined();

    const titleC = snapshotAfter.titles.find(t => t.documentId === docC.id)!;
    expect(titleC.status).toBe('previsto');

    const movementC = snapshotAfter.movements.find(m => m.titleId === titleC.id);
    expect(movementC).toBeUndefined(); // Sem movimento de caixa imediato!

    // D. Produto D: Em revisão e Não aprovado
    // - NENHUM documento ou título criado
    const docD = snapshotAfter.documents.find(d => d.referenceId === '1000004');
    expect(docD).toBeUndefined(); // Não contaminou o banco de dados!

    // --- VALIDAÇÃO DO EXTRATO E CONCILIAÇÃO FINANCEIRA (ExtractSummary) ---
    // 1. Filtrar as movimentações no período de maio de 2026
    const movementsInPeriod = snapshotAfter.movements.filter(m => m.paymentDate.startsWith('2026-05'));
    
    // As movimentações criadas devem ser:
    // - Produto A (baixado em 2026-05-15): R$ 99,32 (recebimento)
    // - Produto B (baixado em 2026-05-15): R$ 185,47 (recebimento)
    expect(movementsInPeriod).toHaveLength(2);

    // 2. Agrupar movimentações no extrato inteligente
    const extractEvents = groupMovementsIntoEvents(
      movementsInPeriod,
      snapshotAfter.titles,
      snapshotAfter.documents,
      snapshotAfter.categories,
      snapshotAfter.contacts,
      'all'
    );

    expect(extractEvents).toHaveLength(2); // Produto A e Produto B geram eventos no extrato

    // 3. Verificar o fechamento do extrato
    const balances = calculateStatementBalances(
      snapshotAfter.movements,
      snapshotAfter.accounts,
      'current_month',
      'all'
    );

    // Saldo anterior = Saldo inicial da conta = R$ 1.000,00
    // Entradas = R$ 99,32 (Produto A) + R$ 185,47 (Produto B) = R$ 284,79
    // Saídas = R$ 0,00
    // Saldo final = R$ 1.000,00 + R$ 284,79 - R$ 0,00 = R$ 1.284,79
    expect(balances.previousBalance).toBeCloseTo(1000.00, 2);
    expect(balances.inflows).toBeCloseTo(284.79, 2);
    expect(balances.outflows).toBeCloseTo(0.00, 2);
    expect(balances.finalBalance).toBeCloseTo(1284.79, 2);

    // A equação fundamental do fechamento do caixa deve ser verdadeira:
    // Saldo Anterior + Entradas - Saídas = Saldo Final
    const equationSatisfied = (balances.previousBalance + balances.inflows - balances.outflows) === balances.finalBalance;
    expect(equationSatisfied).toBe(true);

    console.log('--- CONCILIAÇÃO DO EXTRATO ---');
    console.log(`Saldo Anterior: R$ ${balances.previousBalance}`);
    console.log(`Entradas (Inflows): R$ ${balances.inflows}`);
    console.log(`Saídas (Outflows): R$ ${balances.outflows}`);
    console.log(`Saldo Final: R$ ${balances.finalBalance}`);
    console.log(`Equação de Caixa Fechada? ${equationSatisfied ? 'SIM ✅' : 'NÃO ❌'}`);
  });
});
