import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const isMockMode = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (isMockMode) {
      console.warn('Modo Offline: contornando verificação de sessão do Supabase.');
      // Simulando um usuário logado para testes locais
      setUser({ id: 'mock-user', email: 'teste@financaspro.com' } as User);
      setSession({ user: { id: 'mock-user', email: 'teste@financaspro.com' } } as unknown as Session);
      setIsLoading(false);
      return;
    }

    // Busca a sessão atual no load inicial
    console.log('AuthContext: Iniciando busca de sessão inicial...');
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('AuthContext: Erro ao buscar sessão inicial', error);
      } else if (session) {
        console.log('AuthContext: Sessão inicial encontrada (Usuário:', session.user.id, ')');
      } else {
        console.log('AuthContext: Nenhuma sessão inicial encontrada.');
      }
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    }).catch(err => {
      console.error('AuthContext: Falha catastrófica ao obter sessão', err);
      setIsLoading(false);
    });

    // Escuta mudanças de auth (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`AuthContext: Mudança de estado detectada -> [${event}]`);
      if (session) {
        console.log('AuthContext: Sessão recebida no listener (Usuário:', session.user.id, ')');
      } else {
        console.log('AuthContext: Sessão ausente no listener');
      }
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
