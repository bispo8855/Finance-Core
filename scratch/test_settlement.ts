import { ImportRawLine, ImportEvent, ImportSource, ImportMode } from '../src/types/import';

function inferSettlementLineStatus(
  desc: string,
  rawStatus: string,
  detectedType: ImportRawLine['detectedType'],
  amount: number,
  hasReleaseDate: boolean,
  isReleaseFuture: boolean
): { status: 'predicted' | 'settled' | 'review', confidence: number, reason: string } {
  const d = desc.toLowerCase();
  const s = rawStatus.toLowerCase();
  const combined = `${d} ${s}`;

  const keywords = [
    'recebido', 'recebimento', 'liquidado', 'baixado', 'liberado', 'liberação', 'liberacao', 
    'repasse', 'creditado', 'crédito', 'credito', 'disponível', 'disponivel', 'saldo disponível', 
    'saldo disponivel', 'valor disponível', 'valor disponivel', 'dinheiro disponível', 
    'dinheiro disponivel', 'pagamento recebido', 'pagamento aprovado', 'pagamento concluído', 
    'pagamento concluido', 'concluído', 'concluido', 'aprovado', 'compensado', 'transferido', 
    'transferência', 'transferencia', 'saque', 'retirada', 'valor liberado', 'dinheiro liberado',
    'paid', 'settled', 'released', 'payout', 'settlement', 'available', 'credited', 'completed', 
    'approved', 'transferred', 'withdrawal', 'received', 'liquidated'
  ];

  const hasKeyword = keywords.some(k => combined.includes(k));
  
  let hasPago = false;
  if (combined.includes('pago')) {
    if (['taxa', 'frete', 'desconhecido'].includes(detectedType) || amount < 0) {
       // Ignorar "pago" para custos
    } else {
       hasPago = true;
    }
  }

  const isIndicatingSettlement = hasKeyword || hasPago;
  
  if (['repasse', 'liberacao', 'transferencia', 'deposito', 'antecipacao', 'entrada_liquidada'].includes(detectedType)) {
     if (hasReleaseDate && isReleaseFuture) {
        return { status: 'review', confidence: 0.6, reason: 'Tipo de liquidação detectado, mas a data de liberação informada é futura.' };
     }
     return { status: 'settled', confidence: 0.9, reason: 'O tipo detectado indica liquidação financeira (repasse/transferência).' };
  }

  if (isIndicatingSettlement && (!hasReleaseDate || !isReleaseFuture)) {
     return { status: 'settled', confidence: 0.8, reason: 'O status ou descrição original indicam que o valor já foi liquidado.' };
  }

  if (isIndicatingSettlement && hasReleaseDate && isReleaseFuture) {
     return { status: 'review', confidence: 0.7, reason: 'Status indica liquidação, mas a data de liberação apontada é futura (Sinais conflitantes).' };
  }

  if (!isIndicatingSettlement && hasReleaseDate && isReleaseFuture) {
     return { status: 'predicted', confidence: 0.9, reason: 'Existe data de liberação projetada no futuro.' };
  }

  return { status: 'predicted', confidence: 0.5, reason: 'Nenhum indicativo claro de liquidação. Mantido como recebível futuro.' };
}

// SIMULATE SCENARIOS
const scenarios = [
  {
    name: "1. Venda já liberada/recebida",
    desc: "Venda Produto X",
    status: "liberado",
    type: "venda",
    amount: 100,
    hasReleaseDate: true,
    isFuture: false
  },
  {
    name: "2. Venda ainda a repassar",
    desc: "Venda Produto Y",
    status: "aprovado",
    type: "venda",
    amount: 100,
    hasReleaseDate: true,
    isFuture: true
  },
  {
    name: "3. Status recebido com data futura",
    desc: "Venda Produto Z",
    status: "recebido",
    type: "venda",
    amount: 100,
    hasReleaseDate: true,
    isFuture: true
  },
  {
    name: "4. Linha com tarifa paga",
    desc: "Custo de Envio (frete pago)",
    status: "",
    type: "frete",
    amount: -15,
    hasReleaseDate: false,
    isFuture: false
  },
  {
    name: "5. Repasse de Marketplace",
    desc: "Repasse Mercado Pago",
    status: "concluido",
    type: "repasse",
    amount: 1500,
    hasReleaseDate: true,
    isFuture: false
  }
];

scenarios.forEach(s => {
  const res = inferSettlementLineStatus(s.desc, s.status, s.type as any, s.amount, s.hasReleaseDate, s.isFuture);
  console.log(`\n=== Cenário: ${s.name} ===`);
  console.log(`Inputs: Desc: "${s.desc}", Status: "${s.status}", Tipo Detectado: "${s.type}", Amount: ${s.amount}, Data Futura: ${s.isFuture}`);
  console.log(`Result -> Status: ${res.status.toUpperCase()}, Confiança: ${res.confidence*100}%, Motivo: ${res.reason}`);
});
