import { Category, BankAccount, Contact, FinancialDocument, Movement, Title } from '@/types/financial';
import { initialCategories, initialAccounts, initialContacts, initialDocuments, initialTitles, initialMovements } from '@/data/mockData';
import { IFinanceService, FinanceSnapshot, CreateDocumentPayload, UserProfile } from './financeService';

// Mutable in-memory DB simulate persistent layer
const categories = [...initialCategories];
const accounts = [...initialAccounts];
const contacts = [...initialContacts];
const documents = [...initialDocuments];
const titles = [...initialTitles];
const movements = [...initialMovements];
let mockProfile: { onboarding_completed: boolean } | null = { onboarding_completed: false };

const uid = () => 'id_' + Math.random().toString(36).substr(2, 9);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class MockFinanceService implements IFinanceService {
  async getProfile(): Promise<UserProfile | null> {
    await delay(200);
    if (!mockProfile) return null;
    return { id: 'mock-user', onboardingCompleted: mockProfile.onboarding_completed };
  }

  async updateProfile(payload: Partial<Omit<UserProfile, 'id'>>): Promise<UserProfile> {
    await delay(200);
    if (!mockProfile) mockProfile = { onboarding_completed: false };
    if (payload.onboardingCompleted !== undefined) mockProfile.onboarding_completed = payload.onboardingCompleted;
    return { id: 'mock-user', onboardingCompleted: mockProfile.onboarding_completed };
  }

  async getSnapshot(): Promise<FinanceSnapshot> {
    await delay(300);
    return {
      accounts: [...accounts],
      categories: [...categories],
      contacts: [...contacts],
      documents: [...documents],
      titles: [...titles],
      movements: [...movements],
    };
  }

  async createDocument(payload: CreateDocumentPayload, payNow = false, accountId?: string) {
    await delay(400);
    const docId = uid();
    const doc: FinancialDocument = { ...payload, id: docId, createdAt: new Date().toISOString().split('T')[0] };
    
    const titleType: 'receber' | 'pagar' = (payload.type === 'venda' || payload.type === 'receita') ? 'receber' : 'pagar';
    const numInstallments = payload.condition === 'parcelado' ? payload.installments : 1;
    const valuePerInstallment = Math.round((payload.totalValue / numInstallments) * 100) / 100;
    
    const newTitles: Title[] = [];
    const newMovements: Movement[] = [];
    const today = new Date().toISOString().split('T')[0];
    const initialDate = payload.firstDueDate || payload.competenceDate;

    for (let i = 0; i < numInstallments; i++) {
      const dueDate = new Date(initialDate + 'T12:00:00');
      dueDate.setMonth(dueDate.getMonth() + i);
      const titleId = uid();
      const title: Title = {
        id: titleId,
        documentId: docId,
        installment: i + 1,
        totalInstallments: numInstallments,
        dueDate: dueDate.toISOString().split('T')[0],
        value: i === numInstallments - 1 ? payload.totalValue - valuePerInstallment * (numInstallments - 1) : valuePerInstallment,
        status: payNow && i === 0 ? (titleType === 'receber' ? 'recebido' : 'pago') : 'previsto',
        side: titleType,
        contactId: payload.contactId,
        categoryId: payload.categoryId,
        description: '', // We leave it empty so the UI falls back to Document description
      };
      newTitles.push(title);

      if (payNow && i === 0 && accountId) {
        const movementId = uid();
        newMovements.push({
          id: movementId,
          titleId,
          accountId,
          paymentDate: today,
          valuePaid: title.value,
          type: titleType === 'receber' ? 'entrada' : 'saida',
          feeAmount: 0,
          notes: ''
        });
        title.settledAt = today;
        title.settlementMovementId = movementId;
      }
    }

    documents.push(doc);
    titles.push(...newTitles);
    if (newMovements.length > 0) movements.push(...newMovements);

    return { document: doc, titles: newTitles, movements: newMovements };
  }

  async updateDocument(documentId: string, payload: CreateDocumentPayload) {
    await delay(400);
    
    const existingTitles = titles.filter(t => t.documentId === documentId);
    if (existingTitles.some(t => t.status === 'pago' || t.status === 'recebido')) {
      throw new Error('Não é possível editar um lançamento que já possui baixas. Exclua a baixa primeiro.');
    }

    // Delete existing titles
    for (let i = titles.length - 1; i >= 0; i--) {
      if (titles[i].documentId === documentId) {
        titles.splice(i, 1);
      }
    }

    const docIndex = documents.findIndex(d => d.id === documentId);
    if (docIndex === -1) throw new Error('Document not found');

    const updatedDoc: FinancialDocument = { ...documents[docIndex], ...payload };
    documents[docIndex] = updatedDoc;

    const titleType: 'receber' | 'pagar' = (payload.type === 'venda' || payload.type === 'receita') ? 'receber' : 'pagar';
    const numInstallments = payload.condition === 'parcelado' ? payload.installments : 1;
    
    const newTitles: Title[] = [];

    if (payload.condition === 'parcelado' && payload.customInstallments && payload.customInstallments.length > 0) {
      if (payload.customInstallments.length !== numInstallments) {
        throw new Error('Número de parcelas customizadas destoa do total informado.');
      }
      for (let i = 0; i < numInstallments; i++) {
        const custom = payload.customInstallments[i];
        const title: Title = {
          id: uid(),
          documentId,
          installment: i + 1,
          totalInstallments: numInstallments,
          dueDate: custom.dueDate,
          value: custom.value,
          status: 'previsto',
          side: titleType,
          contactId: payload.contactId,
          categoryId: payload.categoryId,
          description: '',
        };
        newTitles.push(title);
      }
    } else {
      const valuePerInstallment = Math.round((payload.totalValue / numInstallments) * 100) / 100;
      for (let i = 0; i < numInstallments; i++) {
        const dueDate = new Date(payload.competenceDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        const title: Title = {
          id: uid(),
          documentId,
          installment: i + 1,
          totalInstallments: numInstallments,
          dueDate: dueDate.toISOString().split('T')[0],
          value: i === numInstallments - 1 ? payload.totalValue - valuePerInstallment * (numInstallments - 1) : valuePerInstallment,
          status: 'previsto',
          side: titleType,
          contactId: payload.contactId,
          categoryId: payload.categoryId,
          description: '',
        };
        newTitles.push(title);
      }
    }

    titles.push(...newTitles);

    return { document: updatedDoc, titles: newTitles };
  }

  async settleTitle(titleId: string, accountId: string, paymentDate: string, valuePaid: number, notes?: string) {
    await delay(300);
    const titleIndex = titles.findIndex(t => t.id === titleId);
    if (titleIndex === -1) throw new Error('Title not found');

    const currentTitle = titles[titleIndex];
    const isPartial = valuePaid < currentTitle.value;
    const remainingValue = currentTitle.value - valuePaid;

    const movementId = uid();
    const movement: Movement = {
      id: movementId,
      titleId,
      accountId,
      paymentDate,
      valuePaid,
      type: currentTitle.side === 'receber' ? 'entrada' : 'saida',
      feeAmount: 0,
      notes: notes || ''
    };
    movements.push(movement);

    const updatedTitle = { 
      ...currentTitle, 
      value: isPartial ? valuePaid : currentTitle.value,
      status: currentTitle.side === 'receber' ? ('recebido' as const) : ('pago' as const),
      settledAt: paymentDate,
      settlementMovementId: movementId
    };
    titles[titleIndex] = updatedTitle;

    if (isPartial && remainingValue > 0) {
      const newTitle: Title = {
        ...currentTitle,
        id: uid(),
        value: remainingValue,
        status: 'previsto',
        settledAt: undefined,
        settlementMovementId: undefined
      };
      titles.push(newTitle);
    }

    return { updatedTitle, movement };
  }

  async undoSettleTitle(titleId: string): Promise<{ updatedTitle: Title }> {
    await delay(300);
    const titleIndex = titles.findIndex(t => t.id === titleId);
    if (titleIndex === -1) throw new Error('Title not found');
    
    // Find movements to delete
    const movsToDelete = movements.filter(m => m.titleId === titleId);
    if (movsToDelete.length === 0) {
      throw new Error('Não há baixa para estornar (nenhuma movimentação encontrada).');
    }
    
    // Remove movements
    for (let i = movements.length - 1; i >= 0; i--) {
      if (movements[i].titleId === titleId) {
        movements.splice(i, 1);
      }
    }
    
    // Update title
    const updatedTitle: Title = {
      ...titles[titleIndex],
      status: 'previsto',
      settledAt: undefined,
      settlementMovementId: undefined
    };
    titles[titleIndex] = updatedTitle;
    
    return { updatedTitle };
  }

  async updateTitle(titleId: string, payload: { dueDate?: string; description?: string }): Promise<Title> {
    await delay(300);
    const titleIndex = titles.findIndex(t => t.id === titleId);
    if (titleIndex === -1) throw new Error('Title not found');

    const updatedTitle = { ...titles[titleIndex] };
    if (payload.dueDate !== undefined) updatedTitle.dueDate = payload.dueDate;
    if (payload.description !== undefined) updatedTitle.description = payload.description;

    titles[titleIndex] = updatedTitle;
    return updatedTitle;
  }

  async deleteTitle(titleId: string): Promise<void> {
    await delay(300);
    const titleIndex = titles.findIndex(t => t.id === titleId);
    if (titleIndex === -1) throw new Error('Title not found');
    
    const title = titles[titleIndex];
    if (title.status === 'pago' || title.status === 'recebido') {
      throw new Error('Não é possível excluir: título já liquidado.');
    }
    
    const hasMovements = movements.some(m => m.titleId === titleId);
    if (hasMovements) {
      throw new Error('Não é possível excluir: título possui movimentações.');
    }
    
    titles.splice(titleIndex, 1);
    
    const hasOtherTitles = titles.some(t => t.documentId === title.documentId);
    if (!hasOtherTitles) {
      const docIndex = documents.findIndex(d => d.id === title.documentId);
      if (docIndex !== -1) documents.splice(docIndex, 1);
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    await delay(300);
    const docIndex = documents.findIndex(d => d.id === documentId);
    if (docIndex === -1) throw new Error('Documento não encontrado.');

    const docTitles = titles.filter(t => t.documentId === documentId);
    
    if (docTitles.some(t => t.status === 'pago' || t.status === 'recebido')) {
      throw new Error('Este lançamento possui parcelas baixadas. Estorne as baixas primeiro para poder excluí-lo.');
    }

    const titleIds = docTitles.map(t => t.id);
    const hasMovements = movements.some(m => titleIds.includes(m.titleId));
    if (hasMovements) {
      throw new Error('Não é possível excluir: existem movimentações vinculadas às parcelas.');
    }

    // Delete titles
    for (let i = titles.length - 1; i >= 0; i--) {
      if (titles[i].documentId === documentId) {
        titles.splice(i, 1);
      }
    }

    // Delete document
    documents.splice(docIndex, 1);
  }

  async updateInitialBalance(accountId: string, value: number): Promise<BankAccount> {
    await delay(300);
    const accIndex = accounts.findIndex(a => a.id === accountId);
    if (accIndex === -1) throw new Error('Account not found');
    accounts[accIndex] = { ...accounts[accIndex], initialBalance: value };
    return accounts[accIndex];
  }

  // --- CATALOGS CRUD ---
  async createCategory(payload: Omit<Category, 'id'>): Promise<Category> {
    await delay(300);
    const newCategory: Category = { ...payload, id: uid(), isActive: payload.isActive ?? true };
    categories.push(newCategory);
    return newCategory;
  }

  async updateCategory(id: string, payload: Partial<Omit<Category, 'id'>>): Promise<Category> {
    await delay(300);
    const idx = categories.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Category not found');
    categories[idx] = { ...categories[idx], ...payload };
    return categories[idx];
  }

  async deleteCategory(id: string): Promise<void> {
    await delay(300);
    const idx = categories.findIndex(c => c.id === id);
    if (idx !== -1) categories[idx] = { ...categories[idx], isActive: false };
  }

  async createAccount(payload: Omit<BankAccount, 'id'>): Promise<BankAccount> {
    await delay(300);
    const newAccount: BankAccount = { 
      ...payload, 
      id: uid(),
      openingBalance: payload.openingBalance ?? payload.initialBalance,
      openingBalanceDate: payload.openingBalanceDate ?? null,
      isActive: payload.isActive ?? true
    };
    accounts.push(newAccount);
    return newAccount;
  }

  async updateAccount(id: string, payload: Partial<Omit<BankAccount, 'id'>>): Promise<BankAccount> {
    await delay(300);
    const idx = accounts.findIndex(a => a.id === id);
    if (idx === -1) throw new Error('Account not found');
    accounts[idx] = { ...accounts[idx], ...payload };
    return accounts[idx];
  }

  async deleteAccount(id: string): Promise<void> {
    await delay(300);
    const idx = accounts.findIndex(a => a.id === id);
    if (idx !== -1) accounts[idx] = { ...accounts[idx], isActive: false };
  }

  async createContact(payload: Omit<Contact, 'id'>): Promise<Contact> {
    await delay(300);
    const newContact: Contact = { ...payload, id: uid(), isActive: payload.isActive ?? true };
    contacts.push(newContact);
    return newContact;
  }

  async updateContact(id: string, payload: Partial<Omit<Contact, 'id'>>): Promise<Contact> {
    await delay(300);
    const idx = contacts.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Contact not found');
    contacts[idx] = { ...contacts[idx], ...payload };
    return contacts[idx];
  }

  async deleteContact(id: string): Promise<void> {
    await delay(300);
    const idx = contacts.findIndex(c => c.id === id);
    if (idx !== -1) contacts[idx] = { ...contacts[idx], isActive: false };
  }
}

export const financeService = new MockFinanceService();
