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
    try {
      console.log('AuthContext: Buscando perfil...');
      const p = await financeService.getProfile();
      setProfile(p);

      console.log('AuthContext: Buscando/Garantindo workspace...');
      const ws = await financeService.ensureDefaultWorkspaceForUser();
      setActiveWorkspace(ws);
    } catch (err) {
      console.error('AuthContext: Erro ao carregar perfil e/ou workspace', err);
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
    const updated = await financeService.updateActiveWorkspace(payload);
    setActiveWorkspace(updated);
  };

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
    }, 8000); // Elevamos para 8 segundos para dar tempo do perfil/workspace carregarem

    console.log('AuthContext: Iniciando busca de sessão inicial...');
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.error('AuthContext: Erro ao buscar sessão inicial', error);
        clearTimeout(safetyTimer);
        setIsLoading(false);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session) {
        console.log('AuthContext: Sessão inicial encontrada, carregando dados adicionais...');
        await loadProfileAndWorkspace(session.user.id);
      }
      clearTimeout(safetyTimer);
      setIsLoading(false);
    }).catch(err => {
      clearTimeout(safetyTimer);
      console.error('AuthContext: Falha catastrófica ao obter sessão', err);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`AuthContext: Mudança de estado detectada -> [${event}]`);
      setSession(session);
      setUser(session?.user ?? null);

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      } else {
        setIsPasswordRecovery(false);
      }

      if (session) {
        await loadProfileAndWorkspace(session.user.id);
      } else {
        setProfile(null);
        setActiveWorkspace(null);
      }
      setIsLoading(false);
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
