import fs from 'fs';

function readEnv(path) {
  const content = fs.readFileSync(path, 'utf8');
  let url = '';
  let key = '';
  content.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
  });
  return { url, key };
}

const { url, key } = readEnv('.env.local');

async function test() {
  const res = await fetch(`${url}/rest/v1/titles?select=*`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });
  const data = await res.json();
  console.log('Is Array?', Array.isArray(data));
  console.log('Error?', data.error || data.message || data.code ? data : null);
  console.log('Count:', data.length);
  if (Array.isArray(data) && data.length > 0) {
    console.log('First Item keys:', Object.keys(data[0]));
    console.log('First Item side:', data[0].side);
  }
}
test();
