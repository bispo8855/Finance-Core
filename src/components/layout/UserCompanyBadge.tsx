import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

export function UserCompanyBadge() {
  const { user, isLoading } = useAuth();

  const { companyName, userName, initials } = useMemo(() => {
    if (!user) return { companyName: 'Minha Empresa', userName: 'Visitante', initials: 'V' };

    // Tentar extrair do metadata (caso seu sistema grave lá no futuro)
    const rawCompany = user.user_metadata?.company_name || 'Minha Empresa';
    
    // Tentar extrair do Display Name, full_name, ou usar prefixo do email
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário';
    
    // Pegar 1 ou 2 iniciais para o Avatar
    const names = fullName.split(' ');
    const init = names.length > 1 
      ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
      : names[0].substring(0, 2).toUpperCase();

    return {
      companyName: rawCompany,
      userName: fullName,
      initials: init
    };
  }, [user]);

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
    <div className="flex items-center gap-3">
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
    </div>
  );
}
