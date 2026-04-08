import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthRedirectPath } from '@/utils/navigation';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Usamos um mode state simples para alternar entre entrar e criar conta
  const [isSignUp, setIsSignUp] = useState(searchParams.get('signup') === 'true');

  // Estados para o Modal de Reset
  const [resetEmail, setResetEmail] = useState('');
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login: Fluxo de login/cadastro iniciado (submit)');
    setIsLoading(true);
    setError(null);

    const isMockMode = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (isMockMode) {
      console.warn('Modo Offline: Login simulado.');
      setTimeout(() => {
        // Redireciona forçando reload para que o AuthContext pegue o estado mockado
        window.location.href = '/'; 
      }, 500);
      return;
    }

    const authFn = isSignUp ? supabase.auth.signUp.bind(supabase.auth) : supabase.auth.signInWithPassword.bind(supabase.auth);

    console.log(`Login: Autenticando com Supabase (${isSignUp ? 'signUp' : 'signIn'})...`);
    const { data, error } = await authFn({ email, password });

    if (error) {
      console.error('Login: Erro de autenticação recebido', error.message);
      if (error.message === 'Email not confirmed') {
        setError('E-mail pendente de confirmação. Por favor, verifique sua caixa de entrada.');
      } else if (error.message === 'Invalid login credentials') {
        setError('E-mail ou senha incorretos.');
      } else {
        setError(error.message);
      }
    } else if (isSignUp) {
      console.log('Login: Sucesso no cadastro');
      setError('Conta criada! Verifique seu e-mail para confirmar o cadastro antes de entrar.');
    } else {
      console.log('Login: Login sucesso! Sessão recebida com token:', data.session?.access_token ? 'Presente' : 'Ausente');
      if (data.session) {
        console.log('Login: Redirecionamento executado direto após o signIn');
        navigate(getAuthRedirectPath(), { replace: true });
      }
    }

    setIsLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    
    setIsResetLoading(true);
    const isMockMode = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (isMockMode) {
      setTimeout(() => {
        toast({
          title: "E-mail enviado (Mock Mode)",
          description: "No modo offline o e-mail não é enviado de verdade.",
        });
        setIsResetLoading(false);
        setIsResetModalOpen(false);
        setResetEmail('');
      }, 800);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setIsResetLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao solicitar recuperação",
        description: error.message,
      });
    } else {
      toast({
        title: "Link enviado!",
        description: "Se o e-mail existir, você receberá um link de redefinição.",
      });
      setIsResetModalOpen(false);
      setResetEmail('');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-4 flex flex-col items-center">
          <div className="flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-1000 mb-8">
            <img 
              src="/aurys-logo-dark.png" 
              alt="Aurys" 
              className="h-[100px] w-auto object-contain" 
            />
          </div>
          <p className="text-muted-foreground text-sm animate-in fade-in duration-1000 delay-300">
            {isSignUp ? 'Crie sua conta para começar' : 'Acesse sua conta'}
          </p>
        </div>

        <div className="bg-card border shadow-sm rounded-xl p-6">
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                {!isSignUp && (
                  <Dialog open={isResetModalOpen} onOpenChange={setIsResetModalOpen}>
                    <DialogTrigger asChild>
                      <button type="button" className="text-xs text-primary hover:underline" tabIndex={-1}>
                        Esqueci minha senha
                      </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Redefinir senha</DialogTitle>
                        <DialogDescription>
                          Digite seu e-mail e enviaremos um link seguro para você alterar sua senha.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleResetPassword} className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label htmlFor="reset-email">E-mail</Label>
                          <Input
                            id="reset-email"
                            type="email"
                            placeholder="seu@email.com"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            required
                          />
                        </div>
                        <Button type="submit" className="w-full h-11" disabled={isResetLoading || !resetEmail}>
                          {isResetLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Enviar link de redefinição
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {error && (
              <p className={`text-sm ${error.includes('Verifique') || error.includes('criada') ? 'text-positive' : 'text-destructive'}`}>
                {error}
              </p>
            )}

            <Button type="submit" className="w-full h-11" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isSignUp ? 'Criar Conta' : 'Entrar'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {isSignUp ? 'Já tem uma conta? Entre aqui' : 'Não tem conta? Crie uma'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
