import { Category, BankAccount, Contact, FinancialDocument, Title, Movement } from '@/types/financial';

export const initialCategories: Category[] = [
  // Receita
  { id: 'cat01', name: 'Vendas de Produtos', type: 'receita' },
  { id: 'cat02', name: 'Vendas de Serviços', type: 'receita' },
  { id: 'cat03', name: 'Outras Receitas', type: 'receita' },
  // Custo
  { id: 'cat04', name: 'Custo de Mercadorias', type: 'custo' },
  { id: 'cat05', name: 'Custo de Serviços', type: 'custo' },
  { id: 'cat06', name: 'Matéria-Prima', type: 'custo' },
  // Despesa
  { id: 'cat07', name: 'Aluguel', type: 'despesa' },
  { id: 'cat08', name: 'Energia Elétrica', type: 'despesa' },
  { id: 'cat09', name: 'Água', type: 'despesa' },
  { id: 'cat10', name: 'Internet / Telefone', type: 'despesa' },
  { id: 'cat11', name: 'Salários', type: 'despesa' },
  { id: 'cat12', name: 'Marketing / Publicidade', type: 'despesa' },
  { id: 'cat13', name: 'Material de Escritório', type: 'despesa' },
  { id: 'cat14', name: 'Transporte', type: 'despesa' },
  { id: 'cat15', name: 'Alimentação', type: 'despesa' },
  { id: 'cat16', name: 'Manutenção', type: 'despesa' },
  { id: 'cat17', name: 'Contador', type: 'despesa' },
  { id: 'cat18', name: 'Seguros', type: 'despesa' },
  { id: 'cat19', name: 'Impostos sobre Vendas', type: 'despesa' },
  // Investimento
  { id: 'cat20', name: 'Equipamentos', type: 'investimento' },
  { id: 'cat21', name: 'Reformas', type: 'investimento' },
  // Financeiro
  { id: 'cat22', name: 'Juros / Multas', type: 'financeiro' },
  { id: 'cat23', name: 'Tarifas Bancárias', type: 'financeiro' },
  { id: 'cat24', name: 'Rendimentos', type: 'financeiro' },
];

export const initialAccounts: BankAccount[] = [
  { id: 'acc01', name: 'Banco Principal', type: 'banco', initialBalance: 15000 },
  { id: 'acc02', name: 'Caixa', type: 'caixa', initialBalance: 2500 },
];

export const initialContacts: Contact[] = [
  { id: 'con01', name: 'Padaria São José', type: 'cliente', phone: '(11) 99123-4567' },
  { id: 'con02', name: 'Restaurante Bom Sabor', type: 'cliente', email: 'contato@bomsabor.com' },
  { id: 'con03', name: 'Loja das Flores', type: 'cliente', phone: '(11) 98765-4321' },
  { id: 'con04', name: 'Maria Silva', type: 'cliente', email: 'maria@email.com' },
  { id: 'con05', name: 'Tech Solutions', type: 'cliente', email: 'contato@techsolutions.com' },
  { id: 'con06', name: 'Distribuidora ABC', type: 'fornecedor', phone: '(11) 3333-4444' },
  { id: 'con07', name: 'Atacadão Materiais', type: 'fornecedor', phone: '(11) 3555-6666' },
  { id: 'con08', name: 'Gráfica Express', type: 'fornecedor', email: 'vendas@graficaexpress.com' },
];

export const initialDocuments: FinancialDocument[] = [
  { id: 'doc01', type: 'venda', contactId: 'con01', categoryId: 'cat01', competenceDate: '2026-01-10', totalValue: 3000, description: 'Venda de produtos - Padaria São José', condition: 'parcelado', installments: 3, createdAt: '2026-01-10' },
  { id: 'doc02', type: 'venda', contactId: 'con02', categoryId: 'cat02', competenceDate: '2026-01-05', totalValue: 5000, description: 'Serviço de consultoria - Restaurante', condition: 'avista', installments: 1, createdAt: '2026-01-05' },
  { id: 'doc03', type: 'compra', contactId: 'con06', categoryId: 'cat04', competenceDate: '2026-01-15', totalValue: 2400, description: 'Compra de mercadorias - Distribuidora', condition: 'parcelado', installments: 2, createdAt: '2026-01-15' },
  { id: 'doc04', type: 'despesa', contactId: '', categoryId: 'cat07', competenceDate: '2026-01-01', totalValue: 2000, description: 'Aluguel Janeiro', condition: 'avista', installments: 1, createdAt: '2026-01-01' },
  { id: 'doc05', type: 'despesa', contactId: '', categoryId: 'cat08', competenceDate: '2026-01-01', totalValue: 450, description: 'Energia Elétrica Janeiro', condition: 'avista', installments: 1, createdAt: '2026-01-05' },
  { id: 'doc06', type: 'venda', contactId: 'con03', categoryId: 'cat01', competenceDate: '2026-02-01', totalValue: 1800, description: 'Venda de arranjos - Loja das Flores', condition: 'parcelado', installments: 2, createdAt: '2026-02-01' },
  { id: 'doc07', type: 'compra', contactId: 'con07', categoryId: 'cat06', competenceDate: '2026-02-01', totalValue: 3600, description: 'Matéria-prima - Atacadão', condition: 'parcelado', installments: 3, createdAt: '2026-02-01' },
  { id: 'doc08', type: 'despesa', contactId: '', categoryId: 'cat10', competenceDate: '2026-02-01', totalValue: 200, description: 'Internet Fevereiro', condition: 'avista', installments: 1, createdAt: '2026-02-01' },
  { id: 'doc09', type: 'receita', contactId: 'con04', categoryId: 'cat03', competenceDate: '2026-02-10', totalValue: 800, description: 'Receita avulsa - Maria Silva', condition: 'avista', installments: 1, createdAt: '2026-02-10' },
  { id: 'doc10', type: 'despesa', contactId: '', categoryId: 'cat12', competenceDate: '2026-02-01', totalValue: 1500, description: 'Campanha Marketing Fevereiro', condition: 'avista', installments: 1, createdAt: '2026-02-01' },
  { id: 'doc11', type: 'venda', contactId: 'con05', categoryId: 'cat02', competenceDate: '2026-02-15', totalValue: 4500, description: 'Projeto de desenvolvimento - Tech Solutions', condition: 'parcelado', installments: 3, createdAt: '2026-02-15' },
  { id: 'doc12', type: 'despesa', contactId: 'con08', categoryId: 'cat13', competenceDate: '2026-02-20', totalValue: 350, description: 'Material de escritório - Gráfica', condition: 'avista', installments: 1, createdAt: '2026-02-20' },
  { id: 'doc13', type: 'despesa', contactId: '', categoryId: 'cat07', competenceDate: '2026-02-01', totalValue: 2000, description: 'Aluguel Fevereiro', condition: 'avista', installments: 1, createdAt: '2026-02-01' },
  { id: 'doc14', type: 'despesa', contactId: '', categoryId: 'cat08', competenceDate: '2026-02-01', totalValue: 480, description: 'Energia Elétrica Fevereiro', condition: 'avista', installments: 1, createdAt: '2026-02-01' },
];

export const initialTitles: Title[] = [
  // Doc01 - 3 parcelas receber
  { id: 'tit01', documentId: 'doc01', installment: 1, totalInstallments: 3, dueDate: '2026-01-15', value: 1000, status: 'recebido', type: 'receber', contactId: 'con01', categoryId: 'cat01', description: 'Padaria São José 1/3' },
  { id: 'tit02', documentId: 'doc01', installment: 2, totalInstallments: 3, dueDate: '2026-02-15', value: 1000, status: 'recebido', type: 'receber', contactId: 'con01', categoryId: 'cat01', description: 'Padaria São José 2/3' },
  { id: 'tit03', documentId: 'doc01', installment: 3, totalInstallments: 3, dueDate: '2026-03-15', value: 1000, status: 'previsto', type: 'receber', contactId: 'con01', categoryId: 'cat01', description: 'Padaria São José 3/3' },
  // Doc02 - à vista receber
  { id: 'tit04', documentId: 'doc02', installment: 1, totalInstallments: 1, dueDate: '2026-01-10', value: 5000, status: 'recebido', type: 'receber', contactId: 'con02', categoryId: 'cat02', description: 'Restaurante Bom Sabor' },
  // Doc03 - 2 parcelas pagar
  { id: 'tit05', documentId: 'doc03', installment: 1, totalInstallments: 2, dueDate: '2026-01-20', value: 1200, status: 'pago', type: 'pagar', contactId: 'con06', categoryId: 'cat04', description: 'Distribuidora ABC 1/2' },
  { id: 'tit06', documentId: 'doc03', installment: 2, totalInstallments: 2, dueDate: '2026-02-20', value: 1200, status: 'atrasado', type: 'pagar', contactId: 'con06', categoryId: 'cat04', description: 'Distribuidora ABC 2/2' },
  // Doc04 - aluguel jan
  { id: 'tit07', documentId: 'doc04', installment: 1, totalInstallments: 1, dueDate: '2026-01-05', value: 2000, status: 'pago', type: 'pagar', contactId: '', categoryId: 'cat07', description: 'Aluguel Janeiro' },
  // Doc05 - energia jan
  { id: 'tit08', documentId: 'doc05', installment: 1, totalInstallments: 1, dueDate: '2026-01-10', value: 450, status: 'pago', type: 'pagar', contactId: '', categoryId: 'cat08', description: 'Energia Elétrica Janeiro' },
  // Doc06 - 2 parcelas receber
  { id: 'tit09', documentId: 'doc06', installment: 1, totalInstallments: 2, dueDate: '2026-02-01', value: 900, status: 'recebido', type: 'receber', contactId: 'con03', categoryId: 'cat01', description: 'Loja das Flores 1/2' },
  { id: 'tit10', documentId: 'doc06', installment: 2, totalInstallments: 2, dueDate: '2026-03-01', value: 900, status: 'previsto', type: 'receber', contactId: 'con03', categoryId: 'cat01', description: 'Loja das Flores 2/2' },
  // Doc07 - 3 parcelas pagar
  { id: 'tit11', documentId: 'doc07', installment: 1, totalInstallments: 3, dueDate: '2026-02-10', value: 1200, status: 'atrasado', type: 'pagar', contactId: 'con07', categoryId: 'cat06', description: 'Atacadão Materiais 1/3' },
  { id: 'tit12', documentId: 'doc07', installment: 2, totalInstallments: 3, dueDate: '2026-03-10', value: 1200, status: 'previsto', type: 'pagar', contactId: 'con07', categoryId: 'cat06', description: 'Atacadão Materiais 2/3' },
  { id: 'tit13', documentId: 'doc07', installment: 3, totalInstallments: 3, dueDate: '2026-04-10', value: 1200, status: 'previsto', type: 'pagar', contactId: 'con07', categoryId: 'cat06', description: 'Atacadão Materiais 3/3' },
  // Doc08 - internet
  { id: 'tit14', documentId: 'doc08', installment: 1, totalInstallments: 1, dueDate: '2026-02-15', value: 200, status: 'pago', type: 'pagar', contactId: '', categoryId: 'cat10', description: 'Internet Fevereiro' },
  // Doc09 - receita avulsa
  { id: 'tit15', documentId: 'doc09', installment: 1, totalInstallments: 1, dueDate: '2026-02-20', value: 800, status: 'atrasado', type: 'receber', contactId: 'con04', categoryId: 'cat03', description: 'Receita avulsa - Maria Silva' },
  // Doc10 - marketing
  { id: 'tit16', documentId: 'doc10', installment: 1, totalInstallments: 1, dueDate: '2026-02-25', value: 1500, status: 'atrasado', type: 'pagar', contactId: '', categoryId: 'cat12', description: 'Marketing Fevereiro' },
  // Doc11 - 3 parcelas receber
  { id: 'tit17', documentId: 'doc11', installment: 1, totalInstallments: 3, dueDate: '2026-03-01', value: 1500, status: 'previsto', type: 'receber', contactId: 'con05', categoryId: 'cat02', description: 'Tech Solutions 1/3' },
  { id: 'tit18', documentId: 'doc11', installment: 2, totalInstallments: 3, dueDate: '2026-04-01', value: 1500, status: 'previsto', type: 'receber', contactId: 'con05', categoryId: 'cat02', description: 'Tech Solutions 2/3' },
  { id: 'tit19', documentId: 'doc11', installment: 3, totalInstallments: 3, dueDate: '2026-05-01', value: 1500, status: 'previsto', type: 'receber', contactId: 'con05', categoryId: 'cat02', description: 'Tech Solutions 3/3' },
  // Doc12 - material
  { id: 'tit20', documentId: 'doc12', installment: 1, totalInstallments: 1, dueDate: '2026-02-28', value: 350, status: 'previsto', type: 'pagar', contactId: 'con08', categoryId: 'cat13', description: 'Gráfica Express' },
  // Doc13 - aluguel fev
  { id: 'tit21', documentId: 'doc13', installment: 1, totalInstallments: 1, dueDate: '2026-02-05', value: 2000, status: 'pago', type: 'pagar', contactId: '', categoryId: 'cat07', description: 'Aluguel Fevereiro' },
  // Doc14 - energia fev
  { id: 'tit22', documentId: 'doc14', installment: 1, totalInstallments: 1, dueDate: '2026-02-10', value: 480, status: 'pago', type: 'pagar', contactId: '', categoryId: 'cat08', description: 'Energia Elétrica Fevereiro' },
  // Extra titles for 24 total
  { id: 'tit23', documentId: 'doc04', installment: 1, totalInstallments: 1, dueDate: '2026-03-05', value: 2000, status: 'previsto', type: 'pagar', contactId: '', categoryId: 'cat07', description: 'Aluguel Março (previsto)' },
  { id: 'tit24', documentId: 'doc05', installment: 1, totalInstallments: 1, dueDate: '2026-03-10', value: 460, status: 'previsto', type: 'pagar', contactId: '', categoryId: 'cat08', description: 'Energia Março (previsto)' },
];

export const initialMovements: Movement[] = [
  { id: 'mov01', titleId: 'tit04', accountId: 'acc01', paymentDate: '2026-01-10', valuePaid: 5000, type: 'entrada' },
  { id: 'mov02', titleId: 'tit07', accountId: 'acc01', paymentDate: '2026-01-05', valuePaid: 2000, type: 'saida' },
  { id: 'mov03', titleId: 'tit08', accountId: 'acc01', paymentDate: '2026-01-10', valuePaid: 450, type: 'saida' },
  { id: 'mov04', titleId: 'tit01', accountId: 'acc01', paymentDate: '2026-01-15', valuePaid: 1000, type: 'entrada' },
  { id: 'mov05', titleId: 'tit05', accountId: 'acc01', paymentDate: '2026-01-20', valuePaid: 1200, type: 'saida' },
  { id: 'mov06', titleId: 'tit21', accountId: 'acc01', paymentDate: '2026-02-05', valuePaid: 2000, type: 'saida' },
  { id: 'mov07', titleId: 'tit22', accountId: 'acc01', paymentDate: '2026-02-10', valuePaid: 480, type: 'saida' },
  { id: 'mov08', titleId: 'tit14', accountId: 'acc02', paymentDate: '2026-02-15', valuePaid: 200, type: 'saida' },
  { id: 'mov09', titleId: 'tit02', accountId: 'acc01', paymentDate: '2026-02-15', valuePaid: 1000, type: 'entrada' },
  { id: 'mov10', titleId: 'tit09', accountId: 'acc01', paymentDate: '2026-02-01', valuePaid: 900, type: 'entrada' },
];
