import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// Carrega as variáveis do .env.local manualmente para não depender de pacotes externos
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf-8');
  envConfig.split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      value = value.replace(/(^['"]|['"]$)/g, ''); // remove aspas se houver
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const DEFAULT_CATEGORIES = [
  // Receita
  { name: 'Vendas de Produtos', kind: 'receita', dre_classification: 'receita_bruta' },
  { name: 'Vendas de Serviços', kind: 'receita', dre_classification: 'receita_bruta' },
  { name: 'Outras Receitas', kind: 'receita', dre_classification: 'outras_receitas' },
  // Custo
  { name: 'Custo de Mercadorias', kind: 'custo', dre_classification: 'cmv' },
  { name: 'Custo de Serviços', kind: 'custo', dre_classification: 'csv' },
  { name: 'Matéria-Prima', kind: 'custo', dre_classification: 'cmv' },
  // Despesa
  { name: 'Aluguel', kind: 'despesa', dre_classification: 'despesas_operacionais' },
  { name: 'Energia Elétrica', kind: 'despesa', dre_classification: 'despesas_operacionais' },
  { name: 'Água', kind: 'despesa', dre_classification: 'despesas_operacionais' },
  { name: 'Internet / Telefone', kind: 'despesa', dre_classification: 'despesas_operacionais' },
  { name: 'Salários', kind: 'despesa', dre_classification: 'despesas_com_pessoal' },
  { name: 'Marketing / Publicidade', kind: 'despesa', dre_classification: 'despesas_operacionais' },
  { name: 'Material de Escritório', kind: 'despesa', dre_classification: 'despesas_operacionais' },
  { name: 'Transporte', kind: 'despesa', dre_classification: 'despesas_operacionais' },
  { name: 'Alimentação', kind: 'despesa', dre_classification: 'despesas_operacionais' },
  { name: 'Manutenção', kind: 'despesa', dre_classification: 'despesas_operacionais' },
  { name: 'Contador', kind: 'despesa', dre_classification: 'despesas_operacionais' },
  { name: 'Seguros', kind: 'despesa', dre_classification: 'despesas_operacionais' },
  { name: 'Impostos sobre Vendas', kind: 'despesa', dre_classification: 'impostos_vendas' },
  // Investimento
  { name: 'Equipamentos', kind: 'investimento', dre_classification: 'investimentos' },
  { name: 'Reformas', kind: 'investimento', dre_classification: 'investimentos' },
  // Financeiro
  { name: 'Juros / Multas', kind: 'financeiro', dre_classification: 'despesas_financeiras' },
  { name: 'Tarifas Bancárias', kind: 'financeiro', dre_classification: 'despesas_financeiras' },
  { name: 'Rendimentos', kind: 'financeiro', dre_classification: 'receitas_financeiras' },
];

async function main() {
  const email = process.argv[2] || '3ammagine@gmail.com';

  console.log(`=== RESET COMPLETO DO USUÁRIO ===`);
  console.log(`Usuário alvo: ${email}\n`);

  rl.question(`Digite a senha para ${email}: `, async (password) => {
    try {
      console.log('\nAutenticando...');
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        throw new Error(`Falha na autenticação: ${authError?.message || 'Usuário não encontrado'}`);
      }

      const userId = authData.user.id;
      console.log(`Autenticado com sucesso! User ID: ${userId}\n`);

      console.log('1. Apagando Movimentações...');
      const { error: errMov } = await supabase.from('movements').delete().eq('user_id', userId);
      if (errMov) console.error('Erro deletando movements:', errMov);

      console.log('2. Apagando Títulos...');
      const { error: errTit } = await supabase.from('titles').delete().eq('user_id', userId);
      if (errTit) console.error('Erro deletando titles:', errTit);

      console.log('3. Apagando Documentos...');
      const { error: errDoc } = await supabase.from('documents').delete().eq('user_id', userId);
      if (errDoc) console.error('Erro deletando documents:', errDoc);

      console.log('4. Apagando Categorias...');
      const { error: errCat } = await supabase.from('categories').delete().eq('user_id', userId);
      if (errCat) console.error('Erro deletando categories:', errCat);

      console.log('5. Apagando Contas...');
      const { error: errAcc } = await supabase.from('accounts').delete().eq('user_id', userId);
      if (errAcc) console.error('Erro deletando accounts:', errAcc);

      console.log('6. Apagando Contatos...');
      const { error: errCon } = await supabase.from('contacts').delete().eq('user_id', userId);
      if (errCon) console.error('Erro deletando contacts:', errCon);

      console.log('\nTodos os dados de negócio foram apagados com sucesso!');
      console.log('Os dados órfãos/íntegros foram mantidos já que respeitamos a ordem (e ON DELETE CASCADE).');
      console.log('O usuário/login na auth.users ainda está ativo.\n');

      console.log('--- RECRIAÇÃO DE DADOS PADRÃO ---');

      console.log('Criando Conta Principal...');
      const { error: accInsertErr } = await supabase.from('accounts').insert({
        user_id: userId,
        name: 'Conta Principal',
        initial_balance: 0,
        institution: 'Banco Principal'
      });
      if (accInsertErr) console.error('Erro ao criar conta:', accInsertErr);

      console.log('Criando Categorias Padrão (receitas, despesas, etc)...');
      const catsToInsert = DEFAULT_CATEGORIES.map(c => ({
        user_id: userId,
        name: c.name,
        kind: c.kind,
        dre_classification: c.dre_classification,
        is_active: true
      }));

      const { error: catInsertErr } = await supabase.from('categories').insert(catsToInsert);
      if (catInsertErr) console.error('Erro ao criar categorias:', catInsertErr);

      console.log('\n✅ Reset e configuração mínima concluídos!');

    } catch (err) {
      console.error('\n❌ Ocorreu um erro:', (err as Error).message);
    } finally {
      rl.close();
      process.exit(0);
    }
  });
}

main();
