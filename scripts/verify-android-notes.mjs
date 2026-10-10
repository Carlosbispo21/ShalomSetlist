// Insere uma cifra de teste no PDF aberto e exclui somente essa cifra ao concluir.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';
const serial = process.argv[2];
if (!serial) throw new Error('Informe o serial ADB.');
const adb = join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const call = (...args) => execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8', windowsHide: true }).trim();
const pid = call('shell', 'pidof', 'br.org.shalom.partituras').split(/\s+/)[0];
const port = call('forward', 'tcp:0', `localabstract:webview_devtools_remote_${pid}`);
let browser, page, testId;
try {
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  page = browser.contexts().flatMap(context => context.pages())[0];
  if (!await page.locator('.reader').count()) {
    for (const toggle of await page.locator('.day-toggle[aria-expanded="false"]').all()) await toggle.click();
    await page.locator('.score-open').first().click();
  }
  if (await page.getByRole('button', { name: 'Mostrar controles' }).isVisible()) await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await page.getByRole('button', { name: 'Por página' }).click();
  await page.locator('.pdf-page canvas').first().waitFor();
  await page.locator('.pdf-page').first().locator('.page-loading').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Cifras', exact: true }).click();
  const bounds = (await page.locator('.pdf-page').first().boundingBox());
  await page.mouse.click(bounds.x + bounds.width * .45, bounds.y + bounds.height * .45);
  await page.getByLabel('Texto da cifra').fill('Fá♯');
  await page.getByLabel('Tamanho da fonte').fill('18');
  await page.getByRole('button', { name: 'Salvar cifra' }).click();
  const mark = page.locator('.text-note').last();
  testId = await mark.getAttribute('data-note-id');
  await expect(mark.locator('text')).toHaveText('Fá♯');
  await page.getByRole('button', { name: 'Cifras', exact: true }).click();
  await page.getByRole('button', { name: 'Ocultar controles' }).click();
  call('shell', 'screencap', '-p', '/data/local/tmp/shalom-notes-validation.png');
  call('pull', '/data/local/tmp/shalom-notes-validation.png', 'artifacts/tablet-cifras-real.png');
  call('shell', 'rm', '/data/local/tmp/shalom-notes-validation.png');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await page.getByRole('button', { name: 'Cifras', exact: true }).click();
  await page.locator(`[data-note-id="${testId}"]`).click();
  await expect(page.getByLabel('Tamanho da fonte')).toHaveValue('18');
  await page.getByRole('button', { name: 'Excluir cifra' }).click();
  await expect(page.locator(`[data-note-id="${testId}"]`)).toHaveCount(0);
  testId = undefined;
  await page.getByRole('button', { name: 'Cifras', exact: true }).click();
  await page.getByRole('button', { name: 'Contínua' }).click();
  await expect(page.getByRole('button', { name: 'Próximo hino', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Voltar ao repertório' }).click();
  console.log('Cifra inserida e reeditada no tablet. Apenas a cifra de teste foi removida. Navegação contínua disponível.');
} finally {
  if (testId && page) console.log('Verificação interrompida: remova a cifra de teste Fá♯ pelo editor, se estiver presente.');
  await browser?.close(); call('forward', '--remove', `tcp:${port}`);
}
