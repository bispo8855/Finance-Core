import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, BarChart3, CheckCircle, Calculator, Users, Lightbulb, AlertTriangle, Zap, Target, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_CONFIG } from '@/config/app';

// Re‑use existing KPI card for a lightweight mockup
import { KPICard } from '@/components/shared/KPICard';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col">
      {/* HEADER */}
      <header className="container mx-auto px-4 py-6 flex items-center justify-between border-b border-muted/20">
        <div className="flex items-center gap-2">
          <img src="/aurys-logo-dark.png" alt="Aurys Logo" className="h-20 w-auto" />
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild size="lg" className="bg-primary text-primary-foreground rounded-xl px-6">
            <Link to="/login?signup=true">Começar agora</Link>
          </Button>
        </div>
      </header>

      {/* HERO */}
      <section className="container mx-auto px-4 py-12 lg:py-20 flex flex-col-reverse lg:flex-row items-center gap-12">
        <div className="max-w-xl space-y-8">
          <div className="space-y-6">
            <Badge variant="outline" className="px-3 py-1 text-primary border-primary/20 bg-primary/5 rounded-full font-semibold">
              O núcleo de decisão para o seu negócio
            </Badge>
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-6xl text-foreground leading-[1.05]">
              Clareza absoluta para suas decisões de negócio.
            </h1>
            <p className="text-xl text-muted-foreground font-medium max-w-[90%]">
              O Aurys transforma seus dados em inteligência estratégica. Pare de reagir ao caixa e comece a guiar seus resultados com precisão.
            </p>
          </div>
          
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-7 text-lg rounded-xl shadow-xl shadow-primary/20 transition-all hover:translate-y-[-2px]">
                <Link to="/login?signup=true">Obter clareza agora</Link>
              </Button>
              <Button variant="outline" asChild className="px-8 py-7 text-lg rounded-xl hidden md:inline-flex border-2">
                <Link to="/login">Acessar minha conta</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground/80 font-medium ml-1 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Desenvolvido para empreendedores que buscam lucro e previsibilidade.
            </p>
          </div>
        </div>

        {/* Mockup dashboard cards */}
        <div className="flex flex-col gap-4 w-full max-w-md animate-in fade-in slide-in-from-right-10 duration-1000">
          <div className="bg-white/80 backdrop-blur-sm border rounded-2xl p-6 shadow-2xl space-y-6 relative overflow-hidden group hover:border-primary/30 transition-colors">
             <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors"></div>
             <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Resultado Estratégico</span>
                <TrendingUp className="h-5 w-5 text-primary" />
             </div>
             <div className="space-y-1">
                <h3 className="text-3xl font-bold text-foreground">R$ 12.450,00</h3>
                <p className="text-sm text-primary font-medium flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Margem saudável de 24.5%
                </p>
             </div>
             <div className="pt-4 border-t border-muted/20 flex gap-4">
                <div className="flex-1 space-y-1">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">Liquidez</span>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-[75%]"></div>
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">Meta</span>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[90%]"></div>
                  </div>
                </div>
             </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <KPICard title="Ponto de Equilíbrio" value="R$ 18.500" icon={Target} />
            <KPICard title="Markup Médio" value="2.4x" icon={Calculator} />
          </div>
        </div>
      </section>

      {/* STRATEGIC GAP SECTION */}
      <section className="bg-slate-900 text-white py-16 lg:py-24 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#4F46E5_1px,transparent_1px)] [background-size:20px_20px]"></div>
        <div className="container mx-auto px-4 max-w-4xl text-center space-y-12 relative z-10">
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight leading-tight">
            Vendas sem lucro são apenas <span className="text-primary italic">vaidade</span>.
          </h2>
          
          <div className="grid gap-8 md:grid-cols-2 text-left mt-12">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4 backdrop-blur-sm">
              <div className="bg-red-500/20 p-2 w-fit rounded-lg"><Zap className="h-6 w-6 text-red-400" /></div>
              <h4 className="text-xl font-bold">O "Labirinto" do Crescimento</h4>
              <p className="text-slate-400">Você fatura alto, mas o caixa está sempre no limite. O crescimento parece estar drenando sua energia em vez de recompensar.</p>
            </div>
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4 backdrop-blur-sm">
              <div className="bg-amber-500/20 p-2 w-fit rounded-lg"><AlertTriangle className="h-6 w-6 text-amber-400" /></div>
              <h4 className="text-xl font-bold">Decisões no "Achismo"</h4>
              <p className="text-slate-400">Dúvida constante na hora de precificar, contratar ou investir. Você sente que está jogando em vez de gerir.</p>
            </div>
          </div>

          <div className="pt-8 block">
            <p className="text-2xl font-bold text-primary">
              O Aurys elimina o nevoeiro. Você assume o centro da decisão.
            </p>
          </div>
        </div>
      </section>

      {/* CORE CAPABILITIES */}
      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-4 space-y-20">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
              Uma visão clara do seu futuro, não apenas do seu passado
            </h2>
            <p className="text-lg text-muted-foreground">
              Fomos além do controle financeiro tradicional. Criamos um sistema que interpreta o seu negócio.
            </p>
          </div>

          <div className="grid gap-12 lg:grid-cols-3">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="bg-primary p-5 rounded-2xl shadow-xl shadow-primary/20">
                <BarChart3 className="text-white w-8 h-8" />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-bold">Inteligência de Resultado</h3>
                <p className="text-muted-foreground px-4">Entenda o lucro real após todas as variáveis. Tenha a visão do que realmente sobra no seu bolso.</p>
              </div>
            </div>

            <div className="flex flex-col items-center text-center space-y-6">
              <div className="bg-amber-500 p-5 rounded-2xl shadow-xl shadow-amber-500/20">
                <Calculator className="text-white w-8 h-8" />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-bold">Simulador de Decisão</h3>
                <p className="text-muted-foreground px-4">Precificação e lucratividade integradas. Saiba o impacto de cada desconto ou custo antes de agir.</p>
              </div>
            </div>

            <div className="flex flex-col items-center text-center space-y-6">
              <div className="bg-emerald-500 p-5 rounded-2xl shadow-xl shadow-emerald-500/20">
                <Lightbulb className="text-white w-8 h-8" />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-bold">Insights Pró-ativos</h3>
                <p className="text-muted-foreground px-4">Alertas estratégicos que mostram onde estão as oportunidades de melhoria e os riscos de caixa.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VISUAL PROOF (SCREENSHOTS) */}
      <section className="py-20 bg-slate-50 border-y">
        <div className="container mx-auto px-4 space-y-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4">
              <Badge className="bg-primary/10 text-primary border-none">Dashboard Cockpit</Badge>
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground lg:text-4xl">
                Toda a inteligência do seu negócio em uma única tela.
              </h2>
            </div>
            <p className="text-lg text-muted-foreground max-w-sm">
              Sem planilhas complexas. Apenas os indicadores que movem o ponteiro.
            </p>
          </div>

          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary/20 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            <div className="relative bg-white border rounded-2xl shadow-2xl overflow-hidden">
              <img 
                src="/screenshots/dashboard.png" 
                alt="Dashboard Aurys" 
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-slate-900 border-t border-white/5 py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-primary/10 to-transparent"></div>
        <div className="container mx-auto px-4 text-center relative z-10 space-y-10">
          <div className="space-y-8">
            <img src="/aurys-logo.png" alt="Aurys Logo" className="h-32 mx-auto opacity-90" />
            <h2 className="text-4xl font-extrabold tracking-tight lg:text-6xl text-white max-w-4xl mx-auto leading-tight">
              Transforme incerteza em estratégia hoje mesmo.
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Em poucos minutos você terá um diagnóstico real do seu negócio e a clareza para decidir seu próximo passo.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground px-12 py-8 text-xl rounded-2xl shadow-2xl shadow-primary/30 transform transition hover:scale-105 active:scale-95">
              <Link to="/login?signup=true">Criar minha conta agora</Link>
            </Button>
            <p className="text-slate-500 font-medium">Grátis para primeiros testes</p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-16 border-t bg-muted/20">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 grayscale opacity-40">
            <img src="/aurys-logo-dark.png" alt="Aurys Logo" className="h-16" />
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Aurys. {APP_CONFIG.subtitle}.
          </p>
        </div>
      </footer>
    </div>
  );
}
