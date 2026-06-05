import { ImportEvent, ImportSource } from '@/types/import';
import { supabaseFinanceService } from './finance/supabaseFinanceService';
import { CreateDocumentPayload } from './finance/financeService';
import { settlementDaysBySource } from '@/config/settlementDays';

const PENDING_CATEGORY_NAME = 'Movimentação Pendente de Classificação';

const toISODate = (value?: string) => value ? value.split('T')[0] : undefined;

const resolveCompetenceDate = (event: ImportEvent) =>
  toISODate(event.competenceDate) ||
  toISODate(event.eventDate) ||
  toISODate(event.date) ||
  new Date().toISOString().split('T')[0];

const resolvePaymentDate = (event: ImportEvent) =>
  toISODate(event.paymentDate) ||
  toISODate(event.settlementDate) ||
  toISODate(event.eventDate) ||
  toISODate(event.date) ||
  new Date().toISOString().split('T')[0];

const resolveDueDate = (event: ImportEvent, source: ImportSource) => {
  const explicitDueDate = toISODate(event.dueDate);
  if (explicitDueDate) return explicitDueDate;

  const settlementDate = toISODate(event.settlementDate);
  if (settlementDate) return settlementDate;

  const baseDate = toISODate(event.eventDate) || toISODate(event.date) || new Date().toISOString().split('T')[0];
  const days = settlementDaysBySource[source] ?? settlementDaysBySource.default;
  const dDate = new Date(baseDate + 'T12:00:00');
  dDate.setDate(dDate.getDate() + days);
  return dDate.toISOString().split('T')[0];
};

export async function persistApprovedEvents(events: ImportEvent[], source: ImportSource, batchId?: string) {
  // 1. Pegar a Conta Padrão (primeira ativa)
  const snapshot = await supabaseFinanceService.getSnapshot();
  const defaultAccount = snapshot.accounts.find(a => a.isActive);
  
  if (!defaultAccount) {
    throw new Error("Crie pelo menos uma Conta Bancária no menu Cadastros antes de importar.");
  }

  // 2. Garantir ou Buscar Contato Padrão para essa Fonte
  let contact = snapshot.contacts.find(c => c.name === source);
  if (!contact) {
    contact = await supabaseFinanceService.createContact({
      name: source,
      type: 'ambos',
      notes: 'Criado automaticamente pela importação'
    });
  }

  // 3. Garantir Categoria Padrão para Vendas
  let category = snapshot.categories.find(c => c.name === 'Venda de Produtos' || c.name === 'Serviços');
  if (!category) {
    category = snapshot.categories.find(c => c.type === 'receita');
  }
  if (!category) {
     category = await supabaseFinanceService.createCategory({
        name: 'Receitas Gerais',
        type: 'receita',
        dreClassification: 'receita_bruta'
     });
  }

  // 4. Garantir Categoria Especial para Movimentações Pendentes de Classificação
  let pendingCategory = snapshot.categories.find(c => c.name === PENDING_CATEGORY_NAME);
  if (!pendingCategory) {
    pendingCategory = await supabaseFinanceService.createCategory({
      name: PENDING_CATEGORY_NAME,
      type: 'financeiro',
      dreClassification: 'outro'
    });
  }

  // 5. Iterar sobre eventos e salvar sequencialmente
  let persistCount = 0;
  for (const event of events) {
    if (event.status !== 'aprovado') continue;

    try {
       // --- CASO 1: CONCILIAÇÃO (Vínculo com Título Existente) ---
       if (event.reconciliationId && event.reconciliationType === 'match') {
          // Verify if the title is already received/settled
          const existingTitle = snapshot.titles.find(t => t.id === event.reconciliationId);
          const alreadySettled = existingTitle && ['recebido', 'liquidado', 'quitado'].includes(existingTitle.status);
          if (alreadySettled) {
            // Mark as duplicate for UI warning, do not settle again
            event.reconciliationType = 'duplicate';
            if (!event.flags) event.flags = [];
            if (!event.flags.includes('duplicate')) event.flags.push('duplicate');
            // Optionally set a note
            event.explanation = (event.explanation || '') + ' | Aviso: título já recebido.';
            persistCount++;
            continue; // Skip creating new document or settling
          }

          if (event.settlementStatus === 'settled') {
             const paymentDate = resolvePaymentDate(event);
             await supabaseFinanceService.settleTitle(
                event.reconciliationId,
                defaultAccount.id,
                paymentDate,
                Math.abs(event.netAmount),
                `Conciliado automaticamente via importação (${source})${event.matchConfidence ? ` [Match: ${event.matchConfidence}]` : ''}`
             );
          }
          // Se for 'predicted', apenas ignoramos para não duplicar (mantém previsto)
          // Se for 'review', também não baixamos automaticamente até ação manual.
          persistCount++;
          continue; // Pula para o próximo evento — NÃO cria novo documento
       }

       // --- CASO 2: CRIAÇÃO DE NOVO LANÇAMENTO (Avulso ou Venda) ---
       const competence = resolveCompetenceDate(event);
       const paymentDate = resolvePaymentDate(event);
       const dueDate = resolveDueDate(event, source);

       // Regra de Ouro: Tipos "Liquidados" nascem pagos e sem data futura
       const isLiquidation = ['repasse', 'liberacao', 'transferencia', 'deposito', 'antecipacao', 'entrada_liquidada'].includes(event.primaryType);
       let payNow = event.historical || isLiquidation || event.settlementStatus === 'settled';
       if (event.settlementStatus === 'review' && event.mode !== 'bank') {
          payNow = false;
       }
       const finalDueDate = payNow ? paymentDate : dueDate;

       const isDespesa = event.netAmount < 0;
       
       // Determinar se é pendente de classificação
       const isPendingClassification = event.classificationStatus === 'pending_review' || event.primaryType === 'pendente_classificacao';
       
       // Adicionar flag de entrada avulsa na descrição/notas se for liquidado mas não conciliado
       const unmatchedFlag = (isLiquidation && event.reconciliationType === 'none') ? ' [Entrada Avulsa]' : '';
       const pendingFlag = isPendingClassification ? '[⏳ Pendente de Classificação] ' : '';
       
       // Normalização da Descrição com ID [#REF]
       const refPart = event.reference ? `[#${event.reference}] ` : '';
       const cleanTitle = (event.reference && event.title.includes(event.reference))
         ? event.title.replace(`#${event.reference}`, '').replace('Venda ', 'Venda').trim()
         : event.title;
       
       const description = `${pendingFlag}${refPart}${cleanTitle}${unmatchedFlag}`.trim();

        // Escolher ou criar a categoria sugerida on-demand
        let resolvedCategoryId = event.categoryId;

        if (event.suggestedCategoryName) {
          let existingCat = snapshot.categories.find(c => c.name.toLowerCase() === event.suggestedCategoryName!.toLowerCase());
          if (!existingCat) {
            const CATEGORY_DEFS: Record<string, { type: 'receita' | 'despesa' | 'custo' | 'financeiro'; dreClassification: string }> = {
              'Venda de Produtos': { type: 'receita', dreClassification: 'receita_bruta' },
              'Recebimentos via Pix': { type: 'receita', dreClassification: 'receita_bruta' },
              'Transferência / Retirada': { type: 'financeiro', dreClassification: 'outro' },
              'Pagamento de Cartão de Crédito': { type: 'financeiro', dreClassification: 'outro' },
              'Ajuste Mercado Pago': { type: 'financeiro', dreClassification: 'outro' },
              'Retenção': { type: 'financeiro', dreClassification: 'outro' },
              'Pagamento de Fornecedor': { type: 'custo', dreClassification: 'custo_variavel' },
              'Compra de mercadoria': { type: 'custo', dreClassification: 'custo_variavel' },
              'Tarifa': { type: 'despesa', dreClassification: 'despesa_fixa' }
            };

            const def = CATEGORY_DEFS[event.suggestedCategoryName] || { type: 'financeiro', dreClassification: 'outro' };
            existingCat = await supabaseFinanceService.createCategory({
              name: event.suggestedCategoryName,
              type: def.type,
              dreClassification: def.dreClassification as any,
              isActive: true
            });
            snapshot.categories.push(existingCat);
          }
          resolvedCategoryId = existingCat.id;
        }

        // Escolher categoria: se pendente de classificação e não tem categoria sugerida resolvida, usar categoria especial
        let finalCategoryId = (isPendingClassification && (!resolvedCategoryId || resolvedCategoryId === pendingCategory.id))
          ? pendingCategory.id 
          : (resolvedCategoryId || category.id);

        // Proteção Global de Receita em Saída
        if (event.netAmount < 0) {
          let currentCat = snapshot.categories.find(c => c.id === finalCategoryId);
          if (!currentCat) currentCat = category;
          
          if (currentCat.type === 'receita' || currentCat.dreClassification === 'receita_bruta') {
            finalCategoryId = pendingCategory.id;
          }
        }

        const effectiveCategoryId = finalCategoryId;

       // Evitar falsas vendas no modo bank, registrando apenas como receita para entradas líquidas
       const docType = isPendingClassification 
         ? (isDespesa ? 'despesa' : 'receita')
         : (event.primaryType === 'entrada_liquidada' && !isDespesa) ? 'receita' : (isDespesa ? 'despesa' : 'venda');

       const payload: CreateDocumentPayload = {
         type: docType,
         contactId: contact.id,
         categoryId: effectiveCategoryId,
         competenceDate: competence,
         firstDueDate: finalDueDate,
         paymentDate: payNow ? paymentDate : undefined,
         totalValue: Math.abs(event.netAmount),
         // Garante que o valor bruto seja o próprio netAmount para entradas líquidas, anulando possíveis taxas mal interpretadas
         grossAmount: event.primaryType === 'entrada_liquidada' ? Math.abs(event.netAmount) : Math.abs(event.grossAmount),
         marketplaceFee: event.primaryType === 'entrada_liquidada' ? 0 : Math.abs(event.feeAmount),
         shippingCost: Math.abs(event.freightAmount),
         description,
         condition: 'avista',
         installments: 1,
         referenceId: event.reference,
         sourceType: source,
         importBatchId: batchId
       };

       // Se payNow estiver ativo, criar documento já baixado na conta padrão
       await supabaseFinanceService.createDocument(payload, payNow, defaultAccount.id);
       
       persistCount++;
    } catch (err) {
       console.error(`Erro ao importar evento ${event.title}`, err);
       throw err; 
    }
  }

  return persistCount;
}
