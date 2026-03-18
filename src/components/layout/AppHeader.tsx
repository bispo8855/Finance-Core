import { useNavigate } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { UserCompanyBadge } from './UserCompanyBadge';

export function AppHeader() {
  const navigate = useNavigate();

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 gap-4 shrink-0">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <div className="hidden sm:flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 w-64">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="border-0 bg-transparent h-auto p-0 text-sm focus-visible:ring-0 shadow-none"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <UserCompanyBadge />
        
        <Button size="sm" onClick={() => navigate('/lancar')} className="gap-1.5">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Novo lançamento</span>
        </Button>
      </div>
    </header>
  );
}
