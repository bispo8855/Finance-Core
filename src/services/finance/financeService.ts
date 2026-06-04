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

export type CreateDocumentPayload = Omit<FinancialDocument, 'id' | 'createdAt'> & {
  customInstallments?: { dueDate: string; value: number }[];
  firstDueDate?: string;
  sourceType?: string;
  importBatchId?: string;
};

export interface UserProfile {
  id: string;
  onboardingCompleted?: boolean;
  fullName?: string | null;
  displayName?: string | null;
  avatarInitials?: string | null;
}

export interface Workspace {
  id: string;
  ownerId: string;
  name: string;
  legalName?: string | null;
  documentNumber?: string | null;
  workspaceType: 'business' | 'personal';
  avatarInitials?: string | null;
}

export interface IFinanceService {
  setUserId(id: string | null): void;
  getSnapshot(): Promise<FinanceSnapshot>;
  
  getProfile(): Promise<UserProfile | null>;
  updateProfile(payload: Partial<Omit<UserProfile, 'id'>>): Promise<UserProfile>;
  getActiveWorkspace(): Promise<Workspace | null>;
  updateActiveWorkspace(payload: Partial<Omit<Workspace, 'id' | 'ownerId'>>): Promise<Workspace>;
  ensureDefaultWorkspaceForUser(): Promise<Workspace>;
  
  createDocument(
    payload: CreateDocumentPayload,
    payNow?: boolean,
    accountId?: string
  ): Promise<{ document: FinancialDocument; titles: Title[] }>;

  updateDocument(
    documentId: string,
    payload: CreateDocumentPayload
  ): Promise<{ document: FinancialDocument; titles: Title[] }>;
  
  settleTitle(
    titleId: string, 
    accountId: string, 
    paymentDate: string, 
    valuePaid: number,
    notes?: string
  ): Promise<{ updatedTitle: Title; movement: Movement }>;
  
  undoSettleTitle(titleId: string): Promise<{ updatedTitle: Title }>;
  
  updateTitle(
    titleId: string,
    payload: { dueDate?: string; description?: string }
  ): Promise<Title>;
  
  updateInitialBalance(accountId: string, value: number): Promise<BankAccount>;

  // Catalogs CRUD
  createCategory(payload: Omit<Category, 'id'>): Promise<Category>;
  updateCategory(id: string, payload: Partial<Omit<Category, 'id'>>): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
  createAccount(payload: Omit<BankAccount, 'id'>): Promise<BankAccount>;
  updateAccount(id: string, payload: Partial<Omit<BankAccount, 'id'>>): Promise<BankAccount>;
  deleteAccount(id: string): Promise<void>;
  createContact(payload: Omit<Contact, 'id'>): Promise<Contact>;
  updateContact(id: string, payload: Partial<Omit<Contact, 'id'>>): Promise<Contact>;
  deleteContact(id: string): Promise<void>;
  
  deleteTitle(titleId: string): Promise<void>;
  deleteDocument(documentId: string): Promise<void>;
  
  // Reclassification
  reclassifyDocument(
    documentId: string,
    categoryId: string,
    newDescription?: string
  ): Promise<FinancialDocument>;
}
