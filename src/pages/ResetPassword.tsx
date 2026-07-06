import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 'checking' — aguardando a sessão do Supabase ser estabelecida
  // 'ready'    — sessão de recuperação ativa, pode salvar nova senha
  // 'invalid'  — link inválido/expirado
  const [sessionState, setSessionState] = useState<'checking' | 'ready' | 'invalid'>('checking');

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // O Supabase processa o token/code da URL de forma assíncrona.
    // Precisamos aguardar o evento para garantir que a sessão está ativa
    // antes de permitir que o usuário salve a nova senha.

    // Verifica se já há sessão (caso o token já tenha sido processado)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionState('ready');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY' && session) {
          // Fluxo implicit: evento correto, sessão de recuperação ativa
          setSessionState('ready');
        } else if (event === 'SIGNED_IN' && session) {
          // Fluxo PKCE: dispara SIGNED_IN em vez de PASSWORD_RECOVERY.
          // Confiamos que chegamos aqui via link de recuperação (a URL tem type=recovery ou code=).
          const isRecoveryUrl =
            window.location.hash.includes('type=recovery') ||
            window.location.search.includes('code=');
          if (isRecoveryUrl) setSessionState('ready');
        }
      }
    );

    // Timeout de segurança: se após 10 s não houver sessão, link expirado
    const timeout = setTimeout(() => {
      setSessionState(prev => prev === 'checking' ? 'invalid' : prev);
    }, 10_000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    setIsLoading(true);

    const isMockMode = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (isMockMode) {
      setTimeout(() => {
        toast({ title: "Senha atualizada (Mock Mode)", description: "Sua senha foi alterada com sucesso." });
        navigate('/login');
      }, 800);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setIsLoading(false);

    if (updateError) {
      // Sessão de recuperação ausente/expirada — link inválido
      if (/session|missing|expired|invalid|token/i.test(updateError.message)) {
        setSessionState('invalid');
      } else {
        setError('Não foi possível alterar a senha agora. Tente novamente em alguns minutos.');
      }
    } else {
      toast({
        title: "Senha alterada com sucesso.",
        description: "Entre novamente com a sua nova senha.",
      });
      await supabase.auth.signOut();
      navigate('/login');
    }
  };

  // Enquanto aguarda a sessão do Supabase ser processada
  if (sessionState === 'checking') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Verificando link de recuperação...</span>
        </div>
      </div>
    );
  }

  // Link expirado ou inválido
  if (sessionState === 'invalid') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Link expirado ou inválido</h1>
          <p className="text-muted-foreground text-sm">
            Este link expirou ou é inválido. Solicite uma nova redefinição de senha.
          </p>
          <Button className="w-full" onClick={() => navigate('/login')}>
            Voltar ao login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Criar nova senha</h1>
          <p className="text-muted-foreground text-sm">Digite sua nova senha de acesso</p>
        </div>

        <div className="bg-card border shadow-sm rounded-xl p-6">
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Mínimo de 6 caracteres"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Digite a senha novamente"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Alterar senha
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Voltar ao login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
