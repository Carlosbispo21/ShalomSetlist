import { test, expect } from '@playwright/test';

test('folha usa todo o visor, toque lateral troca página e hino do mesmo dia', async ({ page }, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explorar com exemplos' }).click();
  // O filtro não deve interromper a sequência dos hinos do dia.
  await page.getByRole('button', { name: 'Grupo de louvor', exact: true }).click();
  await page.getByRole('button', { name: /^Exemplo 01/ }).click();
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
  const viewport = page.viewportSize()!;
  const scroll = (await page.locator('.reader-scroll').boundingBox())!;
  expect(scroll.x).toBe(0); expect(scroll.y).toBe(0);
  expect(scroll.width).toBe(viewport.width); expect(scroll.height).toBe(viewport.height);
  const sheet = (await page.locator('.pdf-page').boundingBox())!;
  expect(sheet.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(sheet.height).toBeLessThanOrEqual(viewport.height + 1);
  await page.getByRole('button', { name: 'Ocultar controles' }).click();
  await expect(page.getByRole('button', { name: 'Caneta', exact: true })).not.toBeVisible();
  await page.screenshot({ path: `artifacts/${info.project.name}-folha-tela-cheia.png` });
  await page.mouse.click(viewport.width - 18, viewport.height / 2);
  await expect(page.getByLabel('Partitura, página 2')).toBeVisible();
  await page.mouse.click(viewport.width - 18, viewport.height / 2);
  await expect(page.getByRole('heading', { name: 'Exemplo 02' })).toBeVisible();
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
  // Volta à última página do PDF anterior, salvando as anotações.
  await page.mouse.click(18, viewport.height / 2);
  await expect(page.getByRole('heading', { name: 'Exemplo 01' })).toBeVisible();
  await expect(page.getByLabel('Partitura, página 2')).toBeVisible();
  await page.getByRole('button', { name: 'Caneta', exact: true }).click();
  const ink = page.locator('.ink-layer'), rect = (await ink.boundingBox())!;
  await page.mouse.move(rect.x + rect.width * .85, rect.y + rect.height / 2);
  await page.mouse.down(); await page.mouse.move(rect.x + rect.width * .90, rect.y + rect.height / 2 + 15); await page.mouse.up();
  await expect(ink.locator('polyline')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Exemplo 01' })).toBeVisible();
  await page.getByRole('button', { name: 'Próxima página' }).click();
  await expect(page.getByRole('heading', { name: 'Exemplo 02' })).toBeVisible();
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
  await page.getByRole('button', { name: 'Próxima página' }).click();
  await expect(page.getByLabel('Partitura, página 2')).toBeVisible();
  await page.getByRole('button', { name: 'Próxima página' }).click();
  await expect(page.getByText('Fim dos hinos deste dia.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Exemplo 02' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Exemplo 03' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Página anterior' }).click();
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
  await page.getByRole('button', { name: 'Página anterior' }).click();
  await expect(page.locator('.ink-layer polyline')).toHaveCount(1);
});

test('página ampliada não troca de página com toque simples na borda', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explorar com exemplos' }).click();
  await page.getByRole('button', { name: /^Exemplo 01/ }).click();
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
  await page.getByRole('button', { name: 'Aumentar zoom' }).click();
  const viewport = page.viewportSize()!;
  await page.mouse.click(viewport.width - 12, viewport.height / 2);
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
});

test('modo contínuo troca hino por toque lateral e mantém a rolagem sem trocar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explorar com exemplos' }).click();
  await page.getByRole('button', { name: /^Exemplo 01/ }).click();
  await page.getByRole('button', { name: 'Contínua' }).click();
  await expect(page.locator('.pdf-page')).toHaveCount(2);
  await page.getByRole('button', { name: 'Aumentar zoom' }).click();
  await page.locator('.reader-scroll').evaluate(element => { element.scrollTop = 180; });
  await expect(page.getByRole('heading', { name: 'Exemplo 01' })).toBeVisible();
  const viewport = page.viewportSize()!;
  // Um arraste vertical na borda não deve abrir outra música.
  await page.mouse.move(viewport.width - 15, viewport.height / 2);
  await page.mouse.down(); await page.mouse.move(viewport.width - 15, viewport.height / 2 - 90); await page.mouse.up();
  await expect(page.getByRole('heading', { name: 'Exemplo 01' })).toBeVisible();
  await page.mouse.click(viewport.width - 15, viewport.height / 2);
  await expect(page.getByRole('heading', { name: 'Exemplo 02' })).toBeVisible();
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
  await page.locator('.pdf-page').first().locator('.page-loading').waitFor({ state: 'hidden' });
  await expect(page.locator('.reader-scroll')).toHaveClass(/cascade/);
  await page.mouse.click(viewport.width - 15, viewport.height / 2);
  await expect(page.getByText('Fim dos hinos deste dia.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Exemplo 03' })).toHaveCount(0);
  await page.mouse.click(15, viewport.height / 2);
  await expect(page.getByRole('heading', { name: 'Exemplo 01' })).toBeVisible();
});
