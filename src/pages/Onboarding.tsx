import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Rocket, Info, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { Toaster } from 'sonner';
import { financeService } from '@/services/finance';

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  useEffect(() => {
    const migrateOnboarding = async () => {
      try {
        const profile = await financeService.getProfile();
        const hasCompletedLocal = localStorage.getItem('hasCompletedOnboarding') === 'true';

        if (profile?.onboardingCompleted) {
          // Já completou no banco, sincroniza localStorage e vaza
          if (!hasCompletedLocal) localStorage.setItem('hasCompletedOnboarding', 'true');
          navigate('/lancar', { replace: true });
          return;
        }

        if (hasCompletedLocal) {
          // Completou local mas não no banco, migra
          await financeService.updateProfile({ onboardingCompleted: true });
          navigate('/lancar', { replace: true });
        }
      } catch (e) {
        console.error('Erro na migração de onboarding:', e);
      }
    };
    migrateOnboarding();
  }, [navigate]);

  const [formData, setFormData] = useState({
    businessType: '',
    currentBalance: '',
    estimatedRevenue: '',
    estimatedCost: '',
  });

  const handleSkip = async () => {
    localStorage.setItem('hasDismissedOnboarding', 'true');
    try {
      await financeService.updateProfile({ onboardingCompleted: true }); // Skipping counts as completed for redirect purposes
    } catch (e) {}
    navigate('/', { replace: true });
  };

  const handleComplete = async () => {
    localStorage.setItem('hasCompletedOnboarding', 'true');
    try {
      await financeService.updateProfile({ onboardingCompleted: true });
    } catch (e) {
      console.error('Erro ao persistir onboarding:', e);
    }
    navigate('/lancar?onboarding=true', { state: { from: 'onboarding' }, replace: true });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Permitir apenas números para campos financeiros (poderiamos usar máscara se houvesse, mas input simples serve)
    if (['currentBalance', 'estimatedRevenue', 'estimatedCost'].includes(name)) {
      const numericValue = value.replace(/\D/g, '');
      setFormData((prev) => ({ ...prev, [name]: numericValue }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const parseCurrency = (val: string) => {
    return parseFloat(val || '0') / 100;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const displayCurrency = (val: string) => {
    if (!val) return '';
    return formatCurrency(parseCurrency(val));
  };

  const calculateStatus = () => {
    const revenue = parseCurrency(formData.estimatedRevenue);
    const cost = parseCurrency(formData.estimatedCost);

    if (revenue === 0 && cost === 0) return { status: 'neutro', msg: 'Aguardando seus dados para análise.' };
    
    if (revenue > cost * 1.2) {
      return { status: 'saudavel', msg: 'Excelente! Sua operação aparenta ter uma margem saudável.', color: 'text-positive', bg: 'bg-positive/10' };
    } else if (revenue >= cost) {
      return { status: 'atencao', msg: 'Atenção: A margem está apertada. Pequenos imprevistos podem gerar prejuízo.', color: 'text-warning', bg: 'bg-warning/10' };
    } else {
      return { status: 'critico', msg: 'Crítico: Seus custos superam a receita estimada. Necessário revisão urgente!', color: 'text-destructive', bg: 'bg-destructive/10' };
    }
  };

  const financeStatus = calculateStatus();
  const projectedProfit = parseCurrency(formData.estimatedRevenue) - parseCurrency(formData.estimatedCost);
  const marginStr = parseCurrency(formData.estimatedRevenue) > 0 
      ? ((projectedProfit / parseCurrency(formData.estimatedRevenue)) * 100).toFixed(1) + '%'
      : '0%';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">Pular por agora</Button>
      </div>

      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="bg-primary/10 p-4 rounded-full">
            <Rocket className="w-12 h-12 text-primary" />
          </div>
        </div>

        {step === 1 && (
          <Card className="border-none shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl text-center">Bem-vindo ao Aurys</CardTitle>
              <CardDescription className="text-center">Vamos entender seu negócio em poucos minutos para gerar clareza estratégica.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessType">Qual é o tipo do seu negócio? (Opcional)</Label>
                <Input 
                  id="businessType" 
                  name="businessType" 
                  placeholder="Ex: Consultoria, Varejo, Tecnologia..." 
                  value={formData.businessType}
                  onChange={handleChange}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={() => setStep(2)}>Avançar</Button>
            </CardFooter>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-none shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl text-center">Como está seu cenário atual?</CardTitle>
              <CardDescription className="text-center">Preencha com estimativas. Digite apenas números.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentBalance">Saldo Atual (Caixa/Bancos)</Label>
                <Input 
                  id="currentBalance" 
                  name="currentBalance" 
                  placeholder="R$ 0,00" 
                  value={displayCurrency(formData.currentBalance)}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedRevenue">Receita Mensal Estimada</Label>
                <Input 
                  id="estimatedRevenue" 
                  name="estimatedRevenue" 
                  placeholder="R$ 0,00" 
                  value={displayCurrency(formData.estimatedRevenue)}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedCost">Custo Mensal Estimado</Label>
                <Input 
                  id="estimatedCost" 
                  name="estimatedCost" 
                  placeholder="R$ 0,00" 
                  value={displayCurrency(formData.estimatedCost)}
                  onChange={handleChange}
                />
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button variant="outline" className="w-1/3" onClick={() => setStep(1)}>Voltar</Button>
              <Button 
                className="w-2/3" 
                onClick={() => setStep(3)}
                disabled={!formData.estimatedRevenue && !formData.estimatedCost}
              >
                Gerar Insights
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 3 && (
          <Card className="border-none shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl text-center">Sua Visão Estratégica</CardTitle>
              <CardDescription className="text-center">Esta é uma simulação de como sua visão geral vai te ajudar a decidir.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className={`p-4 rounded-lg flex gap-3 ${financeStatus.bg || 'bg-slate-100'} border items-start`}>
                <Info className={`w-5 h-5 shrink-0 ${financeStatus.color}`} />
                <div>
                  <h4 className={`font-semibold text-sm ${financeStatus.color}`}>Diagnóstico: {financeStatus.status.charAt(0).toUpperCase() + financeStatus.status.slice(1)}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{financeStatus.msg}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-xl p-4 flex flex-col items-center text-center justify-center bg-white shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                    <DollarSign className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground mb-1">Lucro Projetado</span>
                  <span className={`text-lg font-bold ${projectedProfit >= 0 ? "text-slate-900" : "text-destructive"}`}>
                    {formatCurrency(projectedProfit)}
                  </span>
                </div>
                
                <div className="border rounded-xl p-4 flex flex-col items-center text-center justify-center bg-white shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mb-2">
                    {projectedProfit >= 0 ? <TrendingUp className="w-4 h-4 text-purple-600" /> : <TrendingDown className="w-4 h-4 text-purple-600" />}
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground mb-1">Margem</span>
                  <span className="text-lg font-bold text-slate-900">{marginStr}</span>
                </div>
              </div>

            </CardContent>
            <CardFooter>
              <Button className="w-full text-md h-12" onClick={handleComplete}>
                Fazer Meu Primeiro Lançamento Real
              </Button>
            </CardFooter>
          </Card>
        )}

      </div>
    </div>
  );
}
