import { test, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import type { Page } from '@playwright/test';

const base = 'https://vzccxwihuhcjydyjrzym.supabase.co';
const userId = '11111111-1111-4111-8111-111111111111';
const roomId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

async function connectMockBand(page: Page, failUpload: boolean, lostMetadataResponse = false) {
  const calls: { uploaded?: Buffer; type?: string; rows: Record<string, unknown>[]; removals: number } = { rows: [], removals: 0 };
  await page.routeWebSocket('wss://vzccxwihuhcjydyjrzym.supabase.co/**', ws => ws.close());
  await page.route(`${base}/**`, async route => {
    const req = route.request(), url = new URL(req.url());
    const json = (data: unknown, status = 200) => route.fulfill({ status, contentType:'application/json', body:JSON.stringify(data) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'} });
    if (url.pathname === '/rest/v1/members') return json([{ room_id:roomId,role:'director',rooms:{id:roomId,name:'Banda Shalom',join_code:'A1B2C3D4E5F6',owner_id:userId} }]);
    if (url.pathname.startsWith('/storage/v1/object/scores/') && req.method() === 'POST') {
      calls.type = req.headers()['content-type'];
      // Reproduz um transporte que não consegue enviar arquivos do seletor em multipart.
      if (failUpload || calls.type?.startsWith('multipart/')) return route.abort('failed');
      calls.uploaded = req.postDataBuffer()!;
      return json({Id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',Key:url.pathname.slice('/storage/v1/object/'.length)});
    }
    if (url.pathname === '/rest/v1/scores') {
      if (req.method() === 'POST') { calls.rows.push(req.postDataJSON()); return lostMetadataResponse ? route.abort('failed') : json(null,201); }
      return json(calls.rows);
    }
    if (url.pathname.startsWith('/storage/v1/object/') && req.method() === 'DELETE') { calls.removals++; return json([]); }
    return json(null);
  });
  await page.addInitScript(({ userId }) => {
    const now = Math.floor(Date.now()/1000);
    const base64 = (value: object) => btoa(JSON.stringify(value)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
    const accessToken = `${base64({alg:'HS256',typ:'JWT'})}.${base64({sub:userId,role:'authenticated',is_anonymous:false,iat:now,exp:now+3600})}.test-signature`;
    localStorage.setItem('sb-vzccxwihuhcjydyjrzym-auth-token',JSON.stringify({access_token:accessToken,refresh_token:'test-refresh',expires_at:now+3600,expires_in:3600,token_type:'bearer',user:{id:userId,email:'test@example.test',app_metadata:{provider:'email'},user_metadata:{},aud:'authenticated',created_at:new Date().toISOString()}}));
  }, {userId});
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Enviar partituras',exact:true})).toBeVisible();
  return calls;
}

test('envia o PDF por bytes quando o transporte não aceita multipart', async ({ page }) => {
  const calls = await connectMockBand(page,false);
  const pdf = await PDFDocument.create(); pdf.addPage();
  const bytes = Buffer.from(await pdf.save());
  await page.getByRole('button',{name:'Enviar partituras',exact:true}).click();
  await page.getByLabel('Selecionar PDFs').setInputFiles({name:'Hino de teste.pdf',mimeType:'application/pdf',buffer:bytes});
  await page.getByRole('button',{name:'Enviar para a banda'}).click();
  await expect(page.getByRole('button',{name:/^Hino de teste/})).toBeVisible();
  expect(calls.type).toBe('application/pdf');
  expect(calls.uploaded?.equals(bytes)).toBe(true);
  expect(calls.rows).toHaveLength(1);
});

test('identifica falha de rede no envio e não cadastra hino sem PDF', async ({ page }) => {
  const calls = await connectMockBand(page,true);
  const pdf = await PDFDocument.create(); pdf.addPage();
  await page.getByRole('button',{name:'Enviar partituras',exact:true}).click();
  await page.getByLabel('Selecionar PDFs').setInputFiles({name:'Falha.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});
  await page.getByRole('button',{name:'Enviar para a banda'}).click();
  await expect(page.getByRole('alert')).toContainText('Falha de conexão durante envio do PDF');
  expect(calls.rows).toHaveLength(0);
  await expect(page.getByRole('button',{name:'Enviar para a banda'})).toBeEnabled();
});

test('preserva o PDF quando o cadastro foi salvo mas a resposta da rede se perdeu', async ({ page }) => {
  const calls = await connectMockBand(page,false,true);
  const pdf = await PDFDocument.create(); pdf.addPage();
  await page.getByRole('button',{name:'Enviar partituras',exact:true}).click();
  await page.getByLabel('Selecionar PDFs').setInputFiles({name:'Resposta perdida.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});
  await page.getByRole('button',{name:'Enviar para a banda'}).click();
  await expect(page.getByRole('button',{name:/^Resposta perdida/})).toBeVisible();
  expect(calls.rows).toHaveLength(1);
  expect(calls.removals).toBe(0);
});
