import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
  try {
    const [
      { data: accounts, error: err1 },
      { data: categories, error: err2 },
      { data: contacts, error: err3 },
      { data: documents, error: err4 },
      { data: titles, error: err5 },
      { data: movements, error: err6 }
    ] = await Promise.all([
      supabase.from('accounts').select('*'),
      supabase.from('categories').select('*'),
      supabase.from('contacts').select('*'),
      supabase.from('documents').select('*'),
      supabase.from('titles').select('*'),
      supabase.from('movements').select('*')
    ]);

    console.log("Errors:", err1, err2, err3, err4, err5, err6);
    console.log("Counts:", accounts?.length, categories?.length, contacts?.length, documents?.length, titles?.length, movements?.length);
  } catch(e) {
    console.error("Crash:", e);
  }
}

test();
