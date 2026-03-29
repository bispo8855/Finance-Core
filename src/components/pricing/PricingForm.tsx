import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AdditionalCostsList } from "./AdditionalCostsList";
import { PricingMode, BusinessType, PricingAdditionalCost, PricingResult } from "@/types/pricing";
import { PricingBusinessTypeSelector } from "./PricingBusinessTypeSelector";
import { PricingModeSelector } from "./PricingModeSelector";
import { Card } from "@/components/ui/card";

interface PricingFormProps {
  state: {
    mode: PricingMode;
    businessType: BusinessType;
    baseCost: number | "";
    taxesPercentage: number | "";
    feesPercentage: number | "";
    desiredMarginPercentage: number | "";
    informedPrice: number | "";
    additionalCosts: PricingAdditionalCost[];
  };
  actions: {
    setMode: (val: PricingMode) => void;
    setBusinessType: (val: BusinessType) => void;
    setBaseCost: (val: number | "") => void;
    setTaxesPercentage: (val: number | "") => void;
    setFeesPercentage: (val: number | "") => void;
    setDesiredMarginPercentage: (val: number | "") => void;
    setInformedPrice: (val: number | "") => void;
    addAdditionalCost: (name: string, value: number) => void;
    removeAdditionalCost: (id: string) => void;
    updateAdditionalCost: (id: string, value: number) => void;
  };
  result: PricingResult;
}

export function PricingForm({ state, actions, result }: PricingFormProps) {
  // Adaptation logic based on business type
  const baseCostLabel = state.businessType === 'ecommerce' ? "Custo do Produto (Fornecedor)" : 
                        state.businessType === 'service' ? "Custo da Hora/Serviço Base" : 
                        state.businessType === 'industry' ? "Custo de Matéria Prima" : 
                        "Custo Base";
                        
  const feesLabel = state.businessType === 'ecommerce' ? "Taxas (Marketplace, Gateway)" : 
                    state.businessType === 'service' ? "Comissões ou Taxas" : 
                    "Outras Taxas (%)";

  return (
    <Card className="p-6 space-y-8 bg-white shadow-sm border-slate-200">
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PricingBusinessTypeSelector businessType={state.businessType} onChange={actions.setBusinessType} />
        <PricingModeSelector mode={state.mode} onChange={actions.setMode} />
      </div>

      <Separator />

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-slate-800 mb-4">Estrutura de Custo</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="baseCost">{baseCostLabel}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">R$</span>
                <Input
                  id="baseCost"
                  type="number"
                  placeholder="0,00"
                  className="pl-9 text-lg"
                  value={state.baseCost}
                  onChange={(e) => actions.setBaseCost(e.target.value === '' ? '' : Number(e.target.value))}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="pt-2">
              <Label className="mb-3 block text-slate-600">Custos Adicionais por Unidade</Label>
              <AdditionalCostsList 
                costs={state.additionalCosts}
                onAdd={actions.addAdditionalCost}
                onRemove={actions.removeAdditionalCost}
                onUpdate={actions.updateAdditionalCost}
              />
            </div>
          </div>
        </div>

        <Separator />

        <div>
           <h3 className="text-lg font-medium text-slate-800 mb-4">Percentuais sobre a Venda</h3>
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taxesPercentage">Impostos (%)</Label>
                <div className="relative">
                  <Input
                    id="taxesPercentage"
                    type="number"
                    placeholder="0"
                    className="pr-8"
                    value={state.taxesPercentage}
                    onChange={(e) => actions.setTaxesPercentage(e.target.value === '' ? '' : Number(e.target.value))}
                    min="0"
                    step="0.1"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feesPercentage">{feesLabel}</Label>
                <div className="relative">
                  <Input
                    id="feesPercentage"
                    type="number"
                    placeholder="0"
                    className="pr-8"
                    value={state.feesPercentage}
                    onChange={(e) => actions.setFeesPercentage(e.target.value === '' ? '' : Number(e.target.value))}
                    min="0"
                    step="0.1"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                </div>
              </div>
           </div>
        </div>

        <Separator />

        <div>
           <h3 className="text-lg font-medium text-slate-800 mb-4">Objetivo Final</h3>
           
           {state.mode === 'discover_price' ? (
              <div className="space-y-4 bg-slate-50 p-5 rounded-lg border border-slate-100 relative overflow-hidden">
                <div className="space-y-2 relative z-10">
                  <Label htmlFor="desiredMargin" className="text-slate-800 font-semibold">Margem de Lucro Desejada (%)</Label>
                  <p className="text-sm text-slate-500 mb-2">A fatia do preço que sobra limpa para o caixa (não é markup sobre o custo).</p>
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center mt-2">
                    <div className="relative w-40 min-w-[160px]">
                      <Input
                        id="desiredMargin"
                        type="number"
                        placeholder="Ex: 20"
                        className="pr-8 text-lg font-bold"
                        value={state.desiredMarginPercentage}
                        onChange={(e) => actions.setDesiredMarginPercentage(e.target.value === '' ? '' : Number(e.target.value))}
                        min="0"
                        step="0.1"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">%</span>
                    </div>
                    
                    {/* Real-time estimation feedback */}
                    {state.desiredMarginPercentage !== '' && result.status !== 'invalid' && (
                        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-100 animate-in fade-in slide-in-from-left-2 duration-300">
                          <span className="text-sm font-medium">
                            ≈ {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(result.unitProfit)} de lucro limpo por unidade
                          </span>
                        </div>
                    )}
                  </div>
                </div>
              </div>
           ) : (
             <div className="space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-100">
                <Label htmlFor="informedPrice" className="text-slate-700 font-medium">Preço de Venda Praticado</Label>
                <p className="text-sm text-slate-500 mb-2">O preço exato pelo qual você vende (ou deseja vender) a unidade.</p>
                <div className="relative w-1/2 min-w-[200px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">R$</span>
                  <Input
                    id="informedPrice"
                    type="number"
                    placeholder="0,00"
                    className="pl-9 text-lg font-medium"
                    value={state.informedPrice}
                    onChange={(e) => actions.setInformedPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
           )}
        </div>

      </div>
    </Card>
  );
}
