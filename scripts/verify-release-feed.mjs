import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function verifyReleaseFeed(manifest, {
  timeout = 360000, interval = 15000, onRetry = () => {}, fetchManifest = async () => {
    const response = await fetch(`https://raw.githubusercontent.com/Carlosbispo21/ShalomSetlist/main/latest.json?t=${Date.now()}`, {
      cache:'no-store', signal:AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`Manifesto público HTTP ${response.status}`);
    return response.json();
  }, wait = ms => new Promise(resolve => setTimeout(resolve,ms))
} = {}) {
  const deadline = Date.now()+timeout;
  while (true) {
    let publicManifest;
    try { publicManifest = await fetchManifest(); } catch { /* Retry network errors while CDN propagates. */ }
    if (publicManifest?.version === manifest.version && publicManifest?.apkUrl === manifest.apkUrl) return;
    if (Date.now() >= deadline) throw new Error('O APK foi publicado, mas o cache do manifesto ainda não atualizou. Execute node scripts/verify-release-feed.mjs antes de anunciar a atualização.');
    onRetry(publicManifest?.version);
    await wait(Math.min(interval,Math.max(0,deadline-Date.now())));
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifest = JSON.parse(await readFile(new URL('../artifacts/latest.json',import.meta.url),'utf8'));
  await verifyReleaseFeed(manifest,{onRetry:version => console.log(`Cache público: ${version ?? 'indisponível'}. Aguardando ${manifest.version}…`)});
  console.log(`Manifesto público confirmado: ${manifest.version}. Os APKs anteriores já podem detectar a atualização.`);
}
