export type PricingMode = 'discover_price' | 'validate_price';
export type BusinessType = 'ecommerce' | 'service' | 'industry' | 'other';

export interface PricingAdditionalCost {
  id: string;
  name: string;
  value: number;
}

export interface PricingInput {
  baseCost: number;
  additionalCosts: PricingAdditionalCost[];
  taxesPercentage: number;
  feesPercentage: number;
  
  // Specific to discover_price mode
  desiredMarginPercentage?: number;
  
  // Specific to validate_price mode
  informedPrice?: number;
}

export type PricingStatus = 'healthy' | 'adjusted' | 'warning' | 'critical' | 'invalid' | 'idle';

export interface PricingValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface PricingResult {
  // Original Inputs context
  mode: PricingMode;
  
  // Validation
  validation: PricingValidationResult;
  status: PricingStatus;
  diagnosticMessages: string[];
  insight: string | null;
  
  // Intermediate Calculations
  totalCost: number;
  taxesAmount: number;
  feesAmount: number;
  
  // Final Results
  suggestedPrice: number;    // Always calculated in discover_price, might be informedPrice in validate_price
  unitProfit: number;
  realMarginPercentage: number;
  markup: number;
}
