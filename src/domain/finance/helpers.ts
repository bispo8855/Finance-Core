import { Contact, Category, DocumentType } from '@/types/financial';

export function filterContactsForDocumentType(contacts: Contact[], documentType: DocumentType): Contact[] {
  const isReceita = documentType === 'receita';
  return contacts.filter(c => isReceita ? c.type === 'cliente' : c.type === 'fornecedor');
}

export function filterCategoriesForDocumentType(categories: Category[], documentType: DocumentType): Category[] {
  const isReceita = documentType === 'receita';
  return categories.filter(c => {
    if (isReceita) return c.type === 'receita' || c.type === 'investimento';
    return c.type === 'despesa' || c.type === 'custo' || c.type === 'financeiro';
  });
}
