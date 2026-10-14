import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const source=await readFile(new URL('../integrations/google-drive/Code.gs',import.meta.url),'utf8');
function iterator(items){let i=0;return {hasNext:()=>i<items.length,next:()=>items[i++]};}
function folder(id,name,parent){const entry={files:[],children:[],getId:()=>id,getName:()=>name,isTrashed:()=>false,getFiles:()=>iterator(entry.files),getFolders:()=>iterator(entry.children),getParents:()=>iterator(parent?[parent]:[])};if(parent)parent.children.push(entry);return entry;}
function file(id,name,parent){const entry={getId:()=>id,getName:()=>name,getSize:()=>20,isTrashed:()=>false,getParents:()=>iterator([parent]),getBlob:()=>({getBytes:()=>[1,2,3]})};parent.files.push(entry);return entry;}
function context(unrelated=0){
  const root=folder('1_uL6Lhot0KkzTIn5pxAtkNm1ZKmadsV4','shalom'),avulsos=folder('a','Avulsos',root),hino=folder('b','Meu Deus é Grande',avulsos),pdfs=folder('c','PDF',hino),outside=folder('outside','Pessoal');
  const allowed=file('allowed','partitura.pdf',pdfs),blocked=file('blocked','privado.pdf',outside),directories=new Map(),listed=[];
  for(let i=0;i<unrelated;i++)folder(`unrelated-${i}`,`Hino desconhecido ${i}`,avulsos);
  function index(dir){directories.set(dir.getId(),dir);dir.children.forEach(index);}index(root);
  const ctx=vm.createContext({console,Date,listed,Drive:{Files:{list:({q,pageToken,pageSize})=>{
    const id=q.match(/'([^']+)' in parents/)[1];listed.push(id);if(id.startsWith('unrelated-'))throw new Error('Não pode ler músicas não solicitadas');
    const dir=directories.get(id),all=[...dir.children.map(child=>({id:child.getId(),name:child.getName(),mimeType:'application/vnd.google-apps.folder'})),...dir.files.map(file=>({id:file.getId(),name:file.getName(),mimeType:'application/pdf',size:20}))];
    const start=Number(pageToken||0),end=start+pageSize;return {files:all.slice(start,end),...(end<all.length?{nextPageToken:String(end)}:{})};
  }}},DriveApp:{getFolderById:()=>root,getFileById:id=>id==='allowed'?allowed:blocked},PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'secret'})},Utilities:{base64Encode:bytes=>Buffer.from(bytes).toString('base64')},ContentService:{MimeType:{JSON:'application/json'},createTextOutput:text=>({text,setMimeType(){return this;}})}});
  vm.runInContext(source,ctx);return ctx;
}
test('catálogo percorre grupo, pasta do hino e PDF sem renomear Avulsos',()=>{const files=context().catalog_([{group:'Grupo de louvor',title:'Meu Deus é Grande'}]);assert.equal(files.length,1);assert.equal(files[0].group,'Grupo de louvor');assert.equal(files[0].aliases[0],'Meu Deus é Grande');assert.equal(files[0].path,'shalom/Avulsos/Meu Deus é Grande/PDF/partitura.pdf');});
test('script rejeita chave errada e PDF fora da raiz',()=>{const ctx=context();const call=input=>JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(input)}}).text);assert.ok(call({key:'wrong',action:'catalog'}).error);assert.ok(call({key:'secret',action:'file',id:'blocked'}).error);assert.equal(call({key:'secret',action:'file',id:'allowed'}).base64,'AQID');});
test('acervo com quatro mil pastas lê só a música solicitada usando paginação de metadados',()=>{const ctx=context(4000);assert.equal(ctx.catalog_([{group:'Grupo de louvor',title:'Meu Deus é Grande'}]).length,1);assert.equal(ctx.listed.length,8);assert.ok(ctx.listed.every(id=>!id.startsWith('unrelated-')));});
