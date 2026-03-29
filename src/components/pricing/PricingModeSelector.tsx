import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PricingMode } from "@/types/pricing";

interface PricingModeSelectorProps {
  mode: PricingMode;
  onChange: (value: PricingMode) => void;
}

export function PricingModeSelector({ mode, onChange }: PricingModeSelectorProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-slate-700">O que você deseja fazer?</h3>
      <Tabs value={mode} onValueChange={(v) => onChange(v as PricingMode)} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="discover_price">Descobrir preço ideal</TabsTrigger>
          <TabsTrigger value="validate_price">Validar preço praticado</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
