import { supabaseFinanceService } from './src/services/finance/supabaseFinanceService';
supabaseFinanceService.getSnapshot().then(snapshot => {
  const titles = snapshot.titles.filter(t => t.status === 'previsto');
  console.log('Total previstos:', titles.length);
  titles.forEach(t => console.log(JSON.stringify(t, null, 2)));
}).catch(console.error);
