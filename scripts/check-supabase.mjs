// Consulta pequena, de leitura, sem login e sem credencial administrativa.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.');
const endpoint = new URL('/rest/v1/rpc/shalom_health', url);
if (endpoint.protocol !== 'https:') throw new Error('SUPABASE_URL deve usar HTTPS.');
const response = await fetch(endpoint, {
  method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
  body: '{}', signal: AbortSignal.timeout(20000)
});
if (!response.ok) throw new Error(`Supabase indisponível: HTTP ${response.status}. Confira o projeto e a migração.`);
const data = await response.json();
if (data?.status !== 'ok') throw new Error('Resposta inesperada da checagem.');
console.log(`Supabase disponível. Semana: ${data.week}`);
