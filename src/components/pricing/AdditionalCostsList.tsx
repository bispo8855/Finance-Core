import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PricingAdditionalCost } from "@/types/pricing";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface AdditionalCostsListProps {
  costs: PricingAdditionalCost[];
  onAdd: (name: string, value: number) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, value: number) => void;
}

export function AdditionalCostsList({ costs, onAdd, onRemove, onUpdate }: AdditionalCostsListProps) {
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState<number | "">("");

  const handleAdd = () => {
    if (newName.trim() && newValue !== "") {
      onAdd(newName, Number(newValue));
      setNewName("");
      setNewValue("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {costs.map((cost) => (
          <div key={cost.id} className="flex items-center gap-3">
            <div className="flex-1">
              <Input 
                value={cost.name} 
                readOnly 
                className="bg-slate-50 text-slate-500"
              />
            </div>
            <div className="w-32">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">R$</span>
                <Input
                  type="number"
                  value={cost.value || ""}
                  onChange={(e) => onUpdate(cost.id, Number(e.target.value) || 0)}
                  className="pl-9"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-slate-400 hover:text-red-500 hover:bg-red-50"
              onClick={() => onRemove(cost.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-3 pt-2">
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs text-slate-500">Descrição do custo</Label>
          <Input 
            placeholder="Ex: Embalagem, Frete..." 
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <div className="w-32 space-y-1.5">
           <Label className="text-xs text-slate-500">Valor</Label>
           <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">R$</span>
            <Input 
              type="number"
              placeholder="0,00" 
              className="pl-9"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value ? Number(e.target.value) : "")}
              min="0"
              step="0.01"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
          </div>
        </div>
        <Button variant="secondary" onClick={handleAdd} disabled={!newName.trim() || newValue === ""}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar
        </Button>
      </div>
    </div>
  );
}
