import { LucideIcon, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { navigateToTransactions } from '@/utils/navigation';

interface DriverItem {
  id: string;
  name: string;
  value: number;
}

interface ExecutiveDriversProps {
  drivers: {
    receitas: DriverItem[];
    custos: DriverItem[];
    despesas: DriverItem[];
  };
}

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function DriverList({ title, items, icon: Icon, colorClass }: { title: string, items: DriverItem[], icon: LucideIcon, colorClass: string }) {
  const navigate = useNavigate();
  return (
    <div className="bg-card border shadow-sm rounded-xl p-5 w-full">
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`w-5 h-5 ${colorClass}`} />
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground leading-relaxed">
          Ainda não há dados suficientes neste período.<br/>
          Registre receitas e despesas para identificar os principais impactos do negócio.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div 
              key={item.id} 
              onClick={() => navigateToTransactions(navigate, { categoryId: item.id })}
              className="flex justify-between items-center group cursor-pointer hover:bg-muted/50 p-1.5 -mx-1.5 rounded transition-colors"
            >
              <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors truncate max-w-[65%]">
                {idx + 1}. {item.name}
              </span>
              <span className="text-sm font-bold truncate max-w-[35%] group-hover:text-primary transition-colors">
                {fmt(item.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ExecutiveDrivers({ drivers }: ExecutiveDriversProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Principais Impactos</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DriverList 
          title="Top Receitas" 
          items={drivers.receitas} 
          icon={TrendingUp} 
          colorClass="text-positive" 
        />
        <DriverList 
          title="Top Custos" 
          items={drivers.custos} 
          icon={DollarSign} 
          colorClass="text-warning" 
        />
        <DriverList 
          title="Top Despesas" 
          items={drivers.despesas} 
          icon={TrendingDown} 
          colorClass="text-destructive" 
        />
      </div>
    </div>
  );
}
