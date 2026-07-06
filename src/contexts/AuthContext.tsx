import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { financeService } from '@/services/finance';
import { UserProfile, Workspace } from '@/services/finance/financeService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isPasswordRecovery: boolean;
  profile: UserProfile | null;
  activeWorkspace: Workspace | null;
  updateProfile: (payload: Partial<Omit<UserProfile, 'id'>>) => Promise<void>;
  updateActiveWorkspace: (payload: Partial<Omit<Workspace, 'id' | 'ownerId'>>) => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isPasswordRecovery: false,
  profile: null,
  activeWorkspace: null,
  updateProfile: async () => {},
  updateActiveWorkspace: async () => {},
  refreshWorkspace: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);

  const loadProfileAndWorkspace = async (userId: string) => {
    console.log('AuthContext: Buscando perfil...');
    try {
      const profileData = await financeService.getProfile();
      console.log('AuthContext: Perfil carregado', profileData);
      setProfile(profileData);
    } catch (profileErr) {
      console.error('AuthContext: Erro ao buscar perfil', profileErr);
      setProfile(null);
    }

    console.log('AuthContext: Garantindo workspace padrão...');
    try {
      const ensuredWorkspace = await financeService.ensureDefaultWorkspaceForUser();
      console.log('ensureDefaultWorkspaceForUser result', ensuredWorkspace);
    } catch (wsErr) {
      console.error('AuthContext: Erro ao garantir workspace padrão', wsErr);
    }

    console.log('AuthContext: Buscando workspace ativo...');
    try {
      const activeWs = await financeService.getActiveWorkspace();
      console.log('Workspace carregado no AuthContext', activeWs);
      setActiveWorkspace(activeWs);
    } catch (activeErr) {
      console.error('AuthContext: Erro ao buscar workspace ativo', activeErr);
      setActiveWorkspace(null);
    }
  };
  const refreshWorkspace = async () => {
    try {
      const ws = await financeService.getActiveWorkspace();
      setActiveWorkspace(ws);
    } catch (err) {
      console.error('AuthContext: Erro ao recarregar workspace', err);
    }
  };

  const updateProfileInContext = async (payload: Partial<Omit<UserProfile, 'id'>>) => {
    const updated = await financeService.updateProfile(payload);
    setProfile(updated);
  };

  const updateActiveWorkspaceInContext = async (payload: Partial<Omit<Workspace, 'id' | 'ownerId'>>) => {
    console.log('AuthContext: Atualizando workspace...', payload);
    // If we don't have an active workspace yet, ensure one exists first
    if (!activeWorkspace) {
      console.log('AuthContext: activeWorkspace null, garantindo workspace padrão antes de atualizar');
      const ws = await financeService.ensureDefaultWorkspaceForUser();
      console.log('AuthContext: Workspace padrão garantido', ws);
      setActiveWorkspace(ws);
    }
    const updated = await financeService.updateActiveWorkspace(payload);
    setActiveWorkspace(updated);
  };

  // Efeito secundário: Quando o ID do usuário mudar, busca as informações adicionais
  // sem bloquear os callbacks síncronos do Supabase Auth.
  useEffect(() => {
    const isMockMode = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (isMockMode) return;

    if (user) {
      console.log('AuthContext: [Efeito] Carregando perfil e workspace para userId', user.id);
      financeService.setUserId(user.id);
      setIsLoading(true);
      loadProfileAndWorkspace(user.id).finally(() => {
        setIsLoading(false);
      });
    } else {
      console.log('AuthContext: [Efeito] Nenhum usuário ativo, limpando perfil e workspace.');
      financeService.setUserId(null);
      setProfile(null);
      setActiveWorkspace(null);
    }
  }, [user?.id]);

  useEffect(() => {
    const isMockMode = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (isMockMode) {
      console.warn('Modo Offline: contornando verificação de sessão do Supabase.');
      setUser({ id: 'mock-user', email: 'teste@financaspro.com' } as User);
      setSession({ user: { id: 'mock-user', email: 'teste@financaspro.com' } } as unknown as Session);
      loadProfileAndWorkspace('mock-user').finally(() => {
        setIsLoading(false);
      });
      return;
    }

    const safetyTimer = setTimeout(() => {
      console.warn('AuthContext: Tempo limite de busca de sessão atingido. Forçando encerramento do loading.');
      setIsLoading(false);
    }, 8000); // 8 segundos de segurança

    // Detecta token de recuperação diretamente na URL (fallback para PKCE e implicit flow).
    // Garante que isPasswordRecovery seja true antes de qualquer redirect, independente
    // da ordem dos eventos do Supabase.
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const searchParams = new URLSearchParams(window.location.search);
    if (hashParams.get('type') === 'recovery' || searchParams.get('type') === 'recovery') {
      setIsPasswordRecovery(true);
    }

    console.log('AuthContext: Iniciando busca de sessão inicial...');
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('AuthContext: Erro ao buscar sessão inicial', error);
        clearTimeout(safetyTimer);
        setIsLoading(false);
        return;
      }

      console.log('AuthContext: getSession finalizado. Session ativa:', !!session);
      setSession(session);
      setUser(session?.user ?? null);

      if (!session) {
        clearTimeout(safetyTimer);
        setIsLoading(false);
      } else {
        clearTimeout(safetyTimer);
      }
    }).catch(err => {
      clearTimeout(safetyTimer);
      console.error('AuthContext: Falha catastrófica ao obter sessão', err);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`AuthContext: Mudança de estado detectada -> [${event}]`);
      setSession(session);
      setUser(session?.user ?? null);

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      } else if (event !== 'SIGNED_IN') {
        // Não reseta em SIGNED_IN: pode ser disparado logo após PASSWORD_RECOVERY,
        // o que sobrescreveria o flag e redirecionaria o usuário ao dashboard.
        setIsPasswordRecovery(false);
      }

      if (!session) {
        clearTimeout(safetyTimer);
        setIsLoading(false);
      } else {
        clearTimeout(safetyTimer);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('AuthContext: Erro ao fazer signOut no Supabase', error);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      setActiveWorkspace(null);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isPasswordRecovery,
        profile,
        activeWorkspace,
        updateProfile: updateProfileInContext,
        updateActiveWorkspace: updateActiveWorkspaceInContext,
        refreshWorkspace,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
