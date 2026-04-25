import { ImportEvent, ImportSource } from '@/types/import';
import { supabaseFinanceService } from './finance/supabaseFinanceService';
import { CreateDocumentPayload } from './finance/financeService';
import { settlementDaysBySource } from '@/config/settlementDays';

export async function persistApprovedEvents(events: ImportEvent[], source: ImportSource) {
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

  // 3. Garantir Categoria Padrão
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

  // 4. Iterar sobre eventos e salvar sequencialmente
  let persistCount = 0;
  for (const event of events) {
    if (event.status !== 'aprovado') continue;

    try {
       // --- CASO 1: CONCILIAÇÃO (Vínculo com Título Existente) ---
       if (event.reconciliationId && event.reconciliationType === 'match') {
          await supabaseFinanceService.settleTitle(
             event.reconciliationId,
             defaultAccount.id,
             event.date.split('T')[0],
             Math.abs(event.netAmount),
             `Conciliado automaticamente via importação (${source})`
          );
          persistCount++;
          continue; // Pula para o próximo evento
       }

       // --- CASO 2: CRIAÇÃO DE NOVO LANÇAMENTO (Avulso ou Venda) ---
       const competence = event.date.split('T')[0]; // YYYY-MM-DD
       
       // Determinar vencimento baseado em settlement days (apenas para vendas futuras)
       const days = settlementDaysBySource[source] ?? settlementDaysBySource.default;
       const dDate = new Date(event.date);
       dDate.setDate(dDate.getDate() + days);
       const dueDate = dDate.toISOString().split('T')[0];

       // Regra de Ouro: Tipos "Liquidados" nascem pagos e sem data futura
       const isLiquidation = ['repasse', 'liberacao', 'transferencia', 'deposito', 'antecipacao'].includes(event.primaryType);
       const payNow = event.historical || isLiquidation;
       const finalDueDate = payNow ? competence : dueDate;

       const isDespesa = event.netAmount < 0;
       
       // Adicionar flag de entrada avulsa na descrição/notas se for liquidado mas não conciliado
       const unmatchedFlag = (isLiquidation && event.reconciliationType === 'none') ? ' [Entrada Avulsa]' : '';
       
       // Normalização da Descrição com ID [#REF]
       const refPart = event.reference ? `[#${event.reference}] ` : '';
       const cleanTitle = (event.reference && event.title.includes(event.reference))
         ? event.title.replace(`#${event.reference}`, '').replace('Venda ', 'Venda').trim()
         : event.title;
       
       const description = `${refPart}${cleanTitle}${unmatchedFlag}`.trim();

       const payload: CreateDocumentPayload = {
         type: isDespesa ? 'despesa' : 'venda',
         contactId: contact.id,
         categoryId: event.categoryId || category.id,
         competenceDate: competence,
         firstDueDate: finalDueDate,
         totalValue: Math.abs(event.netAmount),
         grossAmount: Math.abs(event.grossAmount),
         marketplaceFee: Math.abs(event.feeAmount),
         shippingCost: Math.abs(event.freightAmount),
         description,
         condition: 'avista',
         installments: 1
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
