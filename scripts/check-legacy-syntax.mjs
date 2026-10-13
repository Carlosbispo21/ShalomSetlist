import {readFile,readdir} from 'node:fs/promises';
import {parse} from 'acorn';
const names=await readdir(new URL('../dist/assets/',import.meta.url));
for(const name of names.filter(name=>name.endsWith('.js')&&(name.includes('-legacy-')||name.startsWith('pdfWorker-')))) {
  parse(await readFile(new URL(`../dist/assets/${name}`,import.meta.url),'utf8'),{ecmaVersion:2019,sourceType:'script'});
}
console.log('Sintaxe das versões antigas e do worker PDF validada.');
