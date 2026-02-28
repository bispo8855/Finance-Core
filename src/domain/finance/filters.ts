import { Title, TitleStatus } from '@/types/financial';

export interface TitleUIFilters {
  tab: string; // 'todos' | 'previstos' | 'pagos' (ou 'recebidos')
  search: string;
}

const UI_TAB_STATUS_MAP: Record<string, TitleStatus[]> = {
  'todos': ['previsto', 'atrasado', 'pago'],
  'previstos': ['previsto', 'atrasado'],
  'pagos': ['pago'],
};

export function applyTitleUIFilters(titles: Title[], filters: TitleUIFilters): Title[] {
  let list = [...titles];

  // Filtro por Tab
  if (filters.tab !== 'todos') {
    const allowedStatuses = UI_TAB_STATUS_MAP[filters.tab] || [];
    list = list.filter(t => allowedStatuses.includes(t.status));
  }

  // Filtro por Busca/Texto
  if (filters.search) {
    const term = filters.search.toLowerCase();
    list = list.filter(t => {
      const matchDoc = t.documentId ? t.documentId.toLowerCase().includes(term) : false;
      const matchStatus = t.status.toLowerCase().includes(term);
      return matchDoc || matchStatus;
    });
  }

  return list;
}
