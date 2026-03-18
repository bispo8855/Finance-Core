import { useState, useMemo, useEffect } from 'react';
import { DocumentType } from '@/types/financial';
import { filterCategoriesForDocumentType, filterContactsForDocumentType } from '@/domain/finance/helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useFinanceSnapshot } from '@/hooks/finance/useFinanceSnapshot';
import { useCreateDocument } from '@/hooks/finance/useCreateDocument';
import { useUpdateDocument } from '@/hooks/finance/useUpdateDocument';
import { useCreateContact } from '@/hooks/finance/useCatalogs';
import { useToast } from '@/components/ui/use-toast';

const docTypeLabels: Record<DocumentType, string> = {
  venda: 'Venda',
  compra: 'Compra',
  despesa: 'Despesa',
  receita: 'Receita avulsa',
};

const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

interface NewDocumentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSide?: 'pagar' | 'receber';
  editDocumentId?: string | null;
}

export function NewDocumentSheet({ open, onOpenChange, defaultSide, editDocumentId }: NewDocumentSheetProps) {
  const { data: snapshot } = useFinanceSnapshot();
  const { mutateAsync: createDocument, isPending: isCreating } = useCreateDocument();
  const { mutateAsync: updateDocument, isPending: isUpdating } = useUpdateDocument();
  const { mutateAsync: createContact, isPending: creatingContact } = useCreateContact();
  const { toast } = useToast();

  const isPending = isCreating || isUpdating;

  const [docType, setDocType] = useState<DocumentType>(defaultSide === 'pagar' ? 'despesa' : 'venda');
  const [contactId, setContactId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [competenceDate, setCompetenceDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalValue, setTotalValue] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<'avista' | 'parcelado'>('avista');
  const [installments, setInstallments] = useState('2');

  // Custom Installments States
  const [installmentsGrid, setInstallmentsGrid] = useState<Array<{ dueDate: string; value: number }>>([]);
  const [autoAdjustRemainder, setAutoAdjustRemainder] = useState(true);
  const [hasManualEdits, setHasManualEdits] = useState(false);

  // Settlement States (only visible when not editing)
  const [isPaid, setIsPaid] = useState(false);
  const [paymentAccountId, setPaymentAccountId] = useState('');

  // Combobox and Create Contact States
  const [openContactSelect, setOpenContactSelect] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [showCreateContact, setShowCreateContact] = useState(false);

  // Set initial state from props or editDocumentId
  useEffect(() => {
    if (open) {
      if (editDocumentId && snapshot) {
        const doc = snapshot.documents.find(d => d.id === editDocumentId);
        if (doc) {
          setDocType(doc.type);
          setContactId(doc.contactId);
          setCategoryId(doc.categoryId);
          setCompetenceDate(doc.competenceDate);
          setTotalValue(doc.totalValue.toString());
          setDescription(doc.description);
          setCondition(doc.condition);
          setInstallments(doc.installments.toString());
          // Editing cannot mark as paid (it replaces planned titles)
          setIsPaid(false);
          setPaymentAccountId('');
        }
      } else {
        // Reset to default on new creation
        setDocType(defaultSide === 'pagar' ? 'despesa' : 'venda');
        setContactId('');
        setCategoryId('');
        setCompetenceDate(new Date().toISOString().split('T')[0]);
        setTotalValue('');
        setDescription('');
        setCondition('avista');
        setInstallments('2');
        setInstallments('2');
        setIsPaid(false);
        setPaymentAccountId('');
        setInstallmentsGrid([]);
        setHasManualEdits(false);
        setAutoAdjustRemainder(true);
      }
    }
  }, [open, editDocumentId, snapshot, defaultSide]);

  // Generate or Update the installmentsGrid automatically if no manual edits have been made
  useEffect(() => {
    if (condition !== 'parcelado' || hasManualEdits) return;
    const val = parseFloat(totalValue) || 0;
    const n = parseInt(installments) || 1;
    if (n < 1) return;
    const perInstallment = Math.round((val / n) * 100) / 100;
    
    const newGrid = Array.from({ length: n }, (_, i) => {
      const d = new Date(competenceDate);
      d.setMonth(d.getMonth() + i);
      return {
        dueDate: d.toISOString().split('T')[0],
        value: i === n - 1 ? val - perInstallment * (n - 1) : perInstallment,
      };
    });
    setInstallmentsGrid(newGrid);
  }, [totalValue, condition, installments, competenceDate, hasManualEdits]);

  const handleRecalculate = () => {
    setHasManualEdits(false);
    setAutoAdjustRemainder(true);
  };

  const handleInstallmentChange = (index: number, field: 'dueDate' | 'value', val: string | number) => {
    setHasManualEdits(true);
    setInstallmentsGrid(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };

      if (field === 'value' && autoAdjustRemainder) {
        const total = parseFloat(totalValue) || 0;
        let sumOthers = 0;
        let adjustIndex = next.length - 1;
        // se editou a ultima, ajusta a penultima (se existir)
        if (index === next.length - 1 && next.length > 1) {
          adjustIndex = next.length - 2;
        }

        for (let i = 0; i < next.length; i++) {
          if (i !== adjustIndex) {
            sumOthers += next[i].value;
          }
        }
        
        const remainder = total - sumOthers;
        next[adjustIndex].value = Math.max(0, Math.round(remainder * 100) / 100);
      }

      return next;
    });
  };


  if (!snapshot) return null;

  const { categories, contacts, accounts } = snapshot;

  const activeCategories = categories.filter(c => c.isActive !== false);
  const activeContacts = contacts.filter(c => c.isActive !== false);
  const activeAccounts = accounts.filter(a => a.isActive !== false);

  const isReceita = docType === 'venda' || docType === 'receita';
  const filteredContacts = filterContactsForDocumentType(activeContacts, docType);
  const filteredCategories = filterCategoriesForDocumentType(activeCategories, docType);

  const exactContactMatch = filteredContacts.some(
    c => c.name.toLowerCase() === contactSearch.toLowerCase().trim()
  );

  const handleOpenCreateContact = (nameToCreate: string) => {
    setContactSearch(nameToCreate);
    setShowCreateContact(true);
    setOpenContactSelect(false);
  };

  const handleCreateContactSubmit = async () => {
    const name = contactSearch.trim();
    if (!name) return;
    try {
      const result = await createContact({
        name,
        type: isReceita ? 'cliente' : 'fornecedor',
      });
      setContactId(result.id);
      setShowCreateContact(false);
      setContactSearch('');
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro', description: 'Erro ao criar contato.', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    if (isPaid && !paymentAccountId) {
      toast({ title: 'Atenção', description: 'Selecione a conta para realizar a baixa.', variant: 'destructive' });
      return;
    }
    if (!contactId || !categoryId || !totalValue || !competenceDate) {
      toast({ title: 'Atenção', description: 'Preencha os campos obrigatórios.', variant: 'destructive' });
      return;
    }

    try {
      if (condition === 'parcelado') {
        const sumParts = installmentsGrid.reduce((acc, curr) => acc + curr.value, 0);
        const total = parseFloat(totalValue) || 0;
        if (Math.abs(sumParts - total) > 0.01) {
           toast({ title: 'Atenção', description: 'A soma das parcelas deve ser igual ao valor total.', variant: 'destructive' });
           return;
        }
      }

      const payload = {
        type: docType,
        contactId,
        categoryId,
        competenceDate,
        totalValue: parseFloat(totalValue) || 0,
        description,
        condition,
        installments: condition === 'parcelado' ? parseInt(installments) || 1 : 1,
        customInstallments: condition === 'parcelado' && hasManualEdits ? installmentsGrid : undefined,
      };

      if (editDocumentId) {
        await updateDocument({ documentId: editDocumentId, payload });
        toast({ title: 'Lançamento atualizado com sucesso!' });
      } else {
        await createDocument({
          payload,
          payNow: isPaid,
          accountId: isPaid ? paymentAccountId : undefined
        });
        toast({ title: 'Lançamento criado com sucesso!' });
      }
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Erro ao salvar lançamento.';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 w-[95vw] max-w-4xl p-0 max-h-[90vh] overflow-hidden rounded-xl">
        <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
          <DialogTitle className="text-2xl">{editDocumentId ? 'Editar Lançamento' : 'Novo Lançamento'}</DialogTitle>
          <DialogDescription>
            {editDocumentId ? 'Altere as informações deste lançamento.' : 'Registre uma venda, compra, despesa ou receita.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
          {/* Tabs no Topo */}
          <div className="bg-muted p-1.5 rounded-lg flex">
            {(Object.keys(docTypeLabels) as DocumentType[]).map(t => (
              <button key={t} onClick={() => { setDocType(t); setContactId(''); setCategoryId(''); }}
                className={`flex-1 rounded-md py-2 text-sm font-semibold transition-all ${docType === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/80'}`}>
                {docTypeLabels[t]}
              </button>
            ))}
          </div>

          {/* Bloco 1: O Que e Com Quem */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">1. O Que e Com Quem</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-card shadow-sm p-5 rounded-xl border">
              <div className="space-y-2">
                <Label>{isReceita ? 'Cliente' : 'Fornecedor'} <span className="text-destructive">*</span></Label>
                <Popover open={openContactSelect} onOpenChange={setOpenContactSelect}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openContactSelect}
                      className="w-full justify-between font-normal bg-background"
                    >
                      {contactId
                        ? filteredContacts.find((c) => c.id === contactId)?.name || 'Selecione...'
                        : "Selecione..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Buscar contato..." 
                        value={contactSearch}
                        onValueChange={setContactSearch}
                      />
                      <CommandList>
                        <CommandEmpty className="px-2 py-3 text-sm text-center">
                          <span className="text-muted-foreground block mb-2">Nenhum contato encontrado.</span>
                          {contactSearch.trim() && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full justify-start text-primary"
                              onClick={() => handleOpenCreateContact(contactSearch)}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Criar "{contactSearch}"
                            </Button>
                          )}
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredContacts.map((contact) => (
                            <CommandItem
                              key={contact.id}
                              value={contact.name}
                              onSelect={() => {
                                setContactId(contact.id);
                                setOpenContactSelect(false);
                                setContactSearch('');
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${contactId === contact.id ? "opacity-100" : "opacity-0"}`}
                              />
                              {contact.name}
                            </CommandItem>
                          ))}
                          {!exactContactMatch && contactSearch.trim() !== '' && (
                            <CommandItem
                              value={contactSearch}
                              onSelect={() => handleOpenCreateContact(contactSearch)}
                              className="text-primary font-medium mt-1"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Criar "{contactSearch}"
                            </CommandItem>
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Categoria <span className="text-destructive">*</span></Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Descrição</Label>
                <Textarea className="bg-background resize-none" placeholder="Detalhes ou observações (opcional)" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
              </div>
            </div>
          </div>

          {/* Bloco 2: Quanto e Quando */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">2. Quanto e Quando</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-card shadow-sm p-5 rounded-xl border">
              <div className="space-y-2">
                <Label>Valor Total <span className="text-destructive">*</span></Label>
                <Input className="bg-background font-semibold text-lg" type="number" step="0.01" placeholder="0,00" value={totalValue} onChange={e => setTotalValue(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data de Vencimento <span className="text-destructive">*</span></Label>
                <Input className="bg-background" type="date" value={competenceDate} onChange={e => setCompetenceDate(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Bloco 3: Condição de pagamento */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">3. Condição de Pagamento</h3>
            
            <div className="space-y-5 bg-card shadow-sm p-5 rounded-xl border">
              <RadioGroup value={condition} onValueChange={v => setCondition(v as 'avista' | 'parcelado')} className="flex gap-8">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="avista" id="avista" />
                  <Label htmlFor="avista" className="font-medium cursor-pointer text-base text-foreground">À vista</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="parcelado" id="parcelado" />
                  <Label htmlFor="parcelado" className="font-medium cursor-pointer text-base text-foreground">Parcelado</Label>
                </div>
              </RadioGroup>

              {condition === 'parcelado' && (
                <div className="space-y-5 pt-5 border-t border-border/50">
                  <div className="space-y-2">
                    <Label>Nº de parcelas</Label>
                    <div className="flex items-center gap-3">
                      <Input type="number" min="2" max="48" value={installments} onChange={e => setInstallments(e.target.value)} className="w-24 bg-background" />
                      <div className="flex gap-2">
                        {[2, 3, 4, 6].map(n => (
                          <Button key={n} type="button" variant="outline" size="sm" className="h-10 px-4 mt-0" onClick={() => setInstallments(n.toString())}>
                            {n}x
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {parseFloat(totalValue) > 0 && (
                    <div className="bg-muted/30 rounded-lg border p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">Distribuição das Parcelas</p>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Switch id="auto-adjust" checked={autoAdjustRemainder} onCheckedChange={setAutoAdjustRemainder} />
                            <Label htmlFor="auto-adjust" className="text-xs font-medium cursor-pointer text-muted-foreground">Ajuste automático</Label>
                          </div>
                          {hasManualEdits && (
                             <Button type="button" variant="secondary" size="sm" onClick={handleRecalculate} className="h-8 text-xs font-semibold">
                               Recalcular
                             </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {installmentsGrid.map((p, idx) => (
                          <div key={idx} className="flex items-center gap-3 bg-background border p-2 rounded-md shadow-sm">
                            <span className="text-xs font-medium text-muted-foreground w-12 text-center">#{idx + 1}</span>
                            <Input 
                              type="date" 
                              value={p.dueDate} 
                              onChange={e => handleInstallmentChange(idx, 'dueDate', e.target.value)} 
                              className="flex-1 text-sm h-8 border-transparent hover:border-border focus:border-ring transition-colors"
                            />
                            <div className="relative">
                              <span className="absolute left-2 top-1.5 text-xs text-muted-foreground">R$</span>
                              <Input 
                                type="number" 
                                step="0.01"
                                value={p.value} 
                                onChange={e => handleInstallmentChange(idx, 'value', parseFloat(e.target.value) || 0)} 
                                className="w-24 text-sm h-8 pl-6 border-transparent hover:border-border focus:border-ring transition-colors"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bloco 4: Liquidação (apenas se à vista e não está editando) */}
          {!editDocumentId && condition === 'avista' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">4. Liquidação</h3>
              
              <div className={`p-5 rounded-xl border shadow-sm space-y-5 transition-colors ${isPaid ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="is-paid" className="text-base font-semibold cursor-pointer">Já foi {isReceita ? 'recebido' : 'pago'}?</Label>
                    <p className="text-xs text-muted-foreground mt-1">Marque caso este lançamento já tenha sido quitado.</p>
                  </div>
                  <Switch id="is-paid" checked={isPaid} onCheckedChange={setIsPaid} className="data-[state=checked]:bg-primary" />
                </div>
                
                {isPaid && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-border/50 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <Label>Conta Bancária / Caixa <span className="text-destructive">*</span></Label>
                      <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                        <SelectTrigger className="bg-background border-primary/30"><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
                        <SelectContent>
                          {activeAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Data do Pagamento <span className="text-destructive">*</span></Label>
                      <Input className="bg-background" type="date" value={competenceDate} disabled />
                      <p className="text-[10px] text-muted-foreground">A data de liquidação será igual à data de vencimento preenchida acima.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        <div className="p-4 sm:px-6 sm:py-4 border-t bg-muted/20 flex gap-4 mt-auto rounded-b-xl items-center justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="px-6">Cancelar</Button>
          <Button disabled={isPending} onClick={handleSave} className="px-8 font-semibold">
            {isPending ? 'Salvando...' : (
              condition === 'parcelado' ? `Criar ${installments} parcelas` :
              (isPaid ? 'Salvar e baixar' : (editDocumentId ? 'Salvar alterações' : 'Salvar como previsto'))
            )}
          </Button>
        </div>
      </DialogContent>

      <Dialog open={showCreateContact} onOpenChange={setShowCreateContact}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar {isReceita ? 'Cliente' : 'Fornecedor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input 
                value={contactSearch} 
                onChange={e => setContactSearch(e.target.value)} 
                placeholder="Ex: João da Silva"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateContact(false)} disabled={creatingContact}>
              Cancelar
            </Button>
            <Button onClick={handleCreateContactSubmit} disabled={!contactSearch.trim() || creatingContact}>
              {creatingContact ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
