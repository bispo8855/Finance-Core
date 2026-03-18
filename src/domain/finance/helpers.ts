import { Contact, Category, DocumentType } from '@/types/financial';

export function filterContactsForDocumentType(contacts: Contact[], documentType: DocumentType): Contact[] {
  const isReceita = documentType === 'venda' || documentType === 'receita';
  return contacts.filter(c => isReceita ? (c.type === 'cliente' || c.type === 'ambos') : (c.type === 'fornecedor' || c.type === 'ambos'));
}

export function filterCategoriesForDocumentType(categories: Category[], documentType: DocumentType): Category[] {
  const isReceita = documentType === 'venda' || documentType === 'receita';
  return categories.filter(c => {
    if (isReceita) return c.type === 'receita' || c.type === 'investimento';
    return c.type === 'despesa' || c.type === 'custo' || c.type === 'financeiro';
  });
}
