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
  const before = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  if (!await page.locator('.reader').count()) {
    for (const toggle of await page.locator('.day-toggle[aria-expanded="false"]').all()) await toggle.click();
    await page.locator('.score-open').first().waitFor({ timeout: 20000 });
    await page.locator('.score-open').first().click();
  }
  const previousMode = await page.evaluate(() => localStorage.getItem('shalom-reader-mode'));
  if (process.argv.includes('--paged')) {
    if (await page.getByRole('button', { name: 'Mostrar controles' }).isVisible()) await page.getByRole('button', { name: 'Mostrar controles' }).click();
    await page.getByRole('button', { name: 'Por página' }).click();
  }
  await page.locator('.pdf-page canvas').first().waitFor({ timeout: 20000 });
  await page.locator('.pdf-page').first().locator('.page-loading').waitFor({ state: 'hidden', timeout: 20000 });
  const after = await page.evaluate(() => {
    const bounds = document.querySelector('.reader-scroll').getBoundingClientRect();
    return { width: innerWidth, height: innerHeight, screenHeight: screen.height, ratio: devicePixelRatio, visualHeight: visualViewport?.height,
      reader: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      readerRoot: document.querySelector('.reader').getBoundingClientRect().toJSON(),
      floating: getComputedStyle(document.querySelector('.reader-tools')).position,
      serviceWorkerControlled: !!navigator.serviceWorker?.controller };
  });
  console.log(JSON.stringify({ before, after }));
  await page.screenshot({ path: 'artifacts/android-leitor-real.png' });
  if (await page.getByRole('button', { name: 'Ocultar controles' }).isVisible()) await page.getByRole('button', { name: 'Ocultar controles' }).click();
  // CDP pode omitir pixels do canvas no WebView. Capture a tela Android real.
  call('shell', 'screencap', '-p', '/data/local/tmp/shalom-reader-validation.png');
  call('pull', '/data/local/tmp/shalom-reader-validation.png', 'artifacts/android-folha-tela-cheia.png');
  call('shell', 'rm', '/data/local/tmp/shalom-reader-validation.png');
  if (process.argv.includes('--paged') && await page.getByLabel('Partitura, página 1').count()) {
    const viewport = page.viewportSize() ?? await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    await page.mouse.click(viewport.width - 15, viewport.height / 2);
    console.log('Toque na lateral executado no modo por página.');
    if (previousMode === 'cascade') {
      if (await page.getByRole('button', { name: 'Mostrar controles' }).isVisible()) await page.getByRole('button', { name: 'Mostrar controles' }).click();
      await page.getByRole('button', { name: 'Contínua' }).click();
    }
  }
  // O botão Voltar do Android deve sair do leitor, preservando os dados.
  call('shell', 'input', 'keyevent', '4');
  await page.locator('.score-open').first().waitFor({ timeout: 10000 });
  console.log('PDF abriu em tela cheia; Voltar do Android retornou ao repertório.');
} finally { await browser.close(); call('forward', '--remove', `tcp:${port}`); }
