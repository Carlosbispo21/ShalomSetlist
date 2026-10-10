export interface AppRelease { version: string; apkUrl: string }
export const releaseFeed = 'https://raw.githubusercontent.com/Carlosbispo21/ShalomSetlist/main/latest.json';
export function newerVersion(candidate: string, installed: string): boolean {
  const pattern = /^\d+\.\d+\.\d+$/;
  if (!pattern.test(candidate) || !pattern.test(installed)) return false;
  const next = candidate.split('.').map(Number), current = installed.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if (next[i] !== current[i]) return next[i] > current[i]; }
  return false;
}
export function parseRelease(data: unknown, installed: string, projectUrl: string): AppRelease | null {
  if (!data || typeof data !== 'object' || !('version' in data) || !('apkUrl' in data)
    || typeof data.version !== 'string' || typeof data.apkUrl !== 'string' || !newerVersion(data.version, installed)) return null;
  try {
    const url = new URL(data.apkUrl), project = new URL(projectUrl);
    const supabase = url.origin === project.origin && url.pathname.startsWith('/storage/v1/object/public/app-releases/') && url.pathname.endsWith('.apk');
    const github = url.origin === 'https://github.com' && url.pathname === `/Carlosbispo21/ShalomSetlist/releases/download/v${data.version}/shalom-${data.version}.apk`;
    if (url.protocol !== 'https:' || url.username || url.password || !(supabase || github)) return null;
    return { version: data.version, apkUrl: url.href };
  } catch { return null; }
}
