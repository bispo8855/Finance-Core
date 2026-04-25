import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Hash } from 'lucide-react';

interface DescriptionWithRefProps {
  description?: string;
  className?: string;
}

/**
 * Componente que detecta o padrão [#ID] na descrição e renderiza o ID 
 * como um badge estilizado para facilitar a visualização de referências/pedidos.
 */
export const DescriptionWithRef: React.FC<DescriptionWithRefProps> = ({ description, className }) => {
  if (!description) return <span className="text-muted-foreground">—</span>;

  // Regex para encontrar [#VALOR]
  const refRegex = /\[#([^\]]+)\]/;
  const match = description.match(refRegex);

  if (match) {
    const refId = match[1];
    const textWithoutRef = description.replace(match[0], '').trim();

    return (
      <div className={`inline-flex items-center gap-1.5 max-w-full ${className}`}>
        <Badge variant="outline" className="h-5 px-1.5 shrink-0 bg-primary/5 text-primary border-primary/20 font-mono text-[10px] flex items-center gap-1 hover:bg-primary/10 transition-colors">
          <Hash className="w-2.5 h-2.5" />
          {refId}
        </Badge>
        {textWithoutRef && (
          <span className="text-foreground font-medium truncate">
            {textWithoutRef}
          </span>
        )}
      </div>
    );
  }

  return <span className={`text-foreground ${className}`}>{description}</span>;
};
