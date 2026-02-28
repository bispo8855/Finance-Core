import { useMutation, useQueryClient } from '@tanstack/react-query';
import { financeService } from '@/services/finance';
import { useFinanceSnapshot } from './useFinanceSnapshot';
import { Category, BankAccount, Contact } from '@/types/financial';

export function useCategories() {
  const { data } = useFinanceSnapshot();
  return { categories: data?.categories || [] };
}

export function useAccounts() {
  const { data } = useFinanceSnapshot();
  return { accounts: data?.accounts || [] };
}

export function useContacts() {
  const { data } = useFinanceSnapshot();
  return { contacts: data?.contacts || [] };
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<Category, 'id'>) => financeService.createCategory(payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['finance', 'snapshot'] }); }
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeService.deleteCategory(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['finance', 'snapshot'] }); }
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<BankAccount, 'id'>) => financeService.createAccount(payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['finance', 'snapshot'] }); }
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeService.deleteAccount(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['finance', 'snapshot'] }); }
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<Contact, 'id'>) => financeService.createContact(payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['finance', 'snapshot'] }); }
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeService.deleteContact(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['finance', 'snapshot'] }); }
  });
}
