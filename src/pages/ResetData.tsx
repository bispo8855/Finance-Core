import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const DEFAULT_CATEGORIES = [
  // Receita
  { name: 'Vendas de Produtos', kind: 'receita', dre_classification: 'receita_bruta' },
  { name: 'Vendas de Serviços', kind: 'receita', dre_classification: 'receita_bruta' },
  { name: 'Outras Receitas', kind: 'receita', dre_classification: 'receita_bruta' },
  // Custo
  { name: 'Custo de Mercadorias', kind: 'custo', dre_classification: 'custo_variavel' },
  { name: 'Custo de Serviços', kind: 'custo', dre_classification: 'custo_variavel' },
  { name: 'Matéria-Prima', kind: 'custo', dre_classification: 'custo_variavel' },
  // Despesa
  { name: 'Aluguel', kind: 'despesa', dre_classification: 'despesa_fixa' },
  { name: 'Energia Elétrica', kind: 'despesa', dre_classification: 'despesa_fixa' },
  { name: 'Água', kind: 'despesa', dre_classification: 'despesa_fixa' },
  { name: 'Internet / Telefone', kind: 'despesa', dre_classification: 'despesa_fixa' },
  { name: 'Salários', kind: 'despesa', dre_classification: 'despesa_fixa' },
  { name: 'Marketing / Publicidade', kind: 'despesa', dre_classification: 'despesa_fixa' },
  { name: 'Material de Escritório', kind: 'despesa', dre_classification: 'despesa_fixa' },
  { name: 'Transporte', kind: 'despesa', dre_classification: 'despesa_fixa' },
  { name: 'Alimentação', kind: 'despesa', dre_classification: 'despesa_fixa' },
  { name: 'Manutenção', kind: 'despesa', dre_classification: 'despesa_fixa' },
  { name: 'Contador', kind: 'despesa', dre_classification: 'despesa_fixa' },
  { name: 'Seguros', kind: 'despesa', dre_classification: 'despesa_fixa' },
  { name: 'Impostos sobre Vendas', kind: 'despesa', dre_classification: 'deducao_imposto' },
  // Investimento
  { name: 'Equipamentos', kind: 'investimento', dre_classification: 'investimento' },
  { name: 'Reformas', kind: 'investimento', dre_classification: 'investimento' },
  // Financeiro
  { name: 'Juros / Multas', kind: 'financeiro', dre_classification: 'financeiro' },
  { name: 'Tarifas Bancárias', kind: 'financeiro', dre_classification: 'financeiro' },
  { name: 'Rendimentos', kind: 'financeiro', dre_classification: 'financeiro' },
];

export default function ResetData() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  const handleReset = async () => {
    if (!session?.user) {
      addLog('ERRO: Nenhum usuário logado!');
      return;
    }
    const userId = session.user.id;
    setLoading(true);
    addLog(`Iniciando reset para o usuário: ${session.user.email}`);

    try {
      addLog('1. Apagando Movimentações...');
      await supabase.from('movements').delete().eq('user_id', userId);

      addLog('2. Apagando Títulos...');
      await supabase.from('titles').delete().eq('user_id', userId);

      addLog('3. Apagando Documentos...');
      await supabase.from('documents').delete().eq('user_id', userId);

      addLog('4. Apagando Categorias...');
      await supabase.from('categories').delete().eq('user_id', userId);

      addLog('5. Apagando Contas...');
      await supabase.from('accounts').delete().eq('user_id', userId);

      addLog('6. Apagando Contatos...');
      await supabase.from('contacts').delete().eq('user_id', userId);

      addLog('✅ Todos os dados antigos foram apagados com sucesso!');

      addLog('--- RECRIAÇÃO DE DADOS PADRÃO ---');
      addLog('Criando Conta Principal...');
      const { error: accInsertErr } = await supabase.from('accounts').insert({
        user_id: userId,
        name: 'Conta Principal',
        initial_balance: 0,
        institution: 'Banco Principal'
      });
      if (accInsertErr) addLog(`Erro ao criar conta: ${accInsertErr.message}`);

      addLog('Criando Categorias Padrão...');
      const catsToInsert = DEFAULT_CATEGORIES.map(c => ({
        user_id: userId,
        name: c.name,
        kind: c.kind,
        dre_classification: c.dre_classification,
        is_active: true
      }));

      const { error: catInsertErr } = await supabase.from('categories').insert(catsToInsert);
      if (catInsertErr) addLog(`Erro ao criar categorias: ${catInsertErr.message}`);

      addLog('🎉 CONCLUÍDO! O perfil foi limpo e reconstruído.');
    } catch (error) {
      addLog(`❌ ERRO: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto mt-20">
      <h1 className="text-2xl font-bold mb-4">Painel de Reset de Conta</h1>
      <p className="mb-6 text-slate-600">
        Esta ação apagará <strong>todos os seus dados financeiros</strong> (lançamentos, categorias, contas contatos)
        e criará um ambiente limpo novamente. Seu e-mail permanecerá cadastrado.
      </p>

      <div className="flex gap-4 mb-8">
        <Button onClick={handleReset} disabled={loading || !session} className="bg-red-600 hover:bg-red-700">
          {loading ? 'Limpando...' : 'Zerar Conta Oficialmente'}
        </Button>
        <Button variant="outline" onClick={() => navigate('/dashboard')} disabled={loading}>
          Retornar ao Dashboard
        </Button>
      </div>

      <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-sm h-64 overflow-y-auto w-full">
        {log.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
        {!log.length && <div className="text-slate-500">Aguardando execução...</div>}
      </div>
    </div>
  );
}
