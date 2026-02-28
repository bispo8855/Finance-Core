import { 
  BankAccount, Category, Contact, FinancialDocument, Title, Movement 
} from '@/types/financial';

export interface FinanceSnapshot {
  accounts: BankAccount[];
  categories: Category[];
  contacts: Contact[];
  documents: FinancialDocument[];
  titles: Title[];
  movements: Movement[];
}

export type CreateDocumentPayload = Omit<FinancialDocument, 'id' | 'createdAt'>;

export interface IFinanceService {
  getSnapshot(): Promise<FinanceSnapshot>;
  
  createDocument(
    payload: CreateDocumentPayload,
    payNow?: boolean,
    accountId?: string
  ): Promise<{ document: FinancialDocument; titles: Title[]; movements?: Movement[] }>;
  
  settleTitle(
    titleId: string, 
    accountId: string, 
    paymentDate: string, 
    valuePaid: number
  ): Promise<{ updatedTitle: Title; movement: Movement }>;
  
  updateInitialBalance(accountId: string, value: number): Promise<void>;
}
