// Read-only WebView network diagnostics. Never logs headers, request bodies or tokens.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
const adb = join(process.env.ANDROID_HOME ?? join(process.env.LOCALAPPDATA,'Android','Sdk'),'platform-tools','adb.exe');
const serial = process.argv[2];
if (!serial) throw new Error('Informe o identificador retornado por adb devices.');
const call = (...args) => execFileSync(adb,['-s',serial,...args],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
console.log('Aguardando autorização USB e abertura do Shalom…');
let socket;
for (let n=0;n<45;n++) {
  try {
    const pid = call('shell','pidof','br.org.shalom.partituras').split(/\s+/)[0];
    if (pid) {
      const sockets = call('shell','cat','/proc/net/unix');
      const names = [...sockets.matchAll(/@(webview_devtools_remote[^\s]*)/g)].map(match => match[1]);
      socket = names.find(name => name.endsWith(`_${pid}`));
      if (socket) break;
    }
  } catch { /* authorization or app startup is pending */ }
  await pause(2000);
}
if (!socket) { console.log('Não foi possível acessar o Shalom. Autorize a depuração USB e mantenha o aplicativo aberto.'); process.exit(1); }
console.log(JSON.stringify({device:call('shell','getprop','ro.product.model'),android:call('shell','getprop','ro.build.version.release')}));
const port = call('forward','tcp:0',`localabstract:${socket}`);
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const pages = browser.contexts().flatMap(context => context.pages());
const page = pages.find(page => /localhost|br\.org\.shalom/.test(page.url())) ?? pages[0];
if (!page) throw new Error('A WebView do Shalom não está aberta.');
const session = await page.context().newCDPSession(page);
const requests = new Map();
const failures = new Set();
const stage = pathname => pathname.startsWith('/storage/v1/object/') ? 'PDF' : pathname.startsWith('/rest/v1/scores') ? 'repertório' : pathname.startsWith('/auth/v1/') ? 'autenticação' : 'banda';
session.on('Network.requestWillBeSent', event => {
  const url = new URL(event.request.url);
  if (url.hostname !== 'vzccxwihuhcjydyjrzym.supabase.co') return;
  requests.set(event.requestId,{stage:stage(url.pathname),method:event.request.method,...(url.pathname.startsWith('/storage/v1/object/scores/') ? {week:url.pathname.split('/')[6]} : {})});
});
session.on('Network.loadingFailed', event => {
  const request = requests.get(event.requestId); if (!request) return;
  console.log(JSON.stringify({...request,error:event.errorText,blocked:event.blockedReason,cors:event.corsErrorStatus?.corsError}));
});
session.on('Network.responseReceived', event => {
  const request = requests.get(event.requestId); if (!request) return;
  console.log(JSON.stringify({...request,status:event.response.status}));
  if(event.response.status>=400) failures.add(event.requestId);
});
session.on('Network.loadingFinished', async event => {
  if(!failures.has(event.requestId))return;
  try {
    const result=await session.send('Network.getResponseBody',{requestId:event.requestId});
    const body=JSON.parse(result.base64Encoded?Buffer.from(result.body,'base64').toString():result.body);
    const message=String(body.message??body.error??'').replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+/g,'[token omitido]').slice(0,400);
    console.log(JSON.stringify({...requests.get(event.requestId),code:body.code??body.statusCode,message}));
  }catch{/* No body available for aborted requests. */}
});
await session.send('Network.enable');
console.log('Diagnóstico ativo. Tente enviar o PDF no celular.');
await pause(120000);
try{await session.detach();}catch{}
try{await browser.close();}catch{}
call('forward','--remove',`tcp:${port}`);
console.log('Diagnóstico encerrado.');
