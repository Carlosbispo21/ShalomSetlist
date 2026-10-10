// Verificação no aparelho conectado. Apenas abre o PDF já existente e volta.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
const adb = join(process.env.ANDROID_HOME ?? join(process.env.LOCALAPPDATA, 'Android', 'Sdk'), 'platform-tools', 'adb.exe');
const serial = process.argv[2];
if (!serial) throw new Error('Informe o serial ADB.');
const call = (...args) => execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8', windowsHide: true }).trim();
const pid = call('shell', 'pidof', 'br.org.shalom.partituras').split(/\s+/)[0];
const port = call('forward', 'tcp:0', `localabstract:webview_devtools_remote_${pid}`);
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
try {
  const page = browser.contexts().flatMap(context => context.pages())[0];
  await page.screenshot({ path: 'artifacts/android-repertorio-real.png' });
  console.log(JSON.stringify(await page.evaluate(() => ({
    readerOpen: !!document.querySelector('.reader'), rows: document.querySelectorAll('.score-open').length,
    dayButtons: [...document.querySelectorAll('.day-toggle')].map(button => ({ expanded: button.getAttribute('aria-expanded'), count: button.querySelector('.count-pill')?.textContent })),
    hidden: document.hidden, nativePlugin: !!(window.Capacitor?.PluginHeaders?.some(plugin => plugin.name === 'ReaderDisplay'))
  }))));
  for (const toggle of await page.locator('.day-toggle[aria-expanded="false"]').all()) await toggle.click();
  await page.locator('.score-open').first().waitFor({ timeout: 20000 });
  const before = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  await page.locator('.score-open').first().click();
  await page.locator('.pdf-page canvas').waitFor({ timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector('.page-loading'), null, { timeout: 20000 });
  const after = await page.evaluate(() => {
    const bounds = document.querySelector('.reader-scroll').getBoundingClientRect();
    return { width: innerWidth, height: innerHeight, screenHeight: screen.height, ratio: devicePixelRatio,
      reader: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      floating: getComputedStyle(document.querySelector('.reader-tools')).position,
      serviceWorkerControlled: !!navigator.serviceWorker?.controller };
  });
  console.log(JSON.stringify({ before, after }));
  await page.screenshot({ path: 'artifacts/android-leitor-real.png' });
  await page.getByRole('button', { name: 'Ocultar controles' }).click();
  await page.screenshot({ path: 'artifacts/android-folha-tela-cheia.png' });
  // O botão Voltar do Android deve sair do leitor, preservando os dados.
  call('shell', 'input', 'keyevent', '4');
  await page.locator('.score-open').first().waitFor({ timeout: 10000 });
  console.log('PDF abriu em tela cheia; Voltar do Android retornou ao repertório.');
} finally { await browser.close(); call('forward', '--remove', `tcp:${port}`); }
