import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { NewDocumentSheet } from '@/components/finance/NewDocumentSheet';
import { toast } from 'sonner';

export default function NewDocument() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const sideParam = searchParams.get('side');
  const onboardingParam = searchParams.get('onboarding') === 'true';
  
  // Mantemos o contexto localmente para garantir que não se perca se o state for limpo
  const [isFromOnboarding] = useState(location.state?.from === 'onboarding' || onboardingParam);
  const [isSaveSuccess, setIsSaveSuccess] = useState(false);

  useEffect(() => {
    // Se veio do onboarding, mostra a mensagem de boas-vindas
    if (location.state?.from === 'onboarding') {
      toast.success("Bem-vindo! Faça seu primeiro lançamento para alimentar o painel com dados reais.", {
        duration: 8000,
      });
      // Limpa o state para não disparar o toast novamente em re-renders, 
      // mas mantemos o isFromOnboarding no state do componente.
      navigate(location.pathname + location.search, { replace: true, state: {} });
    }
  }, [location, navigate]);
  
  const defaultSide = (sideParam === 'pagar' || sideParam === 'receber') ? sideParam : undefined;

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      if (isFromOnboarding) {
        // No contexto de onboarding, sempre levamos para o dashboard ao sair (sucesso ou cancelamento)
        // para evitar loops de retorno para a simulação e dar sensação de conclusão.
        navigate('/dashboard', { replace: true });
      } else {
        // Comportamento normal: volta para onde estava
        navigate(-1);
      }
    }
  };

  return (
    <div className="p-8">
      {/* Background that acts as a placeholder while the sheet is open on top of it */}
      <h1 className="text-2xl font-bold mb-4">Novo Lançamento</h1>
      <p className="text-muted-foreground">Abrindo painel de lançamento...</p>

      <NewDocumentSheet 
        open={true} 
        onOpenChange={handleClose}
        onSuccess={() => setIsSaveSuccess(true)}
        defaultSide={defaultSide}
      />
    </div>
  );
}
