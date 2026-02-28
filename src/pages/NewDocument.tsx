import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentType } from '@/types/financial';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { useFinanceSnapshot } from '@/hooks/finance/useFinanceSnapshot';
import { useCreateDocument } from '@/hooks/finance/useCreateDocument';
import { Title } from '@/types/financial';

const docTypeLabels: Record<DocumentType, string> = {
  venda: 'Venda',
  compra: 'Compra',
  despesa: 'Despesa',
  receita: 'Receita avulsa',
};

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export default function NewDocument() {
  const navigate = useNavigate();

  const { data: snapshot, isLoading } = useFinanceSnapshot();
  const { mutateAsync: createDocument, isPending } = useCreateDocument();

  const [step, setStep] = useState<'form' | 'preview' | 'done'>('form');
  const [docType, setDocType] = useState<DocumentType>('venda');
  const [contactId, setContactId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [competenceDate, setCompetenceDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalValue, setTotalValue] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<'avista' | 'parcelado'>('avista');
  const [installments, setInstallments] = useState('2');
  const [createdTitles, setCreatedTitles] = useState<Title[]>([]);

  if (isLoading || !snapshot) return <div className="p-8 text-center text-muted-foreground">Carregando formulário...</div>;

  const { categories, contacts, accounts } = snapshot;

  const isReceita = docType === 'venda' || docType === 'receita';
  const filteredContacts = contacts.filter(c => isReceita ? c.type === 'cliente' : c.type === 'fornecedor');
  const filteredCategories = categories.filter(c => {
    if (docType === 'venda' || docType === 'receita') return c.type === 'receita';
    if (docType === 'compra') return c.type === 'custo';
    return c.type === 'despesa' || c.type === 'financeiro';
  });

  const previewInstallments = useMemo(() => {
    const val = parseFloat(totalValue) || 0;
    const n = condition === 'parcelado' ? parseInt(installments) || 1 : 1;
    const perInstallment = Math.round((val / n) * 100) / 100;
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(competenceDate);
      d.setMonth(d.getMonth() + i);
      return {
        installment: i + 1,
        dueDate: d.toLocaleDateString('pt-BR'),
        value: i === n - 1 ? val - perInstallment * (n - 1) : perInstallment,
      };
    });
  }, [totalValue, condition, installments, competenceDate]);

  const handleSave = async (payNow = false) => {
    try {
      const result = await createDocument({
        payload: {
          type: docType,
          contactId,
          categoryId,
          competenceDate,
          totalValue: parseFloat(totalValue) || 0,
          description,
          condition,
          installments: condition === 'parcelado' ? parseInt(installments) || 1 : 1,
        },
        payNow,
        accountId: payNow ? accounts[0]?.id : undefined
      });
      setCreatedTitles(result.titles);
      setStep('done');
    } catch (e) {
      console.error(e);
      alert('Erro ao criar lançamento.');
    }
  };

  if (step === 'done') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-card rounded-xl border shadow-sm p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-success-subtle flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-positive" />
          </div>
          <h2 className="text-xl font-bold">Lançamento criado!</h2>
          <p className="text-sm text-muted-foreground">{createdTitles.length} título(s) gerado(s)</p>
          <div className="bg-muted rounded-lg p-4 text-left space-y-2">
            {createdTitles.map(t => (
              <div key={t.id} className="flex justify-between text-sm">
                <span>{t.description}</span>
                <span className="font-medium">{fmt(t.value)} — {new Date(t.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-center pt-2">
            <Button variant="outline" onClick={() => navigate('/')}>Ir ao Dashboard</Button>
            <Button onClick={() => { setStep('form'); setTotalValue(''); setDescription(''); setCreatedTitles([]); }}>
              Novo lançamento
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Novo Lançamento</h1>
          <p className="text-sm text-muted-foreground">Registre uma venda, compra, despesa ou receita</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm p-6 space-y-5">
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.keys(docTypeLabels) as DocumentType[]).map(t => (
              <button key={t} onClick={() => { setDocType(t); setContactId(''); setCategoryId(''); }}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${docType === t ? 'border-primary bg-accent text-accent-foreground ring-1 ring-primary' : 'border-border hover:bg-muted'}`}>
                {docTypeLabels[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>{isReceita ? 'Cliente' : 'Fornecedor'}</Label>
          <Select value={contactId} onValueChange={setContactId}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {filteredContacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Data competência</Label>
            <Input type="date" value={competenceDate} onChange={e => setCompetenceDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Valor total (R$)</Label>
            <Input type="number" step="0.01" placeholder="0,00" value={totalValue} onChange={e => setTotalValue(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Descrição</Label>
          <Textarea placeholder="Descreva o lançamento..." value={description} onChange={e => setDescription(e.target.value)} rows={2} />
        </div>

        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Condição de pagamento</Label>
          <RadioGroup value={condition} onValueChange={v => setCondition(v as any)} className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="avista" id="avista" />
              <Label htmlFor="avista" className="font-normal">À vista</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="parcelado" id="parcelado" />
              <Label htmlFor="parcelado" className="font-normal">Parcelado</Label>
            </div>
          </RadioGroup>
        </div>

        {condition === 'parcelado' && (
          <div className="space-y-2">
            <Label>Nº de parcelas</Label>
            <Input type="number" min="2" max="48" value={installments} onChange={e => setInstallments(e.target.value)} className="w-24" />
          </div>
        )}

        {parseFloat(totalValue) > 0 && (
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prévia dos títulos</p>
            <div className="space-y-1">
              {previewInstallments.map(p => (
                <div key={p.installment} className="flex justify-between text-sm">
                  <span>Parcela {p.installment}/{previewInstallments.length} — {p.dueDate}</span>
                  <span className="font-medium">{fmt(p.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" disabled={isPending} onClick={() => handleSave(false)}>
            Salvar como previsto
          </Button>
          <Button className="flex-1" disabled={isPending} onClick={() => handleSave(true)}>
            Salvar e baixar agora
          </Button>
        </div>
      </div>
    </div>
  );
}
