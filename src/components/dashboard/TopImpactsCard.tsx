import { useNavigate } from 'react-router-dom';
import { ResultImpact } from '@/domain/finance/resultImpacts';
import { ResultLineKey } from '@/domain/finance/resultMapping';

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Tag curta por linha da DRE
const LINE_TAG: Record<ResultLineKey, string> = {
  receitaBruta: 'Receita',
  estornosChargebacks: 'Estornos',
  taxasDeducoesVenda: 'Taxas de Venda',
  custosVariaveis: 'Custos Var.',
  despesasOperacionais: 'Despesas Op.',
  resultadoFinanceiro: 'Financeiro',
  outros: 'Outros',
};

export function TopImpactsCard({ impacts }: { impacts: ResultImpact[] }) {
  const navigate = useNavigate();
  if (impacts.length === 0) return null;

  const maxAbs = Math.max(...impacts.map((i) => Math.abs(i.amount)));

  return (
    <div className="bg-card rounded-xl border shadow-sm">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">Maiores impactos do mês</h3>
        <button onClick={() => navigate('/dre')} className="text-xs text-primary hover:underline">Ver no resultado</button>
      </div>
      <div className="p-4 space-y-3">
        {impacts.map((imp, i) => {
          const widthPct = maxAbs > 0 ? (Math.abs(imp.amount) / maxAbs) * 100 : 0;
          return (
            <div
              key={i}
              onClick={() => navigate('/dre')}
              className="space-y-1 cursor-pointer group rounded-md p-1.5 -m-1.5 hover:bg-muted/40 transition-colors"
            >
              <div className="flex justify-between items-center gap-3 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate font-medium group-hover:text-foreground">{imp.label}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground/70 bg-muted rounded px-1.5 py-0.5 uppercase tracking-tight shrink-0">
                    {LINE_TAG[imp.lineKey]}
                  </span>
                </span>
                <span className="font-semibold tabular-nums text-negative shrink-0">{fmt(imp.amount)}</span>
              </div>
              {imp.categoryName && (
                <div className="text-xs text-muted-foreground truncate">{imp.categoryName}</div>
              )}
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-destructive/60 rounded-full transition-all" style={{ width: `${widthPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
