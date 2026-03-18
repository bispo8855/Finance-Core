import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tags, Plus, Trash2, Pencil } from 'lucide-react';
import { CategoryType, Category } from '@/types/financial';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/finance/useCatalogs';

const typeLabels: Record<CategoryType, string> = {
  receita: 'Receita', custo: 'Custo', despesa: 'Despesa', investimento: 'Investimento', financeiro: 'Financeiro',
};
const typeColors: Record<CategoryType, string> = {
  receita: 'bg-success-subtle text-positive',
  custo: 'bg-warning-subtle text-warning',
  despesa: 'bg-destructive-subtle text-negative',
  investimento: 'bg-accent text-accent-foreground',
  financeiro: 'bg-muted text-muted-foreground',
};

export default function Categories() {
  const { categories } = useCategories();
  const { mutateAsync: addCategory, isPending: isAdding } = useCreateCategory();
  const { mutateAsync: updateCategory, isPending: isUpdating } = useUpdateCategory();
  const { mutateAsync: deleteCategory, isPending: isDeleting } = useDeleteCategory();
  
  const activeCategories = categories.filter(c => c.isActive !== false);

  const [open, setOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>('despesa');

  const openCreateModal = () => {
    setModalMode('create');
    setEditingId(null);
    setName('');
    setType('despesa');
    setOpen(true);
  };

  const openEditModal = (category: Category) => {
    setModalMode('edit');
    setEditingId(category.id);
    setName(category.name);
    setType(category.type);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    
    const payload = { name: name.trim(), type };
    if (modalMode === 'create') {
      await addCategory(payload);
    } else if (modalMode === 'edit' && editingId) {
      await updateCategory({ id: editingId, payload });
    }
    
    setOpen(false);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Tags className="w-5 h-5 text-accent-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Categorias</h1>
        </div>
        <Button size="sm" onClick={openCreateModal} className="gap-1.5" disabled={isAdding || isUpdating || isDeleting}>
          <Plus className="w-4 h-4" /> Nova Categoria
        </Button>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="divide-y">
          {activeCategories.map(c => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{c.name}</span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${typeColors[c.type]}`}>
                  {typeLabels[c.type]}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEditModal(c)} disabled={isDeleting || isUpdating}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-negative" onClick={() => deleteCategory(c.id)} disabled={isDeleting || isUpdating}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {activeCategories.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma categoria encontrada.</p>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{modalMode === 'create' ? 'Nova Categoria' : 'Editar Categoria'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Marketing Digital" disabled={isAdding || isUpdating} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={v => setType(v as CategoryType)} disabled={isAdding || isUpdating}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isAdding || isUpdating}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isAdding || isUpdating || !name.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
