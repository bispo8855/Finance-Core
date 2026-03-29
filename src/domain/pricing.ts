import { 
  PricingInput, 
  PricingMode, 
  PricingResult, 
  PricingValidationResult,
  PricingStatus 
} from '../types/pricing';

export function validatePricingInput(input: PricingInput, mode: PricingMode): PricingValidationResult {
  const errors: string[] = [];

  if (input.baseCost < 0) {
    errors.push("O custo base não pode ser negativo.");
  }

  const additionalCostNegative = input.additionalCosts.some(c => c.value < 0);
  if (additionalCostNegative) {
    errors.push("Os custos adicionais não podem ser negativos.");
  }

  if (input.taxesPercentage < 0 || input.feesPercentage < 0) {
    errors.push("Taxas e impostos precisam ser positivos.");
  }

  if (mode === 'discover_price') {
    if (input.desiredMarginPercentage === undefined || input.desiredMarginPercentage < 0) {
      errors.push("Margem desejada precisa ser informada e positiva.");
    }
    
    const sumPercentages = (input.taxesPercentage || 0) + (input.feesPercentage || 0) + (input.desiredMarginPercentage || 0);
    if (sumPercentages >= 100) {
      errors.push("A soma de taxas, impostos e margem não pode ser igual ou maior que 100%. O preço se tornaria infinito ou negativo.");
    }
  }

  if (mode === 'validate_price') {
    if (input.informedPrice === undefined || input.informedPrice <= 0) {
      errors.push("Informe um preço de venda válido, maior que zero.");
    }

    const sumPercentages = (input.taxesPercentage || 0) + (input.feesPercentage || 0);
    if (sumPercentages >= 100) {
      errors.push("A soma de taxas e impostos não pode ser maior ou igual a 100%. Você operaria com prejuízo garantido.");
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

function calculateTotalCost(input: PricingInput): number {
  const base = input.baseCost || 0;
  const additional = input.additionalCosts.reduce((acc, curr) => acc + (curr.value || 0), 0);
  return base + additional;
}

function determineStatusAndDiagnostics(
  margin: number,
  profit: number,
  costPct: number,
  taxPct: number,
  mode: PricingMode
): { status: PricingStatus, messages: string[] } {
  const messages: string[] = [];
  let status: PricingStatus = 'healthy';

  if (profit <= 0 || margin <= 0) {
    status = 'critical';
  } else if (margin < 10) {
    status = 'warning';
  } else if (margin <= 20) {
    status = 'adjusted';
  } else {
    status = 'healthy';
  }

  // Cause + Consequence diagnostics
  if (taxPct > 25) {
    messages.push("Os percentuais (impostos e taxas) consomem grande parte da venda. Negociar essas taxas gera ganho direto no seu bolso.");
  }
  if (costPct > 60) {
    messages.push("O custo do produto/serviço representa a maior fatia do preço. Estruturas pesadas reduzem sua margem de manobra.");
  }

  if (status === 'critical') {
    messages.push("Atenção máxima: O cenário atual não cobre todos os custos, gerando prejuízo a cada venda.");
  } else if (status === 'warning') {
    messages.push("A margem é insuficiente para absorver riscos. O preço atual deixa seu caixa vulnerável a imprevistos.");
  } else if (status === 'adjusted') {
    messages.push("Sua margem está na zona recomendável, mas não há excedente agressivo para crescimento acelerado.");
  } else {
    messages.push("Estrutura financeira saudável. O preço permite cobrir os custos e gerar caixa livremente.");
  }

  return { status, messages: messages.slice(0, 2) }; // Max 2 sentences
}

function generatePricingInsight(profit: number, price: number, taxPct: number): string | null {
  if (price === 0) return null;
  const margin = (profit / price) * 100;
  
  if (margin < 15 && taxPct > 10) {
    return `Reduzir 2% nas taxas de intermediação gera ganho direto e imediato no seu lucro líquido.`;
  }
  
  if (margin < 25) {
      const suggestedIncrease = price * 0.05;
      return `Um leve reajuste de R$ ${suggestedIncrease.toFixed(2).replace('.', ',')} no preço eleva o resultado financeiro sem impacto relevante na percepção do cliente.`;
  }

  if (profit > 0) {
      const actualCostPct = ((price - profit - (price*(taxPct/100))) / price) * 100;
      return `A estrutura de custo representa ${actualCostPct.toFixed(0)}% do preço. Atenção para não romper esse teto e corroer a margem.`;
  }

  return null;
}

export function calculateDiscoverPrice(input: PricingInput): PricingResult {
  const validation = validatePricingInput(input, 'discover_price');
  const totalCost = calculateTotalCost(input);
  
  if (!validation.isValid) {
    return createInvalidResult('discover_price', validation, totalCost);
  }

  if (totalCost === 0) {
      return createInvalidResult('discover_price', { isValid: false, errors: ["O custo total deve ser maior que zero para o cálculo."] }, totalCost);
  }

  const taxPct = (input.taxesPercentage || 0) / 100;
  const feePct = (input.feesPercentage || 0) / 100;
  const marginPct = (input.desiredMarginPercentage || 0) / 100;

  // Formula: Price = Cost / (1 - taxes - fees - margin)
  const suggestedPrice = totalCost / (1 - taxPct - feePct - marginPct);
  
  const taxesAmount = suggestedPrice * taxPct;
  const feesAmount = suggestedPrice * feePct;
  const unitProfit = suggestedPrice - totalCost - taxesAmount - feesAmount;
  const markup = suggestedPrice / totalCost;

  const costPct = (totalCost / suggestedPrice) * 100;
  const totalTaxPct = taxPct * 100 + feePct * 100;

  const { status, messages } = determineStatusAndDiagnostics(marginPct * 100, unitProfit, costPct, totalTaxPct, 'discover_price');
  const insight = generatePricingInsight(unitProfit, suggestedPrice, totalTaxPct);

  return {
    mode: 'discover_price',
    validation,
    status,
    diagnosticMessages: messages,
    insight,
    totalCost,
    taxesAmount,
    feesAmount,
    suggestedPrice,
    unitProfit,
    realMarginPercentage: (input.desiredMarginPercentage || 0),
    markup
  };
}

export function calculateValidatePrice(input: PricingInput): PricingResult {
  const validation = validatePricingInput(input, 'validate_price');
  const totalCost = calculateTotalCost(input);
  const informedPrice = input.informedPrice || 0;

  if (!validation.isValid) {
    return createInvalidResult('validate_price', validation, totalCost, informedPrice);
  }
  
  if (totalCost === 0) {
      return createInvalidResult('validate_price', { isValid: false, errors: ["O custo total deve ser maior que zero para um diagnóstico válido."] }, totalCost, informedPrice);
  }

  const taxPct = (input.taxesPercentage || 0) / 100;
  const feePct = (input.feesPercentage || 0) / 100;

  const taxesAmount = informedPrice * taxPct;
  const feesAmount = informedPrice * feePct;
  
  const unitProfit = informedPrice - totalCost - taxesAmount - feesAmount;
  const realMarginPercentage = (unitProfit / informedPrice) * 100;
  const markup = informedPrice / totalCost;

  const costPct = (totalCost / informedPrice) * 100;
  const totalTaxPct = taxPct * 100 + feePct * 100;

  const { status, messages } = determineStatusAndDiagnostics(realMarginPercentage, unitProfit, costPct, totalTaxPct, 'validate_price');
  const insight = generatePricingInsight(unitProfit, informedPrice, totalTaxPct);

  return {
    mode: 'validate_price',
    validation,
    status,
    diagnosticMessages: messages,
    insight,
    totalCost,
    taxesAmount,
    feesAmount,
    suggestedPrice: informedPrice,
    unitProfit,
    realMarginPercentage,
    markup
  };
}

export function calculatePricing(input: PricingInput, mode: PricingMode): PricingResult {
    // If it's a completely empty initial state, treat it as idle without angry errors
    if (!input.baseCost && !input.informedPrice && !input.desiredMarginPercentage) {
         return createIdleResult(mode);
    }

    if (mode === 'discover_price') {
        return calculateDiscoverPrice(input);
    }
    return calculateValidatePrice(input);
}

function createInvalidResult(mode: PricingMode, validation: PricingValidationResult, totalCost: number, fallbackPrice: number = 0): PricingResult {
  return {
    mode,
    validation,
    status: 'invalid',
    diagnosticMessages: [],
    insight: null,
    totalCost,
    taxesAmount: 0,
    feesAmount: 0,
    suggestedPrice: fallbackPrice,
    unitProfit: 0,
    realMarginPercentage: 0,
    markup: 0
  };
}

function createIdleResult(mode: PricingMode): PricingResult {
     return {
        mode,
        validation: { isValid: true, errors: [] },
        status: 'idle',
        diagnosticMessages: ["Preencha os valores para visualizar o diagnóstico."],
        insight: null,
        totalCost: 0,
        taxesAmount: 0,
        feesAmount: 0,
        suggestedPrice: 0,
        unitProfit: 0,
        realMarginPercentage: 0,
        markup: 0
     };
}
