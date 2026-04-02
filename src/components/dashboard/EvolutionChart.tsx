import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart } from 'recharts';

interface EvolucaoItem {
  monthLabel: string;
  receita: number;
  resultado: number;
}

interface EvolutionChartProps {
  evolucao: EvolucaoItem[];
  evolucaoInsight?: string;
}

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function EvolutionChart({ evolucao, evolucaoInsight }: EvolutionChartProps) {
  return (
    <div className="bg-card rounded-xl border shadow-sm p-5 w-full h-[350px]">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tendência dos Últimos 6 Meses</h3>
        {evolucaoInsight && (
          <p className="text-sm font-medium mt-1">{evolucaoInsight}</p>
        )}
      </div>
      <ResponsiveContainer width="100%" height="80%" className="-ml-4">
        <ComposedChart data={evolucao} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="monthLabel" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
            dy={10} 
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
            tickFormatter={(val) => `R$ ${val.toLocaleString('pt-BR', { notation: 'compact' })}`} 
            width={70} 
          />
          <Tooltip 
            formatter={(value: number, name: string) => [fmt(value), name === 'receita' ? 'Receita' : 'Resultado']}
            contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
          
          <Bar 
            dataKey="receita" 
            name="receita" 
            fill="hsl(var(--primary))" 
            radius={[4, 4, 0, 0]} 
            barSize={30} 
          />
          <Line 
            type="monotone" 
            dataKey="resultado" 
            name="resultado" 
            // Using a distinct color like green/gray or success token
            stroke="#10b981" 
            strokeWidth={3} 
            dot={{ r: 4, fill: '#10b981', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
