import { useState, useMemo } from 'react';
import { 
  PricingInput, 
  PricingMode, 
  BusinessType, 
  PricingAdditionalCost 
} from '../types/pricing';
import { calculatePricing } from '../domain/pricing';

export function usePricing() {
  const [mode, setMode] = useState<PricingMode>('discover_price');
  const [businessType, setBusinessType] = useState<BusinessType>('ecommerce');

  const [baseCost, setBaseCost] = useState<number | ''>('');
  const [taxesPercentage, setTaxesPercentage] = useState<number | ''>('');
  const [feesPercentage, setFeesPercentage] = useState<number | ''>('');
  
  const [desiredMarginPercentage, setDesiredMarginPercentage] = useState<number | ''>('');
  const [informedPrice, setInformedPrice] = useState<number | ''>('');

  const [additionalCosts, setAdditionalCosts] = useState<PricingAdditionalCost[]>([]);

  const addAdditionalCost = (name: string, value: number) => {
     setAdditionalCosts(prev => [...prev, { id: "cost-" + Date.now() + "-" + Math.random(), name, value }]);
  };

  const removeAdditionalCost = (id: string) => {
     setAdditionalCosts(prev => prev.filter(c => c.id !== id));
  };
  
  const updateAdditionalCost = (id: string, value: number) => {
     setAdditionalCosts(prev => prev.map(c => c.id === id ? { ...c, value } : c));
  };

  // Convert empty string states to numbers for the domain engine
  const pricingInput = useMemo<PricingInput>(() => ({
    baseCost: baseCost === '' ? 0 : baseCost,
    additionalCosts,
    taxesPercentage: taxesPercentage === '' ? 0 : taxesPercentage,
    feesPercentage: feesPercentage === '' ? 0 : feesPercentage,
    desiredMarginPercentage: desiredMarginPercentage === '' ? 0 : desiredMarginPercentage,
    informedPrice: informedPrice === '' ? 0 : informedPrice,
  }), [baseCost, additionalCosts, taxesPercentage, feesPercentage, desiredMarginPercentage, informedPrice]);

  const result = useMemo(() => {
    return calculatePricing(pricingInput, mode);
  }, [pricingInput, mode]);

  return {
    state: {
      mode,
      businessType,
      baseCost,
      taxesPercentage,
      feesPercentage,
      desiredMarginPercentage,
      informedPrice,
      additionalCosts,
    },
    actions: {
      setMode,
      setBusinessType,
      setBaseCost,
      setTaxesPercentage,
      setFeesPercentage,
      setDesiredMarginPercentage,
      setInformedPrice,
      addAdditionalCost,
      removeAdditionalCost,
      updateAdditionalCost,
    },
    result
  };
}
