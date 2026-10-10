// Publica o APK já compilado. Usa somente o login existente do Git.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const repo = 'Carlosbispo21/ShalomSetlist';
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
const changelog = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const notes = changelog.split(`## ${version}\n`)[1]?.split('\n## ')[0]?.trim();
if (!notes) throw new Error(`Descreva a versão ${version} em CHANGELOG.md antes de publicar.`);
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Versão inválida.');
const apk = await readFile(new URL(`../artifacts/shalom-${version}-debug.apk`, import.meta.url));
const sha256 = createHash('sha256').update(apk).digest('hex');
const credential = execFileSync('git', ['credential', 'fill'], {
  input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8',
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' }, stdio: ['pipe', 'pipe', 'pipe']
}).split(/\r?\n/).find(line => line.startsWith('password='))?.slice(9);
if (!credential) throw new Error('Entre no GitHub pelo Git Credential Manager.');
async function request(url, method = 'GET', body, binary = false) {
  const response = await fetch(url, { method,
    headers: { Authorization: `Bearer ${credential}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': binary ? 'application/vnd.android.package-archive' : 'application/json' },
    body: body === undefined ? undefined : binary ? body : JSON.stringify(body), signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`GitHub HTTP ${response.status}. Não publique duas compilações com a mesma versão.`);
  return response.status === 204 ? null : response.json();
}
const base = `https://api.github.com/repos/${repo}`;
const release = await request(`${base}/releases`, 'POST', { tag_name: `v${version}`, target_commitish: 'main',
  name: `Shalom ${version}`, draft: true,
  body: notes + '\n\nAPK de teste. Instale por cima da versão anterior para preservar os dados.' });
const asset = await request(`https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=shalom-${version}.apk`, 'POST', apk, true);
await request(`${base}/releases/${release.id}`, 'PATCH', { draft: false });
const manifest = { version, apkUrl: asset.browser_download_url, sha256, publishedAt: new Date().toISOString() };
const contentsUrl = `${base}/contents/latest.json`;
let current;
try { current = await request(contentsUrl); } catch (error) { if (!error.message.includes('HTTP 404')) throw error; }
await request(contentsUrl, 'PUT', { message: `Disponibiliza atualização Shalom ${version}`,
  content: Buffer.from(JSON.stringify(manifest, null, 2) + '\n').toString('base64'), ...(current ? { sha: current.sha } : {}) });
await writeFile(new URL('../artifacts/latest.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Atualização publicada: ${release.html_url}`);
