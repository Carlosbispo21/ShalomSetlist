import { registerSW } from 'virtual:pwa-register';
import { version } from '../package.json';
import { nativeAndroid, readerDisplay } from './native';
import { parseRelease, releaseFeed, type AppRelease } from './releases';
export const appVersion = version;
let pending = false, release: AppRelease | null = null;
export const hasAppUpdate = () => pending;
const announce = () => { pending = true; window.dispatchEvent(new Event('shalom-app-update')); };
let registration: ServiceWorkerRegistration | undefined;
const applyWeb = nativeAndroid ? async () => {} : registerSW({
  onNeedRefresh: announce,
  onRegisteredSW(_url, registered) { registration = registered; },
  onRegisterError(error) { console.warn('Instalação offline indisponível:', error); }
});
let checking = false;
export async function checkAppUpdate() {
  if (checking || !navigator.onLine || document.visibilityState !== 'visible') return;
  checking = true;
  try {
    if (!nativeAndroid) { await registration?.update(); return; }
    const project = import.meta.env.VITE_SUPABASE_URL;
    if (!project) return;
    const response = await fetch(`${releaseFeed}?t=${Date.now()}`, {
      cache: 'no-store', signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return;
    const next = parseRelease(await response.json(), version, project);
    if (next) { release = next; announce(); }
  } catch { /* Offline ou sem versão publicada: a leitura continua. */ }
  finally { checking = false; }
}
export async function updateApp(_reload = true) {
  if (nativeAndroid) { if (release) await readerDisplay.openApk({ url: release.apkUrl }); }
  else await applyWeb(true);
}
setInterval(() => { void checkAppUpdate(); }, 60000);
window.addEventListener('online', () => { void checkAppUpdate(); });
document.addEventListener('visibilitychange', () => { void checkAppUpdate(); });
void checkAppUpdate();
