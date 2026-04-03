import { useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { NewDocumentSheet } from '@/components/finance/NewDocumentSheet';
import { toast } from 'sonner';

export default function NewDocument() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const sideParam = searchParams.get('side');

  useEffect(() => {
    if (location.state?.from === 'onboarding') {
      toast.success("Bem-vindo! Faça seu primeiro lançamento para alimentar o painel com dados reais.", {
        duration: 8000,
      });
      // Limpa o state para não disparar várias vezes
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);
  
  const defaultSide = (sideParam === 'pagar' || sideParam === 'receber') ? sideParam : undefined;

  return (
    <div className="p-8">
      {/* Background that acts as a placeholder while the sheet is open on top of it */}
      <h1 className="text-2xl font-bold mb-4">Novo Lançamento</h1>
      <p className="text-muted-foreground">Abrindo painel de lançamento...</p>

      <NewDocumentSheet 
        open={true} 
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            navigate(-1);
          }
        }} 
        defaultSide={defaultSide}
      />
    </div>
  );
}
