import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Users, Plus, Trash2, Pencil } from 'lucide-react';
import { ContactType, Contact } from '@/types/financial';
import { useContacts, useCreateContact, useDeleteContact, useUpdateContact } from '@/hooks/finance/useCatalogs';
import { ContactFormModal } from '@/components/shared/ContactFormModal';

export default function Contacts() {
  const { contacts } = useContacts();
  const { mutateAsync: addContact, isPending: isAdding } = useCreateContact();
  const { mutateAsync: updateContact, isPending: isUpdating } = useUpdateContact();
  const { mutateAsync: deleteContact, isPending: isDeleting } = useDeleteContact();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [contactToEdit, setContactToEdit] = useState<Partial<Contact> | undefined>();

  const [tab, setTab] = useState<'todos' | 'cliente' | 'fornecedor'>('todos');

  const activeContacts = contacts.filter(c => c.isActive !== false);
  const filtered = tab === 'todos' ? activeContacts : activeContacts.filter(c => c.type === tab);

  const openCreateModal = () => {
    setModalMode('create');
    setContactToEdit(undefined);
    setModalOpen(true);
  };

  const openEditModal = (contact: Contact) => {
    setModalMode('edit');
    setContactToEdit(contact);
    setModalOpen(true);
  };

  const handleModalSubmit = async (values: Omit<Contact, 'id'>) => {
    if (modalMode === 'create') {
      await addContact(values);
    } else if (modalMode === 'edit' && contactToEdit?.id) {
      await updateContact({ id: contactToEdit.id, payload: values });
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Users className="w-5 h-5 text-accent-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Contatos</h1>
        </div>
        <Button size="sm" onClick={openCreateModal} className="gap-1.5" disabled={isAdding || isUpdating || isDeleting}>
          <Plus className="w-4 h-4" /> Novo Contato
        </Button>
      </div>

      <div className="flex gap-1 bg-muted rounded-lg p-0.5 w-fit">
        {(['todos', 'cliente', 'fornecedor'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${tab === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {t === 'todos' ? 'Todos' : t === 'cliente' ? 'Clientes' : 'Fornecedores'}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="divide-y">
          {filtered.map(c => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${c.type === 'cliente' ? 'bg-success-subtle text-positive' : 'bg-accent text-accent-foreground'}`}>
                    {c.type === 'cliente' ? 'Cliente' : 'Fornecedor'}
                  </span>
                </div>
                {(c.document || c.email || c.phone) && (
                  <p className="text-xs text-muted-foreground">{[c.document, c.email, c.phone].filter(Boolean).join(' · ')}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEditModal(c)} disabled={isDeleting || isUpdating}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-negative" onClick={() => deleteContact(c.id)} disabled={isDeleting || isUpdating}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum contato encontrado.</p>
          )}
        </div>
      </div>

      <ContactFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={modalMode}
        initialValues={contactToEdit}
        onSubmit={handleModalSubmit}
        isPending={isAdding || isUpdating}
      />
    </div>
  );
}
