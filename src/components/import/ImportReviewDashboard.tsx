import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImportBatch, ImportEvent, ImportEventStatus } from '@/types/import';
import ImportEventCard from './ImportEventCard';
import { CheckCircle2, ListFilter, AlertTriangle, Play } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { persistApprovedEvents } from '@/services/importPersister';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface ImportReviewDashboardProps {
  batch: ImportBatch;
  onReset: () => void;
  onImportSuccess: (count: number) => void;
}

export default function ImportReviewDashboard({ batch, onReset, onImportSuccess }: ImportReviewDashboardProps) {
  const navigate = useNavigate();
  const [events, setEvents] = useState<ImportEvent[]>(batch.events);
  const [filter, setFilter] = useState<string>('todos');
  const [isPersisting, setIsPersisting] = useState(false);

  const handleStatusChange = (id: string, status: ImportEventStatus) => {
    setEvents(prev => prev.map(ev => ev.id === id ? { ...ev, status } : ev));
  };

  const filteredEvents = useMemo(() => {
    if (filter === 'todos') return events;
    if (filter === 'pendentes') return events.filter(e => e.status === 'pendente');
    if (filter === 'aprovados') return events.filter(e => e.status === 'aprovado');
    if (filter === 'revisar') return events.filter(e => e.confidence === 'revisar' || e.confidence === 'incompleto');
    return events;
  }, [events, filter]);

  const stats = useMemo(() => {
    const total = events.length;
    const aprovados = events.filter(e => e.status === 'aprovado').length;
    const ignorados = events.filter(e => e.status === 'ignorado').length;
    const pendentes = events.filter(e => e.status === 'pendente').length;
    const revisar = events.filter(e => e.confidence === 'revisar' || e.confidence === 'incompleto').length;
    
    return { total, aprovados, ignorados, pendentes, revisar };
  }, [events]);

  const handleImportAllApproved = async () => {
    const approvedEvents = events.filter(e => e.status === 'aprovado');
    if (approvedEvents.length === 0) {
      toast.error('Nenhum evento aprovado', { description: 'Aprove pelo menos um evento para importar.' });
      return;
    }

    try {
      setIsPersisting(true);
      await persistApprovedEvents(approvedEvents, batch.source);
      toast.success(`${approvedEvents.length} eventos registrados!`);
      onImportSuccess(approvedEvents.length);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error('Erro na importação', { description: msg });
      setIsPersisting(false);
    }
  };

  const handleApproveAllAltaConfianca = () => {
    setEvents(prev => prev.map(ev => {
      // Se for alta confiança e estiver pendente, aprova
      if (ev.confidence === 'alta' && ev.status === 'pendente') {
        return { ...ev, status: 'aprovado' };
      }
      return ev;
    }));
    toast.success('Eventos de alta confiança aprovados automaticamente');
  };

  return (
    <div className="space-y-6">
      {/* Top Executive Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0 shadow-md">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div>
              <p className="text-slate-300 text-sm font-medium uppercase tracking-wider mb-2">Resumo da Leitura</p>
              <h3 className="text-2xl font-semibold leading-tight">
                O Aurys agrupou {batch.linesCount} linhas da planilha em {stats.total} eventos financeiros.
              </h3>
            </div>
            <div className="flex items-center gap-4 mt-6">
              {stats.pendentes > 0 ? (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-sm flex items-center font-medium">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  {stats.pendentes} pendentes
                </span>
              ) : (
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-sm flex items-center font-medium">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Pronto para importar
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200">
          <CardContent className="p-6">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Atenção</p>
            <div className="text-3xl font-bold text-slate-800 mb-1">{stats.revisar}</div>
            <p className="text-sm text-slate-600">Eventos marcados para revisar ou incompletos.</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50 border border-emerald-100">
          <CardContent className="p-6 flex flex-col items-start justify-between h-full">
            <div>
              <p className="text-emerald-600 text-xs font-semibold uppercase tracking-wider mb-2">Progresso</p>
              <div className="text-3xl font-bold text-emerald-700 mb-1">{stats.aprovados}</div>
              <p className="text-sm text-emerald-600">Eventos aprovados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-2">
        <div className="flex items-center gap-3">
          <ListFilter className="w-5 h-5 text-slate-400" />
          <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v)} className="justify-start">
            <ToggleGroupItem value="todos" className="data-[state=on]:bg-slate-200">Todos</ToggleGroupItem>
            <ToggleGroupItem value="pendentes" className="data-[state=on]:bg-blue-100 data-[state=on]:text-blue-800">Pendentes</ToggleGroupItem>
            <ToggleGroupItem value="revisar" className="data-[state=on]:bg-amber-100 data-[state=on]:text-amber-800">Revisar</ToggleGroupItem>
            <ToggleGroupItem value="aprovados" className="data-[state=on]:bg-emerald-100 data-[state=on]:text-emerald-800">Aprovados</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
          <Button variant="outline" className="text-slate-600" onClick={handleApproveAllAltaConfianca}>
            Aprovar "Alta Confiança"
          </Button>
          <Button 
            className="w-full md:w-auto bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
            onClick={handleImportAllApproved}
            disabled={stats.aprovados === 0 || isPersisting}
          >
            {isPersisting ? (
              <>Salvando no banco...</>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2 fill-current" />
                Importar {stats.aprovados} aprovados
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-500">
            Nenhum evento encontrado para este filtro.
          </div>
        ) : (
          filteredEvents.map(event => (
            <ImportEventCard 
              key={event.id} 
              event={event} 
              onStatusChange={handleStatusChange} 
            />
          ))
        )}
      </div>
    </div>
  );
}
