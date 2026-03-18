export type DocumentType = 'venda' | 'compra' | 'despesa' | 'receita';
export type TitleStatus = 'previsto' | 'pago' | 'recebido' | 'atrasado' | 'renegociado' | 'cancelado';
export type ContactType = 'cliente' | 'fornecedor' | 'ambos';
export type CategoryType = 'receita' | 'custo' | 'despesa' | 'investimento' | 'financeiro';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  isActive?: boolean;
}

export interface BankAccount {
  id: string;
  name: string;
  type: 'banco' | 'caixa';
  institution?: string;
  initialBalance: number; // Keep for backwards compatibility
  openingBalance: number;
  openingBalanceDate: string | null;
  isActive?: boolean;
}

export interface Contact {
  id: string;
  name: string;
  type: ContactType;
  document?: string;
  email?: string;
  phone?: string;
  notes?: string;
  isActive?: boolean;
}

export interface FinancialDocument {
  id: string;
  type: DocumentType;
  contactId: string;
  categoryId: string;
  competenceDate: string;
  totalValue: number;
  description: string;
  condition: 'avista' | 'parcelado';
  installments: number;
  createdAt: string;
}

export interface Title {
  id: string;
  documentId: string;
  installment: number;
  totalInstallments: number;
  dueDate: string;
  value: number;
  status: TitleStatus;
  side: 'receber' | 'pagar';
  contactId: string;
  categoryId: string;
  description: string;
  settledAt?: string;
  settlementMovementId?: string;
}

export interface Movement {
  id: string;
  titleId: string;
  accountId: string;
  paymentDate: string;
  valuePaid: number;
  feeAmount?: number;
  notes?: string;
  type: 'entrada' | 'saida';
}
