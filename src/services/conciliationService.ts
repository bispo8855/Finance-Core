/**
 * ConciliationService — Camada de conciliação inteligente
 * 
 * Responsável por encontrar correspondências entre eventos importados
 * e títulos financeiros existentes antes de criar novos documentos.
 * 
 * Hierarquia de Match:
 * 1. STRONG — reference_id + source_type (mesmo pedido/origem)
 * 2. MEDIUM — valor + contato (mesmo marketplace) + status previsto + margem de data
 * 3. WEAK — valor próximo (±5%) + data próxima (±7 dias) — nunca auto-aprova
 */

import { ImportEvent, ImportSource, MatchConfidence } from '@/types/import';
import { FinanceSnapshot } from '@/services/finance/financeService';
import { Title, FinancialDocument } from '@/types/financial';

export interface ConciliationResult {
  matchConfidence: MatchConfidence;
  titleId?: string;
  explanation: string;
  candidates: {
    id: string;
    description: string;
    value: number;
    date: string;
  }[];
}

/**
 * Tipos de evento que devem tentar conciliação (representam recebimentos/liquidações)
 */
const LIQUIDATION_TYPES = [
  'repasse', 'liberacao', 'transferencia', 'deposito',
  'antecipacao', 'entrada_liquidada'
] as const;

/**
 * Determina se um evento deve passar pelo motor de conciliação
 */
function shouldAttemptConciliation(event: ImportEvent): boolean {
  // Modo banco: tudo tenta conciliar
  if (event.mode === 'bank') return true;
  // Modo vendas: apenas liquidações ou eventos liquidados (recebimentos imediatos)
  if (event.mode === 'sales') {
    if (event.settlementStatus === 'settled') return true;
    return LIQUIDATION_TYPES.includes(event.primaryType as typeof LIQUIDATION_TYPES[number]);
  }
  // Modo genérico: não concilia automaticamente
  return false;
}

/**
 * Executa conciliação hierárquica para um único evento
 */
export function conciliateEvent(
  event: ImportEvent,
  snapshot: FinanceSnapshot
): ConciliationResult {
  const defaultResult: ConciliationResult = {
    matchConfidence: 'none',
    explanation: '',
    candidates: []
  };

  if (!shouldAttemptConciliation(event)) {
    return defaultResult;
  }

  // Filtrar títulos pendentes (previstos, atrasado, vencido) sem títulos renegociados
  const pendingTitles = snapshot.titles.filter(t => {
    const eligibleStatus = ['previsto', 'atrasado', 'vencido'];
    const notRenegotiated = t.status !== 'renegociado';
    return eligibleStatus.includes(t.status) && notRenegotiated;
  });
  if (pendingTitles.length === 0) {
    return {
      ...defaultResult,
      explanation: 'Nenhum título elegível encontrado no sistema.'
    };
  }

  // === NÍVEL 1: STRONG MATCH (reference_id + source) ===
  if (event.reference && event.reference.length > 0) {
    const strongResult = findStrongMatch(event, pendingTitles, snapshot);
    if (strongResult.matchConfidence === 'strong') {
      return strongResult;
    }
    // Se tem referência mas não encontrou match forte, registrar para contexto
    if (strongResult.explanation) {
      defaultResult.explanation = strongResult.explanation;
    }
  }

  // === NÍVEL 2: MEDIUM MATCH (valor + contato + data) ===
  const mediumResult = findMediumMatch(event, pendingTitles, snapshot);
  if (mediumResult.matchConfidence === 'medium') {
    return mediumResult;
  }

  // === NÍVEL 3: WEAK MATCH (valor próximo + data próxima) ===
  const weakResult = findWeakMatch(event, pendingTitles, snapshot);
  if (weakResult.matchConfidence === 'weak') {
    return weakResult;
  }

  // === SEM MATCH ===
  // Reunir candidatos amplos para revisão visual
  const broadCandidates = findBroadCandidates(event, pendingTitles, snapshot);

  return {
    matchConfidence: 'none',
    explanation: defaultResult.explanation || 'Nenhuma correspondência encontrada.',
    candidates: broadCandidates
  };
}

/**
 * Aplica conciliação em lote para todos os eventos de um batch
 */
export function conciliateBatch(
  events: ImportEvent[],
  snapshot: FinanceSnapshot
): { events: ImportEvent[]; stats: ConciliationStats } {
  const stats: ConciliationStats = {
    strong: 0,
    medium: 0,
    weak: 0,
    none: 0,
    pendingClassification: 0,
    duplicates: 0
  };

  // Set para controlar quais títulos já foram matched (evitar double-match)
  const matchedTitleIds = new Set<string>();

  // Detectar duplicidades por descrição existente
  const existingDescriptions = new Set(snapshot.documents.map(d => d.description));

  const updatedEvents = events.map(event => {
    const updated = { ...event };

    // A. Verificação de Duplicidade (Cross-Reference)
    if (existingDescriptions.has(event.title)) {
      updated.flags = [...(updated.flags || []), 'duplicate'];
      updated.status = 'pendente';
      updated.confidence = 'revisar';
      stats.duplicates++;
    }

    // B. Classificação pendente
    if (updated.classificationStatus === 'pending_review') {
      stats.pendingClassification++;
    }

    // C. Conciliação
    const result = conciliateEvent(updated, snapshot);

    // Não reusar um título já matched neste mesmo batch
    if (result.titleId && matchedTitleIds.has(result.titleId)) {
      // Conflito: outro evento neste batch já tomou esse título
      updated.reconciliationType = 'multiple';
      updated.confidence = 'revisar';
      updated.matchConfidence = 'none';
      updated.explanation = (updated.explanation || '') + ' | ⚠️ Conflito: outro evento neste lote já vinculou-se a este título.';
      stats.none++;
    } else {
      updated.matchConfidence = result.matchConfidence;
      updated.reconciliationCandidates = result.candidates;

      switch (result.matchConfidence) {
        case 'strong':
          updated.reconciliationId = result.titleId;
          updated.reconciliationType = 'match';
          updated.confidence = 'alta';
          updated.explanation = (updated.explanation || '') + ` | ✨ ${result.explanation}`;
          if (result.titleId) matchedTitleIds.add(result.titleId);
          stats.strong++;
          break;

        case 'medium':
          updated.reconciliationId = result.titleId;
          updated.reconciliationType = 'match';
          updated.confidence = 'media';
          updated.explanation = (updated.explanation || '') + ` | 🔍 ${result.explanation}`;
          if (result.titleId) matchedTitleIds.add(result.titleId);
          stats.medium++;
          break;

        case 'weak':
          updated.reconciliationType = 'divergence';
          updated.confidence = 'revisar';
          updated.explanation = (updated.explanation || '') + ` | ⚠️ ${result.explanation}`;
          stats.weak++;
          break;

        default:
          updated.reconciliationType = 'none';
          updated.explanation = (updated.explanation || '') + (result.explanation ? ` | ${result.explanation}` : '');

          // Lógica especial para entradas liquidadas sem match
          if (['entrada_liquidada', 'deposito', 'transferencia'].includes(updated.primaryType)) {
            if (updated.reference) {
              updated.confidence = 'revisar';
              updated.explanation = (updated.explanation || '') + ' | ⚠️ Referência encontrada, mas nenhuma venda correspondente localizada.';
            } else {
              const eventValue = Math.abs(updated.netAmount);
              const recurrentCount = events.filter(e => Math.abs(Math.abs(e.netAmount) - eventValue) < 0.01).length;

              if (recurrentCount > 1) {
                updated.confidence = 'alta';
                updated.status = 'aprovado';
                updated.explanation = (updated.explanation || '') + ' | ℹ️ Entrada avulsa recorrente. Auto-aprovado.';
              } else if (eventValue < 100) {
                updated.confidence = 'alta';
                updated.status = 'aprovado';
                updated.explanation = (updated.explanation || '') + ' | ℹ️ Entrada avulsa < R$100. Auto-aprovado.';
              } else {
                updated.confidence = 'revisar';
                updated.explanation = (updated.explanation || '') + ' | ℹ️ Entrada avulsa >= R$100. Requer revisão.';
              }
            }
          }
          stats.none++;
          break;
      }
    }

    // D. Refinamento da Classificação Semântica com base no snapshot do Banco/Contatos/Histórico
    const initialPending = updated.classificationStatus === 'pending_review';

    if (updated.suggestedCategoryName === 'Recebimentos via Pix' || updated.detectedTypeLabel === 'Pagamento com Código QR Pix') {
      if (updated.reconciliationId && updated.reconciliationType === 'match') {
        const matchedTitle = snapshot.titles.find(t => t.id === updated.reconciliationId);
        const matchedDoc = matchedTitle ? snapshot.documents.find(d => d.id === matchedTitle.documentId) : null;
        const matchedCategory = matchedDoc ? snapshot.categories.find(c => c.id === matchedDoc.categoryId) : null;
        
        if (matchedCategory) {
          updated.suggestedCategoryName = matchedCategory.name;
          updated.categoryId = matchedCategory.id;
        } else {
          updated.suggestedCategoryName = 'Venda de Produtos';
        }
        updated.classificationConfidence = 'alta';
        updated.classificationStatus = 'classified';
        updated.classificationReason = `Conciliado com o título previsto: ${matchedTitle?.description || matchedDoc?.description || 'Título'}`;
        updated.suggestedAction = 'Nenhuma ação necessária.';
      } else {
        updated.suggestedCategoryName = 'Recebimentos via Pix';
        updated.classificationConfidence = 'media';
        updated.classificationStatus = 'pending_review';
        updated.classificationReason = 'Recebimento Pix sem título previsto correspondente no sistema.';
        updated.suggestedAction = 'Aguardando conciliação comercial ou revisão.';
      }
    } else if (updated.title?.toLowerCase().includes('pix enviado') || updated.detectedTypeLabel?.includes('Pix enviado')) {
      let recipient = (updated.title || '').replace(/pix enviado/i, '').trim();
      recipient = recipient.replace(/\b\d{2,3}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '').replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '').replace(/^\d+\s+/, '').trim();

      const matchedContact = snapshot.contacts.find(c => {
        const cName = c.name.toLowerCase();
        const rName = recipient.toLowerCase();
        return cName.includes(rName) || rName.includes(cName);
      });

      if (matchedContact) {
        const contactDocs = snapshot.documents.filter(d => d.contactId === matchedContact.id);
        const lastDoc = contactDocs.length > 0 ? contactDocs[contactDocs.length - 1] : null;
        const lastCategory = lastDoc ? snapshot.categories.find(c => c.id === lastDoc.categoryId) : null;

        if (lastCategory) {
          if (lastCategory.type !== 'receita' && lastCategory.dreClassification !== 'receita_bruta') {
            updated.suggestedCategoryName = lastCategory.name;
            updated.categoryId = lastCategory.id;
            updated.classificationConfidence = 'alta';
            updated.classificationStatus = 'classified';
            updated.classificationReason = `Categoria identificada via histórico do contato: ${matchedContact.name}`;
            updated.suggestedAction = `Registrar como ${lastCategory.name}.`;
          } else {
            updated.suggestedCategoryName = 'Pagamento de Fornecedor';
            updated.classificationConfidence = 'revisar';
            updated.classificationStatus = 'pending_review';
            updated.classificationReason = `Contato ${matchedContact.name} encontrado, mas sua última categoria era de receita (Proteção de Receita).`;
            updated.suggestedAction = 'Revisar pagamento de fornecedor.';
          }
        } else {
          if (matchedContact.type === 'fornecedor' || matchedContact.type === 'ambos') {
            updated.suggestedCategoryName = 'Pagamento de Fornecedor';
            updated.classificationConfidence = 'revisar';
            updated.classificationStatus = 'pending_review';
            updated.classificationReason = `Contato cadastrado (${matchedContact.name}) mas sem histórico de lançamentos.`;
            updated.suggestedAction = 'Revisar pagamento de fornecedor.';
          } else {
            updated.suggestedCategoryName = 'Transferência / Retirada';
            updated.classificationConfidence = 'media';
            updated.classificationStatus = 'pending_review';
            updated.classificationReason = `Contato cadastrado (${matchedContact.name}) sem histórico, tratado como transferência/retirada.`;
            updated.suggestedAction = 'Revisar se é retirada, transferência pessoal ou outro tipo de saída.';
          }
        }
      } else {
        const isPJ = /\b(ltda|s\/a|s\.a\.|comercio|comércio|importacao|importação|exportacao|exportação|industria|indústria|distribuidora|servicos|serviços|cia|me|eireli|epp|limitada|sociedade|e&e)\b/i.test(recipient);
        const hasProductKeyword = /\b(mercadoria|estoque|produto|fornecedor|compra|pecas|peças|insumos|embalagem)\b/i.test(recipient.toLowerCase()) || 
                                   /\b(mercadoria|estoque|produto|fornecedor|compra|pecas|peças|insumos|embalagem)\b/i.test(updated.title.toLowerCase());
        
        if (isPJ) {
          if (hasProductKeyword) {
            updated.suggestedCategoryName = 'Compra de mercadoria';
            updated.classificationConfidence = 'alta';
            updated.classificationStatus = 'classified';
            updated.classificationReason = 'Pix enviado para empresa com evidência de fornecimento de mercadoria.';
            updated.suggestedAction = 'Confirmar compra de mercadoria para estoque.';
          } else {
            updated.suggestedCategoryName = 'Pagamento de Fornecedor';
            updated.classificationConfidence = 'revisar';
            updated.classificationStatus = 'pending_review';
            updated.classificationReason = 'Pix enviado para empresa sem contato ou histórico cadastrado.';
            updated.suggestedAction = 'Revisar se é pagamento de fornecedor ou compra.';
          }
        } else {
          updated.suggestedCategoryName = 'Transferência / Retirada';
          updated.classificationConfidence = 'media';
          updated.classificationStatus = 'pending_review';
          updated.classificationReason = 'Pix enviado para pessoa física (sem indicador de empresa)';
          updated.suggestedAction = 'Revisar se é retirada, transferência pessoal ou outro tipo de saída.';
        }
      }
    }

    if (updated.suggestedCategoryName && !updated.categoryId) {
      const matchCat = snapshot.categories.find(c => c.name.toLowerCase() === updated.suggestedCategoryName!.toLowerCase());
      if (matchCat) {
        updated.categoryId = matchCat.id;
      }
    }

    // Proteção Global de Receita em Saída
    if (updated.netAmount < 0) {
      if (updated.suggestedCategoryName === 'Venda de Produtos' || updated.suggestedCategoryName === 'Recebimentos via Pix') {
        updated.suggestedCategoryName = 'Movimentação Pendente de Classificação';
        updated.classificationConfidence = 'revisar';
        updated.classificationStatus = 'pending_review';
        updated.classificationReason = 'Proteção Global de Receita: Impedida categoria de receita em valor negativo.';
        updated.suggestedAction = 'Definir uma despesa ou movimentação financeira adequada.';
        const matchCat = snapshot.categories.find(c => c.name === 'Movimentação Pendente de Classificação');
        if (matchCat) {
          updated.categoryId = matchCat.id;
        }
      }
    }

    // Bloquear auto-aprovação se classificação semântica estiver em revisão ou confiança for média/revisar
    if (updated.classificationStatus === 'pending_review' || updated.classificationConfidence === 'media' || updated.classificationConfidence === 'revisar') {
      updated.status = 'pendente';
      if (updated.confidence === 'alta') {
        updated.confidence = updated.classificationConfidence === 'media' ? 'media' : 'revisar';
      }
    }

    if (updated.classificationStatus === 'pending_review' && !initialPending) {
      stats.pendingClassification++;
    } else if (updated.classificationStatus !== 'pending_review' && initialPending) {
      stats.pendingClassification--;
    }

    // Modo genérico: sempre revisar
    if (updated.mode === 'generic') updated.confidence = 'revisar';

    return updated;
  });

  return { events: updatedEvents, stats };
}

// ========== MATCH FUNCTIONS ==========

function findStrongMatch(
  event: ImportEvent,
  pendingTitles: Title[],
  snapshot: FinanceSnapshot
): ConciliationResult {
  const ref = event.reference!;

  const candidates = pendingTitles.filter(t => {
    const doc = snapshot.documents.find(d => d.id === t.documentId);
    if (!doc) return false;

    // 1. Match por reference_id estruturado (campo dedicado)
    if (doc.referenceId && doc.referenceId === ref) {
      // Verifica se o sentido (receber/pagar) corresponde ao valor do evento
      if (event.netAmount > 0 && t.side !== 'receber') return false;
      if (event.netAmount < 0 && t.side !== 'pagar') return false;
      // Verifica família de origem, permite Mercado Livre/Pago equivalentes
      if (doc.sourceType) {
        return isSameSourceFamily(doc.sourceType, event.source);
      }
      return true;
    }

    // 2. Match pelo padrão formatado [#ID] na descrição
    const docDesc = doc.description || '';
    if (docDesc.includes(`[#${ref}]`)) {
      if (event.netAmount > 0 && t.side !== 'receber') return false;
      if (event.netAmount < 0 && t.side !== 'pagar') return false;
      return true;
    }

    // 3. Fallback: substring na descrição (para dados legados)
    return ref.length > 5 && docDesc.includes(ref);
  });

  if (candidates.length === 1) {
    return {
      matchConfidence: 'strong',
      titleId: candidates[0].id,
      explanation: `Correspondência encontrada via ID do pedido #${ref}. Baixar título existente.`,
      candidates: candidates.map(t => formatCandidate(t, snapshot))
    };
  }

  if (candidates.length > 1) {
    return {
      matchConfidence: 'none',
      explanation: `Conflito: múltiplos títulos (${candidates.length}) com a mesma referência #${ref}.`,
      candidates: candidates.map(t => formatCandidate(t, snapshot))
    };
  }

  return {
    matchConfidence: 'none',
    explanation: '',
    candidates: []
  };
}

function findMediumMatch(
  event: ImportEvent,
  pendingTitles: Title[],
  snapshot: FinanceSnapshot
): ConciliationResult {
  const eventValue = Math.abs(event.netAmount);
  const eventDate = new Date(event.date);

  // Encontrar o contato correspondente ao marketplace source
  const sourceContact = snapshot.contacts.find(c => c.name === event.source);

  const candidates = pendingTitles.filter(t => {
    // Match exato de valor (centavo a centavo)
    // Valor exato ou diferença até R$0,05 (medium tolerance)
    const valueDiff = Math.abs(t.value - eventValue);
    const isExact = valueDiff < 0.01;
    const isMedium = valueDiff <= 0.05;
    if (!isExact && !isMedium) return false;

    // Ensure side matches sign of event
    if (event.netAmount > 0 && t.side !== 'receber') return false;
    if (event.netAmount < 0 && t.side !== 'pagar') return false;

    // Verify contact/source matching, allowing family equivalence for Mercado
const doc = snapshot.documents.find(d => d.id === t.documentId);
if (!doc) return false;

const docContactName = snapshot.contacts.find(c => c.id === doc.contactId)?.name || '';
const docFamilySource = doc.sourceType || docContactName || '';
const eventSource = event.source || '';

const sameMarketplaceFamily =
  isSameSourceFamily(eventSource, docFamilySource) ||
  isSameSourceFamily(eventSource, docContactName) ||
  (sourceContact
    ? isSameSourceFamily(sourceContact.name, docFamilySource) ||
      isSameSourceFamily(sourceContact.name, docContactName) ||
      isSameSourceFamily(sourceContact.name, eventSource)
    : false);

if (sourceContact && !sameMarketplaceFamily && doc.contactId !== sourceContact.id) return false;

// Date margin: ±30 days for Mercado family, otherwise default margins
let dayMargin = event.mode === 'bank' ? 3 : 5;
if (sameMarketplaceFamily || isSameSourceFamily(eventSource, docFamilySource) || isSameSourceFamily(eventSource, docContactName)) {
  dayMargin = 30;
}
    const tDate = new Date(t.dueDate);
    const diffDays = Math.abs(tDate.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > dayMargin) return false;

    return true;
  });

  if (candidates.length === 1) {
  return {
    matchConfidence: 'medium',
    titleId: candidates[0].id,
    explanation: `Sugestão de correspondência por valor (${formatCurrencySimple(eventValue)}) + família marketplace (${event.source}) + data próxima. Requer revisão.`,
    candidates: candidates.map(t => formatCandidate(t, snapshot))
  };
}

  if (candidates.length > 1) {
    return {
      matchConfidence: 'none',
      explanation: `Múltiplas correspondências por valor (${candidates.length} títulos com R$${eventValue.toFixed(2)}).`,
      candidates: candidates.map(t => formatCandidate(t, snapshot))
    };
  }

  return {
    matchConfidence: 'none',
    explanation: '',
    candidates: []
  };
}

function findWeakMatch(
  event: ImportEvent,
  pendingTitles: Title[],
  snapshot: FinanceSnapshot
): ConciliationResult {
  const eventValue = Math.abs(event.netAmount);
  const eventDate = new Date(event.date);

  const candidates = pendingTitles.filter(t => {
    const tDate = new Date(t.dueDate);
    const diffDays = Math.abs(tDate.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 7) return false;

    // Valor dentro de 5% de tolerância
    const diffPct = Math.abs(t.value - eventValue) / Math.max(t.value, 1);
    return diffPct <= 0.05 && diffPct > 0.001; // Exclui match exato (já coberto por medium)
  });

  if (candidates.length > 0) {
    return {
      matchConfidence: 'weak',
      explanation: `Possível divergência de valor. ${candidates.length} título(s) com valor semelhante encontrados.`,
      candidates: candidates.map(t => formatCandidate(t, snapshot))
    };
  }

  return {
    matchConfidence: 'none',
    explanation: '',
    candidates: []
  };
}

function findBroadCandidates(
  event: ImportEvent,
  pendingTitles: Title[],
  snapshot: FinanceSnapshot
): ConciliationResult['candidates'] {
  const eventValue = Math.abs(event.netAmount);
  const eventDate = new Date(event.date);

  return pendingTitles
    .filter(t => {
      const tDate = new Date(t.dueDate);
      const diffDays = Math.abs(tDate.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 15) return false;

      const diffPct = Math.abs(t.value - eventValue) / Math.max(t.value, 1);
      return diffPct <= 0.15 || Math.abs(t.value - eventValue) < 0.01;
    })
    .map(t => formatCandidate(t, snapshot));
}

// ========== HELPERS ==========

function formatCandidate(t: Title, snapshot: FinanceSnapshot) {
  const doc = snapshot.documents.find(d => d.id === t.documentId);
  return {
    id: t.id,
    description: t.description || doc?.description || 'Título',
    value: t.value,
    date: t.dueDate
  };
}

/**
 * Verifica se duas fontes pertencem à mesma família
 * (ex: 'Mercado Livre' e 'Mercado Pago' são da mesma família)
 */
function isSameSourceFamily(source1: string, source2: string): boolean {
  const normalize = (s: string) => s.toLowerCase().trim();
  const s1 = normalize(source1);
  const s2 = normalize(source2);

  if (s1 === s2) return true;

  // Mercado Livre e Mercado Pago são da mesma família
  const mercadoFamily = ['mercado livre', 'mercado pago'];
  if (mercadoFamily.includes(s1) && mercadoFamily.includes(s2)) return true;

  return false;
}

function formatCurrencySimple(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

export interface ConciliationStats {
  strong: number;
  medium: number;
  weak: number;
  none: number;
  pendingClassification: number;
  duplicates: number;
}
