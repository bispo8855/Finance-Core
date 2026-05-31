import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserCompanyBadge() {
  const { user, profile, activeWorkspace, isLoading, signOut } = useAuth();

  const { companyName, userName, initials } = useMemo(() => {
    if (!user) return { companyName: 'Minha Empresa', userName: 'Visitante', initials: 'V' };

    const wName = activeWorkspace?.name || 'Minha Empresa';
    const uName = profile?.displayName || profile?.fullName || user.email?.split('@')[0] || 'Usuário';
    
    let init = '';
    if (activeWorkspace?.avatarInitials) {
      init = activeWorkspace.avatarInitials;
    } else {
      const names = wName.split(' ').filter(Boolean);
      if (names.length > 1) {
        init = `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      } else {
        init = wName.substring(0, 2).toUpperCase();
      }
    }

    return {
      companyName: wName,
      userName: uName,
      initials: init
    };
  }, [user, profile, activeWorkspace]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-end gap-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
    );
  }

  // Só mostra se houver usuário
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-3 outline-none cursor-pointer p-1.5 rounded-lg hover:bg-muted/60 transition-colors focus-visible:ring-2 focus-visible:ring-ring">
        <div className="hidden md:flex flex-col text-right">
          <span className="text-sm font-semibold leading-tight text-foreground truncate max-w-[150px]">
            {companyName}
          </span>
          <span className="text-xs text-muted-foreground leading-tight truncate max-w-[150px]">
            {userName}
          </span>
        </div>
        
        <Avatar className="h-9 w-9 border border-border/50">
          <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56 mt-2">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{userName}</p>
            <p className="text-xs leading-none text-muted-foreground">{companyName}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive cursor-pointer py-2">
          <LogOut className="mr-2 h-4 w-4" />
          <span className="font-medium">Sair (Logout)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
