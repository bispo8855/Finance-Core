import { SidebarTrigger } from '@/components/ui/sidebar';
import { UserCompanyBadge } from './UserCompanyBadge';
import { APP_CONFIG } from '@/config/app';

export function AppHeader() {
  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 gap-4 shrink-0">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        {/* Exibe o logo e o nome apenas no mobile (quando a Sidebar normalmente some) */}
        <div className="flex md:hidden items-center gap-2">
          <img src={APP_CONFIG.favicon} alt={APP_CONFIG.name} className="h-6 w-6 object-contain" />
          <span className="font-bold text-sm tracking-tight">{APP_CONFIG.name}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <UserCompanyBadge />
      </div>
    </header>
  );
}
