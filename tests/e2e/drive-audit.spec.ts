import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../../integrations/google-drive-audit/Index.html',import.meta.url),'utf8');
const root='1_uL6Lhot0KkzTIn5pxAtkNm1ZKmadsV4';
test('conferência pode pausar, exportar, retomar e filtrar imagens e cópias sem interpretar nomes como HTML',async({page})=>{
  const file=(id:string,type:string,md5='',name='Hino.pdf')=>({id,name,path:'shalom/Avulsos/Hino/PDF/'+name,type,md5,size:20,suggestedName:name,issues:type==='Imagem'?['Imagem: preservar original']:[]});
  const pages={
    [root+':']:{folders:[{id:'group',name:'Avulsos'}],files:[],nextPageToken:''},
    'group:':{folders:[{id:'hymn',name:'Hino'}],files:[],nextPageToken:''},
    'hymn:':{folders:[{id:'pdf',name:'PDF'}],files:[],nextPageToken:''},
    'pdf:':{folders:[],files:[file('one','PDF','identical'),file('image','Imagem','','<img src=x onerror="window.auditXss=true">.jpg')],nextPageToken:'second'},
    'pdf:second':{folders:[],files:[file('two','PDF','identical','Hino - Versão 2.pdf')],nextPageToken:''}
  };
  const mock=`window.auditCalls=[];window.google={script:{run:{withSuccessHandler(fn){this.success=fn;return this;},withFailureHandler(fn){this.failure=fn;return this;},auditConfig(){const callback=this.success;setTimeout(()=>callback({root:${JSON.stringify(root)}}),1);},auditPage(id,token){const callback=this.success;window.auditCalls.push([id,token]);const pages=${JSON.stringify(pages).replaceAll('<',String.fromCharCode(92)+'u003c')};setTimeout(()=>callback(pages[id+':'+token]),150);}}}};`;
  await page.setContent(html.replace('<script>','<script>'+mock));
  await page.getByRole('button',{name:'Iniciar conferência'}).click();await page.getByRole('button',{name:'Pausar',exact:true}).click();
  await expect(page.getByRole('button',{name:'Continuar conferência'})).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('pausada');
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar relatório e progresso'}).click();const download=await downloadEvent,path=await download.path();
  const report=JSON.parse(await readFile(path!,'utf8'));expect(report.pages).toBe(1);expect(report.queue[0].id).toBe('group');
  await page.getByLabel('Retomar relatório').setInputFiles(path!);await page.getByRole('button',{name:'Continuar conferência'}).click();
  await expect(page.getByRole('status')).toContainText('Conferência concluída');await expect(page.locator('tbody tr')).toHaveCount(3);
  expect(await page.evaluate(()=>(window as unknown as {auditXss?:boolean}).auditXss)).toBeUndefined();
  await page.getByLabel('Filtrar arquivos').selectOption('Imagem');await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page.locator('tbody')).toContainText('preservar original');await expect(page.locator('tbody')).toContainText('<img src=x onerror="window.auditXss=true">.jpg');
  await page.getByLabel('Filtrar arquivos').selectOption('copies');await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.getByLabel('Buscar nome ou caminho').fill('Versão 2');await expect(page.locator('tbody tr')).toHaveCount(1);
});
