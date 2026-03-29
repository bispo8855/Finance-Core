import { BusinessType } from "@/types/pricing";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Store, Briefcase, Factory, Package } from "lucide-react";

interface PricingBusinessTypeSelectorProps {
  businessType: BusinessType;
  onChange: (value: BusinessType) => void;
}

export function PricingBusinessTypeSelector({ businessType, onChange }: PricingBusinessTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-slate-700">Seu modelo de negócio</h3>
      <Select value={businessType} onValueChange={(v) => onChange(v as BusinessType)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione o modelo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ecommerce">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-slate-500" />
              <span>E-commerce ou Varejo</span>
            </div>
          </SelectItem>
          <SelectItem value="service">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-slate-500" />
              <span>Serviços ou Projetos</span>
            </div>
          </SelectItem>
          <SelectItem value="industry">
            <div className="flex items-center gap-2">
              <Factory className="h-4 w-4 text-slate-500" />
              <span>Indústria ou Produção</span>
            </div>
          </SelectItem>
          <SelectItem value="other">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-slate-500" />
              <span>Outro modelo simples</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
