import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContactType, Contact } from '@/types/financial';
import { Textarea } from '@/components/ui/textarea';

export interface ContactFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialValues?: Partial<Contact>;
  onSubmit: (values: Omit<Contact, 'id'>) => Promise<void>;
  isPending?: boolean;
}

export function ContactFormModal({ open, onOpenChange, mode, initialValues, onSubmit, isPending }: ContactFormModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ContactType>('cliente');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && initialValues) {
        setName(initialValues.name || '');
        setType(initialValues.type || 'cliente');
        setDocument(initialValues.document || '');
        setEmail(initialValues.email || '');
        setPhone(initialValues.phone || '');
        setNotes(initialValues.notes || '');
      } else {
        setName('');
        setType('cliente');
        setDocument('');
        setEmail('');
        setPhone('');
        setNotes('');
      }
    }
  }, [open, mode, initialValues]);

  // Basic mask helper for phone
  const formatPhone = (val: string) => {
    const v = val.replace(/\D/g, '');
    if (v.length <= 10) return v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    return v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '').slice(0, 15);
  };

  // Basic mask helper for CPF/CNPJ
  const formatDocument = (val: string) => {
    const v = val.replace(/\D/g, '');
    if (v.length <= 11) {
      return v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4').replace(/[.-]$/, '');
    }
    return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5').replace(/[./-]$/, '').slice(0, 18);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await onSubmit({ 
      name: name.trim(), 
      type,
      document: document.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined
    } as Omit<Contact, 'id'>);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Novo Contato' : 'Editar Contato'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_120px] gap-4">
            <div className="space-y-2">
              <Label>Nome <span className="text-destructive">*</span></Label>
              <Input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="Nome do contato" 
                disabled={isPending} 
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo <span className="text-destructive">*</span></Label>
              <Select value={type} onValueChange={v => setType(v as ContactType)} disabled={isPending}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="fornecedor">Fornecedor</SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CPF/CNPJ</Label>
              <Input 
                value={document} 
                onChange={e => setDocument(formatDocument(e.target.value))} 
                placeholder="000.000.000-00" 
                disabled={isPending} 
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input 
                value={phone} 
                onChange={e => setPhone(formatPhone(e.target.value))} 
                placeholder="(00) 00000-0000" 
                disabled={isPending} 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input 
              type="email"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="exemplo@email.com" 
              disabled={isPending} 
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder="Anotações adicionais sobre o contato..." 
              disabled={isPending} 
              className="resize-none h-20"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !name.trim()}>
            {isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
