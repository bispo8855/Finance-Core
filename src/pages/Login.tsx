import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Usamos um mode state simples para alternar entre entrar e criar conta
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const authFn = isSignUp ? supabase.auth.signUp.bind(supabase.auth) : supabase.auth.signInWithPassword.bind(supabase.auth);

    const { error } = await authFn({ email, password });

    if (error) {
      setError(error.message);
    } else if (isSignUp) {
      setError('Conta criada! Verifique seu e-mail ou faça login (se o auto-confirm estiver ativado).');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Finanças<span className="text-primary">Core</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            {isSignUp ? 'Crie sua conta para começar' : 'Acesse sua conta para continuar'}
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
              <Label htmlFor="password">Senha</Label>
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

            <Button type="submit" className="w-full" disabled={isLoading}>
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

