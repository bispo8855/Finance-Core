import { IFinanceService, FinanceSnapshot, CreateDocumentPayload, UserProfile } from './financeService';
import { supabase } from '@/lib/supabaseClient';
import { Category, BankAccount, Contact, FinancialDocument, Movement, Title } from '@/types/financial';

export class SupabaseFinanceService implements IFinanceService {

  private async getUserId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado no Supabase');
    return user.id;
  }

  async getProfile(): Promise<UserProfile | null> {
    const userId = await this.getUserId();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is code for no rows found
    if (!data) return null;

    return {
      id: data.id,
      onboardingCompleted: data.onboarding_completed
    };
  }

  async updateProfile(payload: Partial<Omit<UserProfile, 'id'>>): Promise<UserProfile> {
    const userId = await this.getUserId();
    const updateData: Record<string, unknown> = {};
    if (payload.onboardingCompleted !== undefined) updateData.onboarding_completed = payload.onboardingCompleted;

    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...updateData })
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      onboardingCompleted: data.onboarding_completed
    };
  }

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
      titles: titles.map(t => this.mapTitle(t)),
      movements: movements.map(m => {
        const title = titles.find(t => t.id === m.title_id);
        return this.mapMovement(m, title?.side);
      })
    };
  }

  async createDocument(payload: CreateDocumentPayload, payNow = false, accountId?: string) {
    console.log("SUPABASE SERVICE ATIVO - createDocument");
    const userId = await this.getUserId();
    // 1. Inserir Document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        type: payload.type === 'receita' ? 'receita_avulsa' : payload.type,
        contact_id: payload.contactId,
        category_id: payload.categoryId,
        competence_date: payload.competenceDate,
        total_amount: payload.totalValue,
        description: payload.description,
        gross_amount: payload.grossAmount,
        marketplace_fee: payload.marketplaceFee,
        shipping_cost: payload.shippingCost
      })
      .select()
      .single();

    if (docError) throw docError;

    // 2. Preparar e Inserir Titles
    const titleType: 'receber' | 'pagar' = (payload.type === 'venda' || payload.type === 'receita') ? 'receber' : 'pagar';
    const numInstallments = payload.condition === 'parcelado' ? payload.installments : 1;

    const titlesToInsert = [];
    
    if (payload.condition === 'parcelado' && payload.customInstallments && payload.customInstallments.length > 0) {
      if (payload.customInstallments.length !== numInstallments) {
         throw new Error('Número de parcelas customizadas destoa do total informado.');
      }
      for (let i = 0; i < numInstallments; i++) {
        const custom = payload.customInstallments[i];
        titlesToInsert.push({
          user_id: userId,
          document_id: doc.id,
          side: titleType,
          installment_num: i + 1,
          installment_total: numInstallments,
          due_date: custom.dueDate,
          amount: custom.value,
          status: payNow && i === 0 ? (titleType === 'receber' ? 'recebido' : 'pago') : 'previsto'
        });
      }
    } else {
      // Fallback: Automatic splitting logic
      const valuePerInstallment = Math.round((payload.totalValue / numInstallments) * 100) / 100;
      const initialDate = payload.firstDueDate || payload.competenceDate;

      for (let i = 0; i < numInstallments; i++) {
        const dueDate = new Date(initialDate + 'T12:00:00');
        dueDate.setMonth(dueDate.getMonth() + i);

        titlesToInsert.push({
          user_id: userId,
          document_id: doc.id,
          side: titleType,
          installment_num: i + 1,
          installment_total: numInstallments,
          due_date: dueDate.toISOString().split('T')[0],
          amount: i === numInstallments - 1 ? payload.totalValue - valuePerInstallment * (numInstallments - 1) : valuePerInstallment,
          status: payNow && i === 0 ? (titleType === 'receber' ? 'recebido' : 'pago') : 'previsto'
        });
      }
    }

    const { data: insertedTitles, error: titlesError } = await supabase
      .from('titles')
      .insert(titlesToInsert)
      .select();

    if (titlesError) throw titlesError;

    // 3. Movement (if payNow)
    const newMovements = [];
    if (payNow && accountId) {
      const firstTitle = insertedTitles[0]; // parcel 1
      const today = new Date().toISOString().split('T')[0];
      const { data: newMovement, error: movError } = await supabase
        .from('movements')
        .insert({
          user_id: userId,
          title_id: firstTitle.id,
          account_id: accountId,
          payment_date: today,
          paid_amount: firstTitle.amount,
          fee_amount: 0,
          notes: ''
        })
        .select()
        .single();
      
      if (movError) throw movError;
      newMovements.push(this.mapMovement(newMovement, titleType));

      // Update title with settlement info
      const { error: updateTitleError } = await supabase
        .from('titles')
        .update({ 
          settled_at: today,
          settlement_movement_id: newMovement.id
        })
        .eq('id', firstTitle.id);

      if (updateTitleError) throw updateTitleError;
      insertedTitles[0].settled_at = today;
      insertedTitles[0].settlement_movement_id = newMovement.id;
    }

    return {
      document: this.mapDocument({ ...doc, condition: payload.condition, installments: numInstallments }),
      titles: insertedTitles.map(t => this.mapTitle(t)),
      movements: newMovements
    };
  }

  async updateDocument(documentId: string, payload: CreateDocumentPayload) {
    console.log("SUPABASE SERVICE ATIVO - updateDocument");
    const userId = await this.getUserId();

    // 1. Check if any existing title is paid
    const { data: existingTitles, error: fetchError } = await supabase
      .from('titles')
      .select('status')
      .eq('document_id', documentId);
    
    if (fetchError) throw fetchError;
    if (existingTitles.some(t => t.status === 'pago' || t.status === 'recebido')) {
      throw new Error('Não é possível editar um lançamento que já possui baixas. Exclua a baixa primeiro.');
    }

    // 2. Delete existing titles
    const { error: deleteError } = await supabase
      .from('titles')
      .delete()
      .eq('document_id', documentId);
    if (deleteError) throw deleteError;

    // 3. Update Document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .update({
        type: payload.type === 'receita' ? 'receita_avulsa' : payload.type,
        contact_id: payload.contactId,
        category_id: payload.categoryId,
        competence_date: payload.competenceDate,
        total_amount: payload.totalValue,
        description: payload.description
      })
      .eq('id', documentId)
      .select()
      .single();

    if (docError) throw docError;

    // 4. Create new Titles
    const titleType: 'receber' | 'pagar' = (payload.type === 'venda' || payload.type === 'receita') ? 'receber' : 'pagar';
    const numInstallments = payload.condition === 'parcelado' ? payload.installments : 1;

    const titlesToInsert = [];
    
    if (payload.condition === 'parcelado' && payload.customInstallments && payload.customInstallments.length > 0) {
      if (payload.customInstallments.length !== numInstallments) {
         throw new Error('Número de parcelas customizadas destoa do total informado.');
      }
      for (let i = 0; i < numInstallments; i++) {
        const custom = payload.customInstallments[i];
        titlesToInsert.push({
          user_id: userId,
          document_id: doc.id,
          side: titleType,
          installment_num: i + 1,
          installment_total: numInstallments,
          due_date: custom.dueDate,
          amount: custom.value,
          status: 'previsto'
        });
      }
    } else {
      // Fallback: Automatic splitting logic
      const valuePerInstallment = Math.round((payload.totalValue / numInstallments) * 100) / 100;
      for (let i = 0; i < numInstallments; i++) {
        const dueDate = new Date(payload.competenceDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        titlesToInsert.push({
          user_id: userId,
          document_id: doc.id,
          side: titleType,
          installment_num: i + 1,
          installment_total: numInstallments,
          due_date: dueDate.toISOString().split('T')[0],
          amount: i === numInstallments - 1 ? payload.totalValue - valuePerInstallment * (numInstallments - 1) : valuePerInstallment,
          status: 'previsto'
        });
      }
    }

    const { data: insertedTitles, error: titlesError } = await supabase
      .from('titles')
      .insert(titlesToInsert)
      .select();

    if (titlesError) throw titlesError;

    return {
      document: this.mapDocument({ ...doc, condition: payload.condition, installments: numInstallments }),
      titles: insertedTitles.map(t => this.mapTitle(t))
    };
  }

  async settleTitle(titleId: string, accountId: string, paymentDate: string, valuePaid: number, notes?: string) {
    console.log("SUPABASE SERVICE ATIVO - settleTitle");
    const userId = await this.getUserId();
    const { data: titleData, error: titleFetchError } = await supabase.from('titles').select('*').eq('id', titleId).single();
    if (titleFetchError) throw titleFetchError;

    const currentTitle = this.mapTitle(titleData);
    const newStatus = currentTitle.side === 'receber' ? 'recebido' : 'pago';

    const isPartial = valuePaid < currentTitle.value;
    const remainingValue = currentTitle.value - valuePaid;

    // 1. Inserir Movement
    const { data: newMovementData, error: movementError } = await supabase
      .from('movements')
      .insert({
        user_id: userId,
        title_id: titleId,
        account_id: accountId,
        payment_date: paymentDate,
        paid_amount: valuePaid,
        fee_amount: 0,
        notes: notes || null
      })
      .select()
      .single();

    if (movementError) throw movementError;

    // 2. Atualizar o Titulo atual
    const { data: updatedTitleData, error: titleUpdateError } = await supabase
      .from('titles')
      .update({ 
        status: newStatus,
        settled_at: paymentDate,
        settlement_movement_id: newMovementData.id,
        amount: isPartial ? valuePaid : currentTitle.value
      })
      .eq('id', titleId)
      .select()
      .single();

    if (titleUpdateError) throw titleUpdateError;

    // 3. Se for parcial, criar novo Titulo com o restante
    if (isPartial && remainingValue > 0) {
      const { error: newTitleError } = await supabase
        .from('titles')
        .insert({
          user_id: userId,
          document_id: currentTitle.documentId,
          side: currentTitle.side,
          installment_num: currentTitle.installment,
          installment_total: currentTitle.totalInstallments,
          due_date: currentTitle.dueDate,
          amount: remainingValue,
          status: 'previsto'
        });
      if (newTitleError) {
        console.error('Erro ao gerar parcela restante', newTitleError);
      }
    }

    return {
      updatedTitle: this.mapTitle(updatedTitleData),
      movement: this.mapMovement(newMovementData, currentTitle.side)
    };
  }

  async undoSettleTitle(titleId: string): Promise<{ updatedTitle: Title }> {
    console.log("SUPABASE SERVICE ATIVO - undoSettleTitle");
    const userId = await this.getUserId();

    // 1. Fetch movements linked to title
    const { data: movements, error: movError } = await supabase
      .from('movements')
      .select('id')
      .eq('title_id', titleId)
      .eq('user_id', userId);

    if (movError) {
      console.error(movError);
      throw new Error('Erro ao buscar movimentações para estorno.');
    }

    if (!movements || movements.length === 0) {
      throw new Error('Não há baixa para estornar (nenhuma movimentação encontrada).');
    }

    // 2. Delete linked movements
    const { error: deleteMovError } = await supabase
      .from('movements')
      .delete()
      .in('id', movements.map(m => m.id))
      .eq('user_id', userId);

    if (deleteMovError) {
      console.error(deleteMovError);
      throw new Error('Erro ao deletar movimentações do título.');
    }

    // 3. Update title back to 'previsto'
    const { data: updatedTitleData, error: updateError } = await supabase
      .from('titles')
      .update({
        status: 'previsto',
        settled_at: null,
        settlement_movement_id: null
      })
      .eq('id', titleId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error(updateError);
      throw new Error('Erro ao atualizar status do título para previsto.');
    }

    return {
      updatedTitle: this.mapTitle(updatedTitleData)
    };
  }

  async updateTitle(titleId: string, payload: { dueDate?: string; description?: string }): Promise<Title> {
    console.log("SUPABASE SERVICE ATIVO - updateTitle", { titleId, payload });
    
    if (!titleId) throw new Error('ID do título é obrigatório.');
    if (!payload.dueDate && payload.description === undefined) {
       throw new Error('Nenhum dado fornecido para atualização do título.');
    }

    const userId = await this.getUserId();

    const updateData: Record<string, unknown> = {};
    if (payload.dueDate !== undefined) updateData.due_date = payload.dueDate;
    if (payload.description !== undefined) updateData.description = payload.description;

    const { data, error } = await supabase
      .from('titles')
      .update(updateData)
      .eq('id', titleId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Erro detalhado Supabase (updateTitle):', error);
      throw new Error(`Erro ao atualizar título no Supabase: ${error.message}`);
    }

    if (!data) throw new Error('Título não encontrado ou não permitido para este usuário.');

    return this.mapTitle(data);
  }

  async deleteTitle(titleId: string): Promise<void> {
    console.log("SUPABASE SERVICE ATIVO - deleteTitle");
    const userId = await this.getUserId();

    // 1. Check if there are movements
    const { count, error: movError } = await supabase
      .from('movements')
      .select('*', { count: 'exact', head: true })
      .eq('title_id', titleId);

    if (movError) {
      console.error(movError);
      throw new Error('Erro ao verificar movimentações do título.');
    }
    if (count && count > 0) {
      throw new Error('Não é possível excluir: título possui movimentações.');
    }

    // 2. Fetch title to check status and document_id
    const { data: title, error: titleError } = await supabase
      .from('titles')
      .select('status, document_id')
      .eq('id', titleId)
      .single();

    if (titleError) {
      console.error(titleError);
      throw new Error('Erro ao buscar título para exclusão.');
    }
    if (title.status === 'pago' || title.status === 'recebido') {
      throw new Error('Não é possível excluir: título já liquidado.');
    }

    // 3. Delete title
    const { error: deleteError } = await supabase
      .from('titles')
      .delete()
      .eq('id', titleId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error(deleteError);
      throw new Error('Erro ao excluir título no Supabase.');
    }

    // 4. Check if document has other titles, if not, delete document
    const { count: titlesCount, error: countError } = await supabase
      .from('titles')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', title.document_id);

    if (!countError && titlesCount === 0) {
      await supabase.from('documents').delete().eq('id', title.document_id).eq('user_id', userId);
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    console.log("SUPABASE SERVICE ATIVO - deleteDocument");
    const userId = await this.getUserId();

    // 1. Fetch titles for the document to check statuses
    const { data: titles, error: titlesError } = await supabase
      .from('titles')
      .select('id, status')
      .eq('document_id', documentId);

    if (titlesError) {
      console.error(titlesError);
      throw new Error('Erro ao buscar títulos do documento para exclusão.');
    }

    if (!titles || titles.length === 0) {
      // no titles, maybe document is empty, just delete document
      const { error: docError } = await supabase.from('documents').delete().eq('id', documentId).eq('user_id', userId);
      if (docError) throw new Error('Erro ao excluir documento.');
      return;
    }

    const hasSettled = titles.some(t => t.status === 'pago' || t.status === 'recebido');
    if (hasSettled) {
      throw new Error('Este lançamento possui parcelas baixadas. Estorne as baixas primeiro para poder excluí-lo.');
    }

    const titleIds = titles.map(t => t.id);

    // 2. Check if any has movements
    const { count, error: movError } = await supabase
      .from('movements')
      .select('*', { count: 'exact', head: true })
      .in('title_id', titleIds);

    if (movError) {
      console.error(movError);
      throw new Error('Erro ao verificar movimentações das parcelas.');
    }
    if (count && count > 0) {
      throw new Error('Não é possível excluir: existem movimentações vinculadas às parcelas.');
    }

    // 3. Delete titles
    const { error: deleteTitlesError } = await supabase
      .from('titles')
      .delete()
      .in('id', titleIds)
      .eq('user_id', userId);

    if (deleteTitlesError) {
      console.error(deleteTitlesError);
      throw new Error('Erro ao excluir títulos no Supabase.');
    }

    // 4. Delete document
    const { error: deleteDocError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('user_id', userId);

    if (deleteDocError) {
      console.error(deleteDocError);
      throw new Error('Erro ao excluir documento no Supabase.');
    }
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
    const userId = await this.getUserId();
    const { data, error } = await supabase
      .from('categories')
      .insert({ user_id: userId, name: payload.name, kind: payload.type, dre_classification: payload.dreClassification, is_active: payload.isActive ?? true })
      .select()
      .single();
    if (error) throw error;
    return this.mapCategory(data);
  }

  async updateCategory(id: string, payload: Partial<Omit<Category, 'id'>>): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .update({ name: payload.name, kind: payload.type, dre_classification: payload.dreClassification, is_active: payload.isActive })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return this.mapCategory(data);
  }

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase.from('categories').update({ is_active: false }).eq('id', id);
    if (error) throw error;
  }

  async createAccount(payload: Omit<BankAccount, 'id'>): Promise<BankAccount> {
    const userId = await this.getUserId();
    const { data, error } = await supabase
      .from('accounts')
      .insert({ 
        user_id: userId, 
        name: payload.name, 
        initial_balance: payload.initialBalance,
        opening_balance: payload.openingBalance,
        opening_balance_date: payload.openingBalanceDate,
        institution: payload.institution,
        is_active: payload.isActive ?? true
      })
      .select()
      .single();
    if (error) throw error;
    return this.mapAccount(data); // Mapeie 'banco/caixa' conforme regra de negócios. Neste simples usaremos default 'banco' do domain
  }

  async updateAccount(id: string, payload: Partial<Omit<BankAccount, 'id'>>): Promise<BankAccount> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { name: payload.name };
    if (payload.initialBalance !== undefined) updateData.initial_balance = payload.initialBalance;
    if (payload.openingBalance !== undefined) updateData.opening_balance = payload.openingBalance;
    if (payload.openingBalanceDate !== undefined) updateData.opening_balance_date = payload.openingBalanceDate;
    if (payload.institution !== undefined) updateData.institution = payload.institution;
    if (payload.isActive !== undefined) updateData.is_active = payload.isActive;

    const { data, error } = await supabase
      .from('accounts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return this.mapAccount(data);
  }

  async deleteAccount(id: string): Promise<void> {
    const { error } = await supabase.from('accounts').update({ is_active: false }).eq('id', id);
    if (error) throw error;
  }

  async createContact(payload: Omit<Contact, 'id'>): Promise<Contact> {
    const userId = await this.getUserId();
    const { data, error } = await supabase
      .from('contacts')
      .insert({ 
        user_id: userId,
        name: payload.name, 
        kind: payload.type,
        document: payload.document,
        email: payload.email,
        phone: payload.phone,
        notes: payload.notes,
        is_active: payload.isActive ?? true
      })
      .select()
      .single();
    if (error) throw error;
    return this.mapContact(data);
  }

  async updateContact(id: string, payload: Partial<Omit<Contact, 'id'>>): Promise<Contact> {
    const { data, error } = await supabase
      .from('contacts')
      .update({ 
        name: payload.name, 
        kind: payload.type,
        document: payload.document,
        email: payload.email,
        phone: payload.phone,
        notes: payload.notes,
        is_active: payload.isActive 
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return this.mapContact(data);
  }

  async deleteContact(id: string): Promise<void> {
    const { error } = await supabase.from('contacts').update({ is_active: false }).eq('id', id);
    if (error) throw error;
  }

  // --- MAPPERS: Supabase snake_case -> Typescript camelCase ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapAccount(row: Record<string, any>): BankAccount {
    return {
      id: row.id,
      name: row.name,
      type: 'banco', // TODO: sync schema
      institution: row.institution,
      initialBalance: Number(row.initial_balance),
      openingBalance: Number(row.opening_balance || 0),
      openingBalanceDate: row.opening_balance_date || null,
      isActive: row.is_active !== false
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapCategory(row: Record<string, any>): Category {
    return {
      id: row.id,
      name: row.name,
      type: row.kind,
      dreClassification: row.dre_classification,
      isActive: row.is_active !== false
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapContact(row: Record<string, any>): Contact {
    return {
      id: row.id,
      name: row.name,
      type: row.kind,
      document: row.document,
      email: row.email,
      phone: row.phone,
      notes: row.notes,
      isActive: row.is_active !== false
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapDocument(row: Record<string, any>): FinancialDocument {
    return {
      id: row.id,
      type: row.type === 'receita_avulsa' ? 'receita' : row.type,
      contactId: row.contact_id,
      categoryId: row.category_id,
      competenceDate: row.competence_date,
      totalValue: Number(row.total_amount),
      description: row.description || '',
      condition: row.condition || 'avista',
      installments: row.installments || 1,
      createdAt: row.created_at,
      grossAmount: row.gross_amount ? Number(row.gross_amount) : undefined,
      marketplaceFee: row.marketplace_fee ? Number(row.marketplace_fee) : undefined,
      shippingCost: row.shipping_cost ? Number(row.shipping_cost) : undefined
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapTitle(row: Record<string, any>): Title {
    return {
      id: row.id,
      documentId: row.document_id,
      side: row.side,
      installment: row.installment_num,
      totalInstallments: row.installment_total,
      dueDate: row.due_date,
      value: Number(row.amount),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: row.status as any,
      description: row.description || '',
      categoryId: '',
      contactId: '',
      settledAt: row.settled_at || undefined,
      settlementMovementId: row.settlement_movement_id || undefined
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapMovement(row: Record<string, any>, titleSide?: 'receber' | 'pagar'): Movement {
    return {
      id: row.id,
      accountId: row.account_id,
      titleId: row.title_id,
      paymentDate: row.payment_date,
      valuePaid: Number(row.paid_amount),
      feeAmount: Number(row.fee_amount || 0),
      notes: row.notes || '',
      type: titleSide === 'receber' ? 'entrada' : 'saida',
    };
  }
}

// Export a singleton instance
export const supabaseFinanceService = new SupabaseFinanceService();
