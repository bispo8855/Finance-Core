export type RecommendationType = 'risk' | 'opportunity' | 'efficiency';

export interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  impact: {
    area: 'caixa' | 'resultado' | 'margem';
    severity: 'low' | 'medium' | 'high';
    estimatedValue?: number;
  };
  action: {
    primary: string;
    secondary?: string;
    targetPath?: string;
    queryParams?: Record<string, string>;
  };
}
