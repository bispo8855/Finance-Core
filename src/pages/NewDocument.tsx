import { useNavigate, useSearchParams } from 'react-router-dom';
import { NewDocumentSheet } from '@/components/finance/NewDocumentSheet';

export default function NewDocument() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sideParam = searchParams.get('side');
  
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
