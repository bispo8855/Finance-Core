import React, { createContext, useContext, useState, useCallback } from 'react';
import { Category, BankAccount, Contact, FinancialDocument, Title, Movement, DocumentType, TitleStatus } from '@/types/financial';
import { initialCategories, initialAccounts, initialContacts, initialDocuments, initialTitles, initialMovements } from '@/data/mockData';

interface FinancialContextType {
  categories: Category[];
  accounts: BankAccount[];
  contacts: Contact[];
  documents: FinancialDocument[];
  titles: Title[];
  movements: Movement[];
  addDocument: (doc: Omit<FinancialDocument, 'id' | 'createdAt'>, payNow?: boolean, accountId?: string) => { document: FinancialDocument; titles: Title[] };
  payTitle: (titleId: string, accountId: string, paymentDate: string, valuePaid: number) => void;
  addCategory: (cat: Omit<Category, 'id'>) => void;
  addAccount: (acc: Omit<BankAccount, 'id'>) => void;
  addContact: (con: Omit<Contact, 'id'>) => void;
  deleteCategory: (id: string) => void;
  deleteAccount: (id: string) => void;
  deleteContact: (id: string) => void;
  getContactName: (id: string) => string;
  getCategoryName: (id: string) => string;
  getAccountName: (id: string) => string;
  getAccountBalance: (accountId: string) => number;
  getTotalBalance: () => number;
}

const FinancialContext = createContext<FinancialContextType | null>(null);

const uid = () => 'id_' + Math.random().toString(36).substr(2, 9);

export function FinancialProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [accounts, setAccounts] = useState<BankAccount[]>(initialAccounts);
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [documents, setDocuments] = useState<FinancialDocument[]>(initialDocuments);
  const [titles, setTitles] = useState<Title[]>(initialTitles);
  const [movements, setMovements] = useState<Movement[]>(initialMovements);

  const getContactName = useCallback((id: string) => {
    if (!id) return '—';
    return contacts.find(c => c.id === id)?.name ?? '—';
  }, [contacts]);

  const getCategoryName = useCallback((id: string) => {
    return categories.find(c => c.id === id)?.name ?? '—';
  }, [categories]);

  const getAccountName = useCallback((id: string) => {
    return accounts.find(a => a.id === id)?.name ?? '—';
  }, [accounts]);

  const getAccountBalance = useCallback((accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return 0;
    const movs = movements.filter(m => m.accountId === accountId);
    return movs.reduce((sum, m) => sum + (m.type === 'entrada' ? m.valuePaid : -m.valuePaid), account.initialBalance);
  }, [accounts, movements]);

  const getTotalBalance = useCallback(() => {
    return accounts.reduce((sum, acc) => sum + getAccountBalance(acc.id), 0);
  }, [accounts, getAccountBalance]);

  const addDocument = useCallback((docInput: Omit<FinancialDocument, 'id' | 'createdAt'>, payNow = false, accountId?: string) => {
    const docId = uid();
    const doc: FinancialDocument = { ...docInput, id: docId, createdAt: new Date().toISOString().split('T')[0] };
    
    const titleType: 'receber' | 'pagar' = (docInput.type === 'venda' || docInput.type === 'receita') ? 'receber' : 'pagar';
    const numInstallments = docInput.condition === 'parcelado' ? docInput.installments : 1;
    const valuePerInstallment = Math.round((docInput.totalValue / numInstallments) * 100) / 100;
    
    const newTitles: Title[] = [];
    const newMovements: Movement[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (let i = 0; i < numInstallments; i++) {
      const dueDate = new Date(docInput.competenceDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      const titleId = uid();
      const title: Title = {
        id: titleId,
        documentId: docId,
        installment: i + 1,
        totalInstallments: numInstallments,
        dueDate: dueDate.toISOString().split('T')[0],
        value: i === numInstallments - 1 ? docInput.totalValue - valuePerInstallment * (numInstallments - 1) : valuePerInstallment,
        status: payNow && i === 0 ? (titleType === 'receber' ? 'recebido' : 'pago') : 'previsto',
        type: titleType,
        contactId: docInput.contactId,
        categoryId: docInput.categoryId,
        description: docInput.description + (numInstallments > 1 ? ` ${i + 1}/${numInstallments}` : ''),
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

    setDocuments(prev => [...prev, doc]);
    setTitles(prev => [...prev, ...newTitles]);
    if (newMovements.length > 0) setMovements(prev => [...prev, ...newMovements]);

    return { document: doc, titles: newTitles };
  }, []);

  const payTitle = useCallback((titleId: string, accountId: string, paymentDate: string, valuePaid: number) => {
    setTitles(prev => prev.map(t => {
      if (t.id === titleId) {
        return { ...t, status: t.type === 'receber' ? 'recebido' : 'pago' };
      }
      return t;
    }));

    const title = titles.find(t => t.id === titleId);
    if (!title) return;

    setMovements(prev => [...prev, {
      id: uid(),
      titleId,
      accountId,
      paymentDate,
      valuePaid,
      type: title.type === 'receber' ? 'entrada' : 'saida',
    }]);
  }, [titles]);

  const addCategory = useCallback((cat: Omit<Category, 'id'>) => {
    setCategories(prev => [...prev, { ...cat, id: uid() }]);
  }, []);

  const addAccount = useCallback((acc: Omit<BankAccount, 'id'>) => {
    setAccounts(prev => [...prev, { ...acc, id: uid() }]);
  }, []);

  const addContact = useCallback((con: Omit<Contact, 'id'>) => {
    setContacts(prev => [...prev, { ...con, id: uid() }]);
  }, []);

  const deleteCategory = useCallback((id: string) => setCategories(prev => prev.filter(c => c.id !== id)), []);
  const deleteAccount = useCallback((id: string) => setAccounts(prev => prev.filter(a => a.id !== id)), []);
  const deleteContact = useCallback((id: string) => setContacts(prev => prev.filter(c => c.id !== id)), []);

  return (
    <FinancialContext.Provider value={{
      categories, accounts, contacts, documents, titles, movements,
      addDocument, payTitle,
      addCategory, addAccount, addContact,
      deleteCategory, deleteAccount, deleteContact,
      getContactName, getCategoryName, getAccountName,
      getAccountBalance, getTotalBalance,
    }}>
      {children}
    </FinancialContext.Provider>
  );
}

export function useFinancial() {
  const ctx = useContext(FinancialContext);
  if (!ctx) throw new Error('useFinancial must be used within FinancialProvider');
  return ctx;
}
