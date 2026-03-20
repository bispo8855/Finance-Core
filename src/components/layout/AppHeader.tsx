import { SidebarTrigger } from '@/components/ui/sidebar';
import { UserCompanyBadge } from './UserCompanyBadge';

export function AppHeader() {
  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 gap-4 shrink-0">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
      </div>
      <div className="flex items-center gap-4">
        <UserCompanyBadge />
      </div>
    </header>
  );
}
