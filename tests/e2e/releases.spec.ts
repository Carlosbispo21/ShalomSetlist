import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
test('Android detecta APK novo sem interromper PDF e abre download ao sair', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    const win = window as typeof window & { androidBridge: object; Capacitor: object; nativeCalls: unknown[] };
    win.androidBridge = {};
    win.nativeCalls = [];
    win.Capacitor = {
      PluginHeaders: [{ name: 'ReaderDisplay', methods: [{ name: 'setReading', rtype: 'promise' }, { name: 'openApk', rtype: 'promise' }] }],
      nativePromise: (plugin: string, method: string, options: unknown) => { win.nativeCalls.push({ plugin, method, options }); return Promise.resolve(); }
    };
  });
  let newer = false, checks = 0;
  const parts = version.split('.').map(Number); parts[2]++;
  const nextVersion = parts.join('.');
  const apkUrl = `https://github.com/Carlosbispo21/ShalomSetlist/releases/download/v${nextVersion}/shalom-${nextVersion}.apk`;
  await page.route('https://raw.githubusercontent.com/Carlosbispo21/ShalomSetlist/main/latest.json*', route => {
    checks++;
    return route.fulfill({ json: { version: newer ? nextVersion : '0.0.0', apkUrl } });
  });
  await page.goto('/');
  await expect.poll(() => checks).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Atualizar aplicativo' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Explorar com exemplos' }).click();
  await page.getByRole('button', { name: /^Exemplo 01/ }).click();
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
  newer = true;
  await page.clock.fastForward(61000);
  await expect.poll(() => checks).toBeGreaterThan(1);
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Atualizar aplicativo' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Voltar ao repertório' }).click();
  await expect(page.getByRole('button', { name: 'Atualizar aplicativo' })).toBeVisible();
  await page.getByRole('button', { name: 'Atualizar aplicativo' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { nativeCalls: unknown[] }).nativeCalls))
    .toContainEqual({ plugin: 'ReaderDisplay', method: 'openApk', options: { url: apkUrl } });
});
