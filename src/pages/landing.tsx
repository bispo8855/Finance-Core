import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, BarChart3, CheckCircle, Calculator, Users, Lightbulb, AlertTriangle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// Re‑use existing KPI card for a lightweight mockup
import { KPICard } from '@/components/shared/KPICard';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col">
      {/* HEADER */}
      <header className="container mx-auto px-4 py-4 flex items-center justify-between border-b border-muted/20">
        <div className="flex items-center gap-2">
          <img src="/favicon.png" alt="FinançasCore Logo" className="w-8 h-8" />
          <span className="text-xl font-bold tracking-tight text-foreground">
            Finanças<span className="text-primary">Core</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link to="/login">Entrar</Link>
          </Button>
        </div>
      </header>

      {/* HERO */}
      <section className="container mx-auto px-4 py-12 lg:py-16 flex flex-col-reverse lg:flex-row items-center gap-12">
        <div className="max-w-lg space-y-8">
          <div className="space-y-6">
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-foreground leading-[1.1]">
              Descubra em minutos se seu negócio está lucrando — e o que fazer a seguir
            </h1>
            <p className="text-xl text-muted-foreground font-medium">
              O FinançasCore não só organiza seus números — ele mostra o que está errado e como melhorar.
            </p>
          </div>
          
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-7 text-lg rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]">
                <Link to="/login?signup=true">Criar conta e entender meu resultado</Link>
              </Button>
              <Button variant="outline" asChild className="px-8 py-7 text-lg rounded-xl hidden md:inline-flex border-2">
                <Link to="/login">Entrar</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground/80 font-medium ml-1 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              Empreendedores já usam o FinançasCore para tomar decisões com mais clareza.
            </p>
          </div>
        </div>

        {/* Mockup dashboard cards */}
        <div className="flex flex-col gap-4 w-full max-w-md animate-in fade-in slide-in-from-right-4 duration-1000">
          <KPICard
            title="Receita Líquida"
            value="R$ 28.450,00"
            icon={BarChart3}
          />
          <KPICard
            title="Resultado Líquido"
            value="R$ 6.320,00"
            icon={CheckCircle}
          />
          <KPICard
            title="Margem"
            value="22%"
            icon={Calculator}
          />
        </div>
      </section>

      {/* TENSION SECTION */}
      <section className="bg-primary/5 py-12 lg:py-16 border-y border-primary/10">
        <div className="container mx-auto px-4 max-w-3xl text-center space-y-10">
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground leading-tight">
            Você pode estar vendendo bem… e mesmo assim perdendo dinheiro — sem perceber.
          </h2>
          
          <div className="grid gap-6 text-left max-w-xl mx-auto">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-background border shadow-sm">
              <div className="bg-red-100 p-2 rounded-lg"><Zap className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="font-bold">Vende bem, mas o dinheiro some</p>
                <p className="text-sm text-muted-foreground">O caixa está sempre zerado mesmo com faturamento alto.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 rounded-xl bg-background border shadow-sm">
              <div className="bg-amber-100 p-2 rounded-lg"><Users className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="font-bold">Dúvida constante para crescer</p>
                <p className="text-sm text-muted-foreground">Não sabe se pode contratar, investir ou se deve segurar.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 rounded-xl bg-background border shadow-sm">
              <div className="bg-blue-100 p-2 rounded-lg"><AlertTriangle className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="font-bold">O problema só aparece quando é tarde</p>
                <p className="text-sm text-muted-foreground">Descobre prejuízos só no final do mês ou quando falta saldo.</p>
              </div>
            </div>
          </div>

          <p className="text-xl font-extrabold text-primary">
            Sem clareza, você não toma decisões. Você reage.
          </p>
        </div>
      </section>

      {/* INTELLIGENCE SECTION */}
      <section className="py-16">
        <div className="container mx-auto px-4 space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
              Seu financeiro que pensa com você — e te orienta
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="bg-background border rounded-2xl p-8 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center">
                <BarChart3 className="text-primary w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">Entenda o que está acontecendo</h3>
              <p className="text-muted-foreground">Veja com clareza seu lucro, margem e resultado real do negócio.</p>
            </div>
            <div className="bg-background border rounded-2xl p-8 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="bg-amber-100 w-12 h-12 rounded-xl flex items-center justify-center">
                <AlertTriangle className="text-amber-600 w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">Identifique riscos precocemente</h3>
              <p className="text-muted-foreground">Saiba quando algo começa a sair do controle antes que se torne uma crise.</p>
            </div>
            <div className="bg-background border rounded-2xl p-8 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="bg-green-100 w-12 h-12 rounded-xl flex items-center justify-center">
                <Zap className="text-green-600 w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">Saiba o que fazer</h3>
              <p className="text-muted-foreground">Receba direcionamentos claros para melhorar seu resultado de forma prática.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCT PROOF BRIDGE */}
      <div className="bg-muted/30 py-8 border-y">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xl font-bold italic text-muted-foreground flex items-center justify-center gap-3">
            <ArrowRight className="h-5 w-5 text-primary" />
            Agora veja como isso aparece na prática.
          </p>
        </div>
      </div>

      {/* VISUAL PROOF (REAL SCREENSHOTS) */}
      <section className="py-16 bg-background overflow-hidden border-b">
        <div className="container mx-auto px-4 space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
              Veja como você toma decisões no dia a dia
            </h2>
            <p className="text-xl text-muted-foreground">
              Sem planilhas. Sem achismo. Só clareza.
            </p>
          </div>

          <div className="space-y-20 max-w-5xl mx-auto">
            {/* Dashboard */}
            <div className="space-y-6 text-center">
              <div className="bg-white border rounded-2xl p-2 shadow-2xl transition-transform hover:scale-[1.01] duration-500">
                <img 
                  src="/screenshots/dashboard.png" 
                  alt="Dashboard Cockpit" 
                  className="w-full h-auto rounded-xl border border-muted/50"
                />
              </div>
              <p className="text-lg font-bold text-foreground">
                "O sistema te mostra quando algo começa a dar errado"
              </p>
            </div>

            {/* Pricing */}
            <div className="space-y-6 text-center">
              <div className="bg-white border rounded-2xl p-2 shadow-2xl transition-transform hover:scale-[1.01] duration-500">
                <img 
                  src="/screenshots/pricing.png" 
                  alt="Precificação" 
                  className="w-full h-auto rounded-xl border border-muted/50"
                />
              </div>
              <p className="text-lg font-bold text-foreground">
                "Entenda exatamente quanto precisa cobrar para ter lucro"
              </p>
            </div>

            {/* Transactions */}
            <div className="space-y-6 text-center">
              <div className="bg-white border rounded-2xl p-2 shadow-2xl transition-transform hover:scale-[1.01] duration-500">
                <img 
                  src="/screenshots/transactions.png" 
                  alt="Contas a Receber" 
                  className="w-full h-auto rounded-xl border border-muted/50"
                />
              </div>
              <p className="text-lg font-bold text-foreground">
                "Entenda o que está impactando seu resultado no dia a dia"
              </p>
            </div>

            {/* MIDDLE CTA */}
            <div className="pt-8 text-center animate-in zoom-in duration-700 delay-500">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-8 text-xl rounded-2xl shadow-xl shadow-primary/30">
                <Link to="/login?signup=true">Criar conta e entender meu resultado</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="bg-muted/20 py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-none shadow-none bg-transparent flex flex-col items-center text-center p-4">
              <div className="bg-primary/10 p-4 rounded-2xl mb-4"><BarChart3 className="h-8 w-8 text-primary" /></div>
              <CardTitle className="text-lg font-bold">Clareza do resultado</CardTitle>
              <CardContent className="mt-2 text-muted-foreground p-0">
                Entenda se o negócio está realmente saudável de forma visual.
              </CardContent>
            </Card>
            <Card className="border-none shadow-none bg-transparent flex flex-col items-center text-center p-4">
              <div className="bg-green-100 p-4 rounded-2xl mb-4"><CheckCircle className="h-8 w-8 text-green-600" /></div>
              <CardTitle className="text-lg font-bold">Dashboard gerencial</CardTitle>
              <CardContent className="mt-2 text-muted-foreground p-0">
                Visual rápido com alertas e insights automáticos críticos.
              </CardContent>
            </Card>
            <Card className="border-none shadow-none bg-transparent flex flex-col items-center text-center p-4">
              <div className="bg-amber-100 p-4 rounded-2xl mb-4"><Calculator className="h-8 w-8 text-amber-500" /></div>
              <CardTitle className="text-lg font-bold">Precificação inteligente</CardTitle>
              <CardContent className="mt-2 text-muted-foreground p-0">
                Simule decisões e impactos na margem antes de executá-las.
              </CardContent>
            </Card>
            <Card className="border-none shadow-none bg-transparent flex flex-col items-center text-center p-4">
              <div className="bg-purple-100 p-4 rounded-2xl mb-4"><Lightbulb className="h-8 w-8 text-purple-600" /></div>
              <CardTitle className="text-lg font-bold">Inteligência embutida</CardTitle>
              <CardContent className="mt-2 text-muted-foreground p-0">
                O sistema interpreta dados e orienta suas decisões diárias.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
          Comece agora em minutos
        </h2>
        <div className="grid gap-12 md:grid-cols-3 max-w-4xl mx-auto">
          <div className="space-y-4 text-center">
            <Badge variant="secondary" className="px-3 py-1 rounded-full text-xs font-bold uppercase transition-colors">Passo 1</Badge>
            <h3 className="text-xl font-bold">Informe o básico</h3>
            <p className="text-muted-foreground">Cadastre suas receitas e custos principais no onboarding guiado.</p>
          </div>
          <div className="space-y-4 text-center">
            <Badge variant="secondary" className="px-3 py-1 rounded-full text-xs font-bold uppercase transition-colors">Passo 2</Badge>
            <h3 className="text-xl font-bold">Entenda seu negócio</h3>
            <p className="text-muted-foreground">O motor de cálculo gera automaticamente seus indicadores de lucro e margem.</p>
          </div>
          <div className="space-y-4 text-center">
            <Badge variant="secondary" className="px-3 py-1 rounded-full text-xs font-bold uppercase transition-colors">Passo 3</Badge>
            <h3 className="text-xl font-bold">Tome decisões</h3>
            <p className="text-muted-foreground">Use os alertas e insights para agir no que realmente importa para seu lucro.</p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-primary text-primary-foreground py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary-foreground/20 opacity-50"></div>
        <div className="container mx-auto px-4 text-center relative z-10 space-y-8">
          <div className="space-y-4">
            <h2 className="text-4xl font-bold tracking-tight lg:text-5xl">
              Pare de operar no escuro. Comece a tomar decisões com clareza.
            </h2>
            <p className="text-xl opacity-90 max-w-2xl mx-auto">
              Em poucos minutos você entende se seu negócio está saudável — e o que fazer para melhorar.
            </p>
          </div>
          <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 px-10 py-8 text-xl rounded-2xl shadow-2xl">
            <Link to="/login?signup=true">Criar conta e entender meu resultado</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
