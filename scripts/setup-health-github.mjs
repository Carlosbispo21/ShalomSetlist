// Usa a autenticação já existente do Git Credential Manager, sem exibir tokens.
// Sem --activate, apenas verifica acesso. Não utiliza chave administrativa Supabase.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const repo = 'Carlosbispo21/ShalomSetlist';
let credential;
try {
  credential = execFileSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' }, stdio: ['pipe', 'pipe', 'pipe']
  }).split(/\r?\n/).find(line => line.startsWith('password='))?.slice(9);
} catch { /* Não inicia login interativo. */ }
if (!credential) { console.log('GitHub sem autenticação local. Use o passo a passo em GUIA_DISPONIBILIDADE.md.'); process.exit(2); }
async function api(path, method = 'GET', body) {
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    method, headers: { Authorization: `Bearer ${credential}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`GitHub HTTP ${response.status} em ${path}. Nenhuma credencial foi exibida.`);
  return response.status === 204 ? null : response.json();
}
const repository = await api('');
console.log(`Repositório: ${repo}; escrita: ${!!repository.permissions?.push}; padrão: ${repository.default_branch}`);
if (process.argv.includes('--status')) {
  const runs = await api('/actions/workflows/supabase-health.yml/runs?per_page=3');
  console.log(JSON.stringify(runs.workflow_runs.map(run => ({ status: run.status, conclusion: run.conclusion, url: run.html_url }))));
  process.exit(0);
}
if (!process.argv.includes('--activate')) process.exit(0);
if (!repository.permissions?.push) throw new Error('A conta conectada não pode publicar neste repositório.');
const env = await readFile(new URL('../.env', import.meta.url), 'utf8');
const readValue = name => env.split(/\r?\n/).find(line => line.startsWith(`${name}=`))?.slice(name.length + 1).trim();
const url = readValue('VITE_SUPABASE_URL'), key = readValue('VITE_SUPABASE_ANON_KEY');
if (!url || !key?.startsWith('sb_publishable_')) throw new Error('Use somente URL e chave publicável na .env.');
const variables = await api('/actions/variables');
for (const [name, value] of [['SUPABASE_URL', url], ['SUPABASE_PUBLISHABLE_KEY', key]]) {
  if (variables.variables.some(variable => variable.name === name)) await api(`/actions/variables/${name}`, 'PATCH', { name, value });
  else await api('/actions/variables', 'POST', { name, value });
}
const path = '/contents/.github/workflows/supabase-health.yml';
let existing;
try { existing = await api(path); } catch (error) { if (!error.message.includes('HTTP 404')) throw error; }
const content = Buffer.from(await readFile(new URL('../.github/workflows/supabase-health.yml', import.meta.url))).toString('base64');
if (existing?.content.replace(/\s/g, '') !== content) await api(path, 'PUT', {
  message: 'Verifica disponibilidade do Supabase quatro vezes por dia', content,
  ...(existing ? { sha: existing.sha, branch: repository.default_branch } : {})
});
console.log('Rotina publicada; variáveis públicas configuradas.');
try { await api('/actions/workflows/supabase-health.yml/dispatches', 'POST', { ref: repository.default_branch }); }
catch (error) { if (!error.message.includes('HTTP 404')) throw error; console.log('GitHub ainda está registrando o workflow. Execute novamente em alguns segundos.'); process.exit(0); }
console.log(`Checagem solicitada: https://github.com/${repo}/actions/workflows/supabase-health.yml`);
