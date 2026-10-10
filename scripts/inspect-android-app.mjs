import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const adb=join(process.env.ANDROID_HOME ?? join(process.env.LOCALAPPDATA,'Android','Sdk'),'platform-tools','adb.exe');
const serial=process.argv[2];
const call=(...args)=>execFileSync(adb,['-s',serial,...args],{encoding:'utf8',windowsHide:true}).trim();
const pid=call('shell','pidof','br.org.shalom.partituras').split(/\s+/)[0];
const port=call('forward','tcp:0',`localabstract:webview_devtools_remote_${pid}`);
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
try {
  const page=browser.contexts().flatMap(c=>c.pages())[0];
  console.log(JSON.stringify(await page.evaluate(()=>({scripts:[...document.scripts].map(s=>s.src.split('/').pop()).filter(Boolean),hasUpdate:document.body.innerText.includes('Nova versão disponível'),hasModal:!!document.querySelector('[role=dialog]')}))));
  const lines=(await readFile(new URL('../.env',import.meta.url),'utf8')).split(/\r?\n/);
  const env=Object.fromEntries(lines.filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).trim()]}));
  console.log(JSON.stringify(await page.evaluate(async({base,key})=>{
    const saved=JSON.parse(localStorage.getItem('sb-vzccxwihuhcjydyjrzym-auth-token')??'null');
    const room=JSON.parse(localStorage.getItem(`shalom-room:${base}`)??'null');
    if(!saved?.access_token||!room)return{connected:false};
    const claims=JSON.parse(atob(saved.access_token.split('.')[1].replaceAll('-','+').replaceAll('_','/')));
    const response=await fetch(`${base}/rest/v1/rpc/is_shalom_director`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${saved.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({target_room:room.id})});
    const week=await fetch(`${base}/rest/v1/rpc/shalom_week`,{headers:{apikey:key}}).then(r=>r.json());
    return{connected:true,cachedRole:room.role,anonymous:claims.is_anonymous,ownerMatchesAccount:room.ownerId===saved.user?.id,directorStatus:response.status,isDirector:await response.json(),serverWeek:week,deviceDate:new Date().toISOString(),error:document.querySelector('.form-error')?.textContent};
  },{base:env.VITE_SUPABASE_URL,key:env.VITE_SUPABASE_ANON_KEY})));
} finally { await browser.close(); call('forward','--remove',`tcp:${port}`); }
