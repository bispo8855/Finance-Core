import { IFinanceService, FinanceSnapshot, CreateDocumentPayload } from './financeService';
import { supabase } from '@/lib/supabaseClient';
import { Category, BankAccount, Contact, FinancialDocument, Movement, Title } from '@/types/financial';

export class SupabaseFinanceService implements IFinanceService {

  async getSnapshot(): Promise<FinanceSnapshot> {
    const [
      { data: accounts },
      { data: categories },
      { data: contacts },
      { data: documents },
      { data: titles },
      { data: movements }
    ] = await Promise.all([
      supabase.from('accounts').select('*'),
      supabase.from('categories').select('*'),
      supabase.from('contacts').select('*'),
      supabase.from('documents').select('*'),
      supabase.from('titles').select('*'),
      supabase.from('movements').select('*')
    ]);

    if (!accounts || !categories || !contacts || !documents || !titles || !movements) {
      throw new Error('Falha ao obter snapshot do Supabase');
    }

    return {
      accounts: accounts.map(this.mapAccount),
      categories: categories.map(this.mapCategory),
      contacts: contacts.map(this.mapContact),
      documents: documents.map(this.mapDocument),
      titles: titles.map(this.mapTitle),
      movements: movements.map(this.mapMovement)
    };
  }

  async createDocument(payload: CreateDocumentPayload) {
    // 1. Inserir Document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        type: payload.type,
        contact_id: payload.contactId,
        category_id: payload.categoryId,
        competence_date: payload.competenceDate,
        total_amount: payload.totalValue,
        description: payload.description
      })
      .select()
      .single();

    if (docError) throw docError;

    // 2. Preparar e Inserir Titles
    const side = (payload.type === 'venda' || payload.type === 'receita_avulsa') ? 'receber' : 'pagar';
    const titlesToInsert = payload.installments.map(inst => ({
      document_id: doc.id,
      side,
      installment_num: inst.installment,
      installment_total: payload.installments.length,
      due_date: new Date(inst.dueDate.split('/').reverse().join('-')).toISOString().split('T')[0],
      amount: inst.value,
      status: 'previsto'
    }));

    const { data: insertedTitles, error: titlesError } = await supabase
      .from('titles')
      .insert(titlesToInsert)
      .select();

    if (titlesError) throw titlesError;

    return {
      document: this.mapDocument(doc),
      titles: insertedTitles.map(this.mapTitle)
    };
  }

  async settleTitle(titleId: string, accountId: string, paymentDate: string, paidAmount: number, feeAmount: number, notes?: string) {
    // 1. Atualizar o Titulo (pode checar status parcial depois, mas no mock assume recebido)
    const { data: titleData, error: titleFetchError } = await supabase.from('titles').select('*').eq('id', titleId).single();
    if (titleFetchError) throw titleFetchError;

    const currentTitle = this.mapTitle(titleData);
    const newStatus = currentTitle.side === 'receber' ? 'recebido' : 'pago';

    const { data: updatedTitleData, error: titleUpdateError } = await supabase
      .from('titles')
      .update({ status: newStatus })
      .eq('id', titleId)
      .select()
      .single();

    if (titleUpdateError) throw titleUpdateError;

    // 2. Inserir Movement
    const { data: newMovementData, error: movementError } = await supabase
      .from('movements')
      .insert({
        title_id: titleId,
        account_id: accountId,
        payment_date: paymentDate,
        paid_amount: paidAmount,
        fee_amount: feeAmount,
        notes: notes || null
      })
      .select()
      .single();

    if (movementError) throw movementError;

    return {
      updatedTitle: this.mapTitle(updatedTitleData),
      movement: this.mapMovement(newMovementData)
    };
  }

  async updateInitialBalance(accountId: string, value: number): Promise<BankAccount> {
    const { data, error } = await supabase
      .from('accounts')
      .update({ initial_balance: value })
      .eq('id', accountId)
      .select()
      .single();

    if (error) throw error;
    return this.mapAccount(data);
  }

  // --- CATALOGS CRUD ---
  async createCategory(payload: Omit<Category, 'id'>): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .insert({ name: payload.name, kind: payload.type })
      .select()
      .single();
    if (error) throw error;
    return this.mapCategory(data);
  }

  async updateCategory(id: string, payload: Partial<Omit<Category, 'id'>>): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .update({ name: payload.name, kind: payload.type })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return this.mapCategory(data);
  }

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
  }

  async createAccount(payload: Omit<BankAccount, 'id'>): Promise<BankAccount> {
    const { data, error } = await supabase
      .from('accounts')
      .insert({ name: payload.name, initial_balance: payload.initialBalance })
      .select()
      .single();
    if (error) throw error;
    return this.mapAccount(data); // Mapeie 'banco/caixa' conforme regra de negócios. Neste simples usaremos default 'banco' do domain
  }

  async updateAccount(id: string, payload: Partial<Omit<BankAccount, 'id'>>): Promise<BankAccount> {
    const { data, error } = await supabase
      .from('accounts')
      .update({ name: payload.name, initial_balance: payload.initialBalance })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return this.mapAccount(data);
  }

  async deleteAccount(id: string): Promise<void> {
    const { error } = await supabase.from('accounts').delete().eq('id', id);
    if (error) throw error;
  }

  async createContact(payload: Omit<Contact, 'id'>): Promise<Contact> {
    const { data, error } = await supabase
      .from('contacts')
      .insert({ 
        name: payload.name, 
        kind: payload.type,
      }) // Supabase schema não tem email/phone ainda
      .select()
      .single();
    if (error) throw error;
    return this.mapContact({ ...data, email: payload.email, phone: payload.phone });
  }

  async updateContact(id: string, payload: Partial<Omit<Contact, 'id'>>): Promise<Contact> {
    const { data, error } = await supabase
      .from('contacts')
      .update({ name: payload.name, kind: payload.type })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return this.mapContact({ ...data, email: payload.email, phone: payload.phone });
  }

  async deleteContact(id: string): Promise<void> {
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) throw error;
  }

  // --- MAPPERS: Supabase snake_case -> Typescript camelCase ---
  private mapAccount(row: any): BankAccount {
    return {
      id: row.id,
      name: row.name,
      type: 'banco', // TODO: sync schema
      initialBalance: Number(row.initial_balance)
    };
  }

  private mapCategory(row: any): Category {
    return {
      id: row.id,
      name: row.name,
      type: row.kind
    };
  }

  private mapContact(row: any): Contact {
    return {
      id: row.id,
      name: row.name,
      type: row.kind,
      email: row.email,
      phone: row.phone
    };
  }

  private mapDocument(row: any): FinancialDocument {
    return {
      id: row.id,
      type: row.type,
      contactId: row.contact_id,
      categoryId: row.category_id,
      competenceDate: row.competence_date,
      totalValue: Number(row.total_amount),
      description: row.description || '',
      createdAt: row.created_at
    };
  }

  private mapTitle(row: any): Title {
    return {
      id: row.id,
      documentId: row.document_id,
      side: row.side,
      installment: row.installment_num,
      totalInstallments: row.installment_total,
      dueDate: row.due_date,
      originalValue: Number(row.amount),
      status: row.status as any,
      description: `Parcela ${row.installment_num}/${row.installment_total}`, // Campo derivado
      categoryId: '', // Ajustar queries cruzadas se as paginas exigirem ID direto aqui
      contactId: ''   // Idem
    };
  }

  private mapMovement(row: any): Movement {
    return {
      id: row.id,
      accountId: row.account_id,
      titleId: row.title_id,
      date: row.payment_date,
      valuePaid: Number(row.paid_amount),
      feeValue: Number(row.fee_amount),
      type: 'saida', // Depende do Join do Titulo para ser Entrada ou Saida
      description: row.notes || ''
    };
  }
}

// Export a singleton instance
export const supabaseFinanceService = new SupabaseFinanceService();
