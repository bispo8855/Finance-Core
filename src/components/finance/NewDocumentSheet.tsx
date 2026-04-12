import { useState, useEffect } from 'react';
import { filterCategoriesForDocumentType, filterContactsForDocumentType } from '@/domain/finance/helpers';
import { DocumentType } from '@/types/financial';
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
import { useSettleTitle } from '@/hooks/finance/useSettleTitle';
import { useCreateContact } from '@/hooks/finance/useCatalogs';
import { useToast } from '@/components/ui/use-toast';

type FlowType = 'entrada' | 'saida';

export function NewDocumentSheet({ open, onOpenChange, onSuccess, defaultSide, editDocumentId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultSide?: 'pagar' | 'receber';
  editDocumentId?: string | null;
}) {
  const { data: snapshot } = useFinanceSnapshot();
  const { mutateAsync: createDocument, isPending: isCreating } = useCreateDocument();
  const { mutateAsync: updateDocument, isPending: isUpdating } = useUpdateDocument();
  const { mutateAsync: createContact, isPending: creatingContact } = useCreateContact();
  const { mutateAsync: settleTitle } = useSettleTitle();
  const { toast } = useToast();

  const [saveStep, setSaveStep] = useState<'idle' | 'creating' | 'settling'>('idle');
  const isPending = isCreating || isUpdating || saveStep !== 'idle';

  const [flowType, setFlowType] = useState<FlowType>(defaultSide === 'pagar' ? 'saida' : 'entrada');
  const [contactId, setContactId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [competenceDate, setCompetenceDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalValue, setTotalValue] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<'avista' | 'parcelado'>('avista');
  const [installments, setInstallments] = useState('2');

  const [installmentsGrid, setInstallmentsGrid] = useState<Array<{ dueDate: string; value: number }>>([]);
  const [autoAdjustRemainder, setAutoAdjustRemainder] = useState(true);
  const [hasManualEdits, setHasManualEdits] = useState(false);

  const [situation, setSituation] = useState<'previsto' | 'realizado'>('previsto');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAccountId, setPaymentAccountId] = useState('');
  
  const [isLocked, setIsLocked] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [hasManuallySetDueDate, setHasManuallySetDueDate] = useState(false);

  const [isMarketplace, setIsMarketplace] = useState(false);
  const [grossAmount, setGrossAmount] = useState('');
  const [marketplaceFee, setMarketplaceFee] = useState('');
  const [shippingCost, setShippingCost] = useState('');

  const [openContactSelect, setOpenContactSelect] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [showCreateContact, setShowCreateContact] = useState(false);

  useEffect(() => {
    if (open) {
      if (editDocumentId && snapshot) {
        const doc = snapshot.documents.find(d => d.id === editDocumentId);
        if (doc) {
          // Map backend type to FlowType
          setFlowType((doc.type === 'venda' || doc.type === 'receita') ? 'entrada' : 'saida');
          setContactId(doc.contactId);
          setCategoryId(doc.categoryId);
          setCompetenceDate(doc.competenceDate);
          setTotalValue(doc.totalValue.toString());
          setDescription(doc.description);
          setCondition(doc.condition);
          setInstallments(doc.installments.toString());
          setSituation('previsto');
          setPaymentAccountId('');
          const docTitles = snapshot.titles.filter(t => t.documentId === editDocumentId);
          if (docTitles.length > 0) setDueDate(docTitles[0].dueDate);
          setIsLocked(docTitles.some(t => t.status === 'pago' || t.status === 'recebido'));
        }
      } else {
        setFlowType(defaultSide === 'pagar' ? 'saida' : 'entrada');
        setContactId('');
        setCategoryId('');
        const today = new Date().toISOString().split('T')[0];
        setCompetenceDate(today);
        setDueDate(today);
        setHasManuallySetDueDate(false);
        setTotalValue('');
        setDescription('');
        setCondition('avista');
        setInstallments('2');
        setSituation('previsto');
        setPaymentDate(today);
        setPaymentAccountId('');
        setInstallmentsGrid([]);
        setHasManualEdits(false);
        setAutoAdjustRemainder(true);
        setIsLocked(false);
        setSaveStep('idle');
      }
    }
  }, [open, editDocumentId, snapshot, defaultSide]);

  useEffect(() => {
    if (!hasManuallySetDueDate && !editDocumentId) {
      setDueDate(competenceDate);
    }
  }, [competenceDate, hasManuallySetDueDate, editDocumentId]);

  useEffect(() => {
    if (isMarketplace) {
      const gross = parseFloat(grossAmount) || 0;
      const fee = parseFloat(marketplaceFee) || 0;
      const shipping = parseFloat(shippingCost) || 0;
      // Precision handle
      const net = Math.round((gross - fee - shipping) * 100) / 100;
      if (!isNaN(net)) setTotalValue(net.toString());
    }
  }, [isMarketplace, grossAmount, marketplaceFee, shippingCost]);

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
        if (index === next.length - 1 && next.length > 1) {
          adjustIndex = next.length - 2;
        }
        for (let i = 0; i < next.length; i++) {
          if (i !== adjustIndex) sumOthers += next[i].value;
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

  // Derive mapped types for helpers
  const mappedDocumentType = (flowType === 'entrada' ? 'receita' : 'despesa') as DocumentType;
  const isReceita = flowType === 'entrada';
  
  const filteredContacts = filterContactsForDocumentType(activeContacts, mappedDocumentType);
  const filteredCategories = filterCategoriesForDocumentType(activeCategories, mappedDocumentType);
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
      const result = await createContact({ name, type: isReceita ? 'cliente' : 'fornecedor' });
      setContactId(result.id);
      setShowCreateContact(false);
      setContactSearch('');
    } catch (e) {
      toast({ title: 'Erro', description: 'Erro ao criar contato.', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    if (situation === 'realizado' && condition === 'parcelado') {
      toast({ title: 'Atenção', description: 'Pagamentos parcelados não podem ser liquidados na criação. Mude para à vista ou salve como previsto.', variant: 'destructive' });
      return;
    }
    if (situation === 'realizado' && !paymentAccountId) {
      toast({ title: 'Atenção', description: 'Selecione a conta para realizar a baixa.', variant: 'destructive' });
      return;
    }
    if (!contactId || !categoryId || !totalValue || !competenceDate) {
      toast({ title: 'Atenção', description: 'Preencha os campos obrigatórios.', variant: 'destructive' });
      return;
    }
    if (condition === 'parcelado') {
      const sumParts = installmentsGrid.reduce((acc, curr) => acc + curr.value, 0);
      const total = parseFloat(totalValue) || 0;
      if (Math.abs(sumParts - total) > 0.01) {
          toast({ title: 'Atenção', description: 'A soma das parcelas deve ser igual ao valor total.', variant: 'destructive' });
          return;
      }
    }

    try {
      setSaveStep('creating');
      const payload = {
        type: mappedDocumentType, // Internal mapped type
        contactId,
        categoryId,
        competenceDate,
        totalValue: parseFloat(totalValue) || 0,
        description,
        condition,
        installments: condition === 'parcelado' ? parseInt(installments) || 1 : 1,
        customInstallments: condition === 'parcelado' && hasManualEdits ? installmentsGrid : undefined,
        firstDueDate: dueDate !== competenceDate ? dueDate : undefined,
        grossAmount: isMarketplace ? parseFloat(grossAmount) : undefined,
        marketplaceFee: isMarketplace ? parseFloat(marketplaceFee) : undefined,
        shippingCost: isMarketplace ? parseFloat(shippingCost) : undefined,
      };

      if (editDocumentId) {
        await updateDocument({ documentId: editDocumentId, payload });
        toast({ title: 'Lançamento atualizado com sucesso!' });
        onOpenChange(false);
        onSuccess?.();
      } else {
        const result = await createDocument({ payload, payNow: false });
        
        if (situation === 'realizado' && result.titles.length > 0) {
           setSaveStep('settling');
           try {
             await settleTitle({
               titleId: result.titles[0].id,
               accountId: paymentAccountId,
               paymentDate: paymentDate,
               valuePaid: parseFloat(totalValue) // Preparando para descontos/juros depois
             });
             toast({ title: 'Lançamento e baixa registrados com sucesso!' });
             onOpenChange(false);
             onSuccess?.();
           } catch (e) {
             toast({ 
               title: 'Atenção', 
               description: 'Lançamento criado, mas não foi possível registrar a baixa. Clique no lançamento para concluir a baixa.', 
               variant: 'destructive' 
             });
             onOpenChange(false);
             onSuccess?.();
           }
        } else {
           toast({ title: 'Lançamento criado com sucesso!' });
           onOpenChange(false);
           onSuccess?.();
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar lançamento.';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    } finally {
      if (saveStep !== 'settling') setSaveStep('idle');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, nextElementId?: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextElementId) {
        const nextEl = document.getElementById(nextElementId);
        if (nextEl) nextEl.focus();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 w-[95vw] max-w-4xl p-0 max-h-[90vh] overflow-hidden rounded-xl">
        <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
          <DialogTitle className="text-2xl">{editDocumentId ? 'Editar Lançamento' : 'Novo Lançamento'}</DialogTitle>
          <DialogDescription>
            {editDocumentId ? 'Altere as informações deste lançamento.' : 'Registre de forma rápida e guiada.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
          {isLocked && (
            <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-lg flex items-center gap-2 border border-destructive/20 -mb-4">
              <strong>Aviso:</strong> Este lançamento possui parcelas pagas/recebidas. Opções financeiras estão bloqueadas. Para alterar valores, estorne as baixas primeiro.
            </div>
          )}

          {/* 1. Tipo */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">1. Tipo</h3>
            <div className="bg-card shadow-sm p-5 rounded-xl border space-y-4">
              <RadioGroup 
                value={flowType} 
                disabled={isLocked}
                onValueChange={v => {
                  setFlowType(v as FlowType);
                  setContactId('');
                  setCategoryId('');
                }} 
                className="flex flex-col sm:flex-row gap-6"
              >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="entrada" id="type-entrada" />
                    <Label htmlFor="type-entrada" className="font-medium cursor-pointer text-base">Entrada de dinheiro</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="saida" id="type-saida" />
                    <Label htmlFor="type-saida" className="font-medium cursor-pointer text-base">Saída de dinheiro</Label>
                  </div>
              </RadioGroup>
            </div>
          </div>

          {/* 2. Com quem + categoria */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">2. Com quem + categoria</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-card shadow-sm p-5 rounded-xl border">
              <div className="space-y-2">
                <Label>{isReceita ? 'Cliente' : 'Fornecedor'} <span className="text-destructive">*</span></Label>
                <Popover open={openContactSelect} onOpenChange={setOpenContactSelect}>
                  <PopoverTrigger asChild>
                    <Button id="contact-trigger" variant="outline" role="combobox" aria-expanded={openContactSelect} className="w-full justify-between font-normal bg-background">
                      {contactId ? filteredContacts.find((c) => c.id === contactId)?.name || 'Selecione...' : "Selecione..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar contato..." value={contactSearch} onValueChange={setContactSearch} />
                      <CommandList>
                        <CommandEmpty className="px-2 py-3 text-sm text-center">
                          <span className="text-muted-foreground block mb-2">Nenhum contato encontrado.</span>
                          {contactSearch.trim() && (
                            <Button variant="ghost" size="sm" className="w-full justify-start text-primary" onClick={() => handleOpenCreateContact(contactSearch)}>
                              <Plus className="mr-2 h-4 w-4" /> Criar "{contactSearch}"
                            </Button>
                          )}
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredContacts.map(contact => (
                            <CommandItem key={contact.id} value={contact.name} onSelect={() => { setContactId(contact.id); setOpenContactSelect(false); setContactSearch(''); }}>
                              <Check className={`mr-2 h-4 w-4 ${contactId === contact.id ? "opacity-100" : "opacity-0"}`} /> {contact.name}
                            </CommandItem>
                          ))}
                          {!exactContactMatch && contactSearch.trim() !== '' && (
                            <CommandItem value={contactSearch} onSelect={() => handleOpenCreateContact(contactSearch)} className="text-primary font-medium mt-1">
                              <Plus className="mr-2 h-4 w-4" /> Criar "{contactSearch}"
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
            </div>
          </div>

          {/* 3. Valor + vencimento */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">3. Valor + vencimento</h3>
              {isReceita && (
                <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                  <Switch id="mkt-mode" checked={isMarketplace} onCheckedChange={setIsMarketplace} />
                  <Label htmlFor="mkt-mode" className="text-xs font-bold text-primary cursor-pointer uppercase tracking-tight">Modo Marketplace</Label>
                </div>
              )}
            </div>

            <div className="space-y-4 bg-card shadow-sm p-5 rounded-xl border">
              {isMarketplace ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Valor Bruto (MKT)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-xs">R$</span>
                      <Input className="bg-background h-10 pl-8 font-medium" type="number" step="0.01" value={grossAmount} onChange={e => setGrossAmount(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Comissão / Taxas</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-xs">R$</span>
                      <Input className="bg-background h-10 pl-8 font-medium text-negative" type="number" step="0.01" value={marketplaceFee} onChange={e => setMarketplaceFee(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Frete / Logística</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-xs">R$</span>
                      <Input className="bg-background h-10 pl-8 font-medium text-negative" type="number" step="0.01" value={shippingCost} onChange={e => setShippingCost(e.target.value)} />
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                <div className="space-y-2">
                  <Label className={isMarketplace ? "text-xs uppercase text-primary font-bold" : ""}>
                    {isMarketplace ? 'Valor Líquido a Receber' : 'Valor Total'} <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
                    <Input 
                      autoFocus 
                      readOnly={isMarketplace}
                      id="valor-input" 
                      onKeyDown={(e) => handleKeyDown(e, 'contact-trigger')} 
                      className={`bg-background font-semibold text-xl h-12 pl-10 ${isMarketplace ? 'bg-primary/5 border-primary/30 text-primary' : ''}`} 
                      disabled={isLocked} 
                      type="number" 
                      step="0.01" 
                      placeholder="0,00" 
                      value={totalValue} 
                      onChange={e => setTotalValue(e.target.value)} 
                    />
                    {isMarketplace && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-primary font-bold uppercase">Calculado</div>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-[11px] uppercase text-muted-foreground">Data da Venda</Label>
                    <Input className="bg-background h-12 text-center" disabled={isLocked} type="date" value={competenceDate} onChange={e => setCompetenceDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] uppercase text-muted-foreground">Data Vencimento</Label>
                    <Input 
                      className={`bg-background h-12 text-center transition-colors ${dueDate !== competenceDate ? 'border-primary/50 bg-primary/5 font-semibold' : ''}`} 
                      disabled={isLocked} 
                      type="date" 
                      value={dueDate} 
                      onChange={e => {
                        setDueDate(e.target.value);
                        setHasManuallySetDueDate(true);
                      }} 
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Situação */}
          {!editDocumentId && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">4. Situação</h3>
              <div className={`p-5 rounded-xl border shadow-sm space-y-5 transition-colors ${situation === 'realizado' ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}>
                <RadioGroup 
                   value={situation} 
                   onValueChange={(v: 'previsto' | 'realizado') => setSituation(v)} 
                   className="flex flex-col sm:flex-row gap-8"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="previsto" id="sit-previsto" />
                    <Label htmlFor="sit-previsto" className="font-medium cursor-pointer text-base">Ainda vai acontecer (Previsto)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="realizado" id="sit-realizado" />
                    <Label htmlFor="sit-realizado" className="font-medium cursor-pointer text-base">Já aconteceu (Pago/Recebido)</Label>
                  </div>
                </RadioGroup>

                {situation === 'realizado' && condition === 'parcelado' ? (
                  <div className="mt-6 p-4 rounded-md bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 animate-in fade-in">
                    Pagamentos parcelados não podem ser registrados como já realizados. Use "à vista" (na aba Condição abaixo) para habilitar a baixa imediata.
                  </div>
                ) : situation === 'realizado' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-5 border-t border-border/50 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <Label>Data do Pagamento <span className="text-destructive">*</span></Label>
                      <Input className="bg-background h-10" type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Conta Bancária / Caixa <span className="text-destructive">*</span></Label>
                      <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                        <SelectTrigger className="bg-background h-10 border-primary/30"><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
                        <SelectContent>
                          {activeAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* 5. Condição */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">5. Condição</h3>
            <div className="space-y-5 bg-card shadow-sm p-5 rounded-xl border">
              
              <RadioGroup value={condition} disabled={isLocked} onValueChange={(v: 'avista' | 'parcelado') => setCondition(v)} className="flex gap-8">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="avista" id="avista" disabled={isLocked} />
                  <Label htmlFor="avista" className={`font-medium cursor-pointer text-base ${isLocked ? 'text-muted-foreground' : 'text-foreground'}`}>À vista</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="parcelado" id="parcelado" disabled={isLocked} />
                  <Label htmlFor="parcelado" className={`font-medium cursor-pointer text-base ${isLocked ? 'text-muted-foreground' : 'text-foreground'}`}>Parcelado</Label>
                </div>
              </RadioGroup>

              {condition === 'parcelado' && (
                <div className="space-y-5 pt-5 border-t border-border/50 animate-in fade-in">
                  <div className="space-y-2">
                    <Label>Nº de parcelas</Label>
                    <div className="flex items-center gap-3">
                      <Input type="number" disabled={isLocked} min="2" max="48" value={installments} onChange={e => setInstallments(e.target.value)} className="w-24 bg-background" />
                      <div className="flex gap-2">
                        {[2, 3, 4, 6].map(n => (
                          <Button key={n} type="button" disabled={isLocked} variant="outline" size="sm" className="h-10 px-4 mt-0" onClick={() => setInstallments(n.toString())}>
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
                            <Switch id="auto-adjust" disabled={isLocked} checked={autoAdjustRemainder} onCheckedChange={setAutoAdjustRemainder} />
                            <Label htmlFor="auto-adjust" className="text-xs font-medium cursor-pointer text-muted-foreground">Ajuste automático</Label>
                          </div>
                          {hasManualEdits && !isLocked && (
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
                              disabled={isLocked}
                              value={p.dueDate} 
                              onChange={e => handleInstallmentChange(idx, 'dueDate', e.target.value)} 
                              className="flex-1 text-sm h-8 border-transparent hover:border-border focus:border-ring transition-colors"
                            />
                            <div className="relative">
                              <span className="absolute left-2 top-1.5 text-xs text-muted-foreground">R$</span>
                              <Input 
                                type="number" 
                                step="0.01"
                                disabled={isLocked}
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

          {/* 6. (opcional) Descrição */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">6. (opcional) Descrição</h3>
            <div className="bg-card shadow-sm p-5 rounded-xl border space-y-2">
              <Label>Descrição</Label>
              <Textarea className="bg-background resize-none" placeholder="Observações, referências, etc" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
            </div>
          </div>

        </div>

        <div className="p-4 sm:px-6 sm:py-4 border-t bg-muted/20 flex gap-4 mt-auto rounded-b-xl items-center justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="px-6">Cancelar</Button>
          <Button disabled={isPending} onClick={handleSave} className="px-8 font-semibold relative min-w-[160px]">
            {saveStep === 'creating' ? 'Criando lançamento...' : 
             saveStep === 'settling' ? 'Efetuando baixa...' : 
             isUpdating ? 'Salvando...' : (
              condition === 'parcelado' ? `Criar ${installments} parcelas` :
              (situation === 'realizado' ? 'Salvar e baixar' : (editDocumentId ? 'Salvar alterações' : 'Salvar lançamento'))
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
              <Input value={contactSearch} onChange={e => setContactSearch(e.target.value)} placeholder="Ex: João da Silva" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateContact(false)} disabled={creatingContact}>Cancelar</Button>
            <Button onClick={handleCreateContactSubmit} disabled={!contactSearch.trim() || creatingContact}>
              {creatingContact ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
