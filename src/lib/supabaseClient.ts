import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isOfflineMode = !supabaseUrl || !supabaseAnonKey;

if (isOfflineMode) {
  console.warn('⚠️ Supabase URL ou Chave não encontrados. O App está em modo Offline — configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local.');
}

// Usa placeholders sintáticos quando as vars estão ausentes para evitar
// que createClient lance erro fatal antes do React montar.
export const supabase = createClient(
  supabaseUrl || 'https://offline.supabase.co',
  supabaseAnonKey || 'offline-placeholder-key',
);
