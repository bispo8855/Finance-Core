import { Category, BankAccount, Contact, FinancialDocument, Movement, Title } from '@/types/financial';
import { initialCategories, initialAccounts, initialContacts, initialDocuments, initialTitles, initialMovements } from '@/data/mockData';
import { IFinanceService, FinanceSnapshot, CreateDocumentPayload } from './financeService';

// Mutable in-memory DB simulate persistent layer
const categories = [...initialCategories];
const accounts = [...initialAccounts];
const contacts = [...initialContacts];
const documents = [...initialDocuments];
const titles = [...initialTitles];
const movements = [...initialMovements];

const uid = () => 'id_' + Math.random().toString(36).substr(2, 9);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class MockFinanceService implements IFinanceService {
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

    for (let i = 0; i < numInstallments; i++) {
      const dueDate = new Date(payload.competenceDate);
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
        type: titleType,
        contactId: payload.contactId,
        categoryId: payload.categoryId,
        description: payload.description + (numInstallments > 1 ? ` ${i + 1}/${numInstallments}` : ''),
      };
      newTitles.push(title);

      if (payNow && i === 0 && accountId) {
        newMovements.push({
          id: uid(),
          titleId,
          accountId,
          paymentDate: today,
          valuePaid: title.value,
          type: titleType === 'receber' ? 'entrada' : 'saida',
        });
      }
    }

    documents.push(doc);
    titles.push(...newTitles);
    if (newMovements.length > 0) movements.push(...newMovements);

    return { document: doc, titles: newTitles, movements: newMovements };
  }

  async settleTitle(titleId: string, accountId: string, paymentDate: string, valuePaid: number) {
    await delay(300);
    const titleIndex = titles.findIndex(t => t.id === titleId);
    if (titleIndex === -1) throw new Error('Title not found');

    const updatedTitle = { ...titles[titleIndex], status: titles[titleIndex].type === 'receber' ? ('recebido' as const) : ('pago' as const) };
    titles[titleIndex] = updatedTitle;

    const movement: Movement = {
      id: uid(),
      titleId,
      accountId,
      paymentDate,
      valuePaid,
      type: updatedTitle.type === 'receber' ? 'entrada' : 'saida',
    };
    movements.push(movement);

    return { updatedTitle, movement };
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
    const newCategory = { ...payload, id: uid() };
    categories.push(newCategory);
    return newCategory;
  }

  async deleteCategory(id: string): Promise<void> {
    await delay(300);
    const idx = categories.findIndex(c => c.id === id);
    if (idx !== -1) categories.splice(idx, 1);
  }

  async createAccount(payload: Omit<BankAccount, 'id'>): Promise<BankAccount> {
    await delay(300);
    const newAccount = { ...payload, id: uid() };
    accounts.push(newAccount);
    return newAccount;
  }

  async deleteAccount(id: string): Promise<void> {
    await delay(300);
    const idx = accounts.findIndex(a => a.id === id);
    if (idx !== -1) accounts.splice(idx, 1);
  }

  async createContact(payload: Omit<Contact, 'id'>): Promise<Contact> {
    await delay(300);
    const newContact = { ...payload, id: uid() };
    contacts.push(newContact);
    return newContact;
  }

  async deleteContact(id: string): Promise<void> {
    await delay(300);
    const idx = contacts.findIndex(c => c.id === id);
    if (idx !== -1) contacts.splice(idx, 1);
  }
}

export const financeService = new MockFinanceService();
