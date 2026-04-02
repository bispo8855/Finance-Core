import { NavigateFunction } from 'react-router-dom';

export function navigateToCashFlow(navigate: NavigateFunction) {
  navigate('/fluxo');
}

export function navigateToReceivables(navigate: NavigateFunction, status?: 'atrasado') {
  navigate(status ? `/receber?status=${status}` : '/receber');
}

export function navigateToPayables(navigate: NavigateFunction, status?: 'vencido') {
  navigate(status ? `/pagar?status=${status}` : '/pagar');
}

export function navigateToDRE(navigate: NavigateFunction) {
  navigate('/dre');
}

export function navigateToLaunch(navigate: NavigateFunction) {
  navigate('/lancar');
}

export function navigateToTransactions(
  navigate: NavigateFunction, 
  filters?: { categoryId?: string, period?: string, kind?: string, search?: string }
) {
  const params = new URLSearchParams();
  if (filters?.categoryId) params.append('categoryId', filters.categoryId);
  if (filters?.period) params.append('period', filters.period);
  if (filters?.kind) params.append('kind', filters.kind);
  if (filters?.search) params.append('search', filters.search);
  
  const query = params.toString();
  navigate(query ? `/lancamentos?${query}` : '/lancamentos');
}
