import { SidebarTrigger } from '@/components/ui/sidebar';
import { UserCompanyBadge } from './UserCompanyBadge';
import { APP_CONFIG } from '@/config/app';

export function AppHeader() {
  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 gap-4 shrink-0">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        {/* Exibe o logo novo apenas no mobile (quando a Sidebar normalmente some) */}
        <div className="flex md:hidden items-center">
          <img src="/aurys-logo-dark.png" alt={APP_CONFIG.name} className="h-8 w-auto object-contain" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <UserCompanyBadge />
      </div>
    </header>
  );
}
