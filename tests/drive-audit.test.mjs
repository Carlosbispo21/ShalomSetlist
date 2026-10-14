import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const source=await readFile(new URL('../integrations/google-drive-audit/Code.gs',import.meta.url),'utf8');
const root='1_uL6Lhot0KkzTIn5pxAtkNm1ZKmadsV4',folder='application/vnd.google-apps.folder';
function context(){
 const dirs={root:{id:root,name:'shalom',mimeType:folder},group:{id:'group',name:'Avulsos',mimeType:folder,parents:[root]},hymn:{id:'hymn',name:'Meu Deus é Grande',mimeType:folder,parents:['group']},pdf:{id:'pdf',name:'PDF',mimeType:folder,parents:['hymn']},outside:{id:'outside',name:'Pessoal',mimeType:folder,parents:['other']},other:{id:'other',name:'Meu Drive',mimeType:folder}};
 const files=Array.from({length:1001},(_,i)=>({id:`file-${i}`,name:`Meu Deus é Grande - Versão ${i}.pdf`,mimeType:'application/pdf',size:'20',md5Checksum:i<2?'same':'hash'+i,capabilities:{canRename:true,canMoveItemWithinDrive:true}}));let writes=0;
 const ctx=vm.createContext({console,Drive:{Files:{get:id=>id===root?dirs.root:dirs[id],list:options=>{assert.ok(options.q.includes("'pdf'"));const offset=Number(options.pageToken||0),end=offset+options.pageSize;return {files:files.slice(offset,end),nextPageToken:end<files.length?String(end):undefined};},update:()=>{writes++;throw new Error('Nenhuma escrita permitida');},create:()=>{writes++;throw new Error('Nenhuma escrita permitida');}}}});
 vm.runInContext(source,ctx);return {ctx,writes:()=>writes};
}
test('auditoria lê páginas independentes, resolve caminho e não modifica o Drive',()=>{
 const {ctx,writes}=context(),first=ctx.auditPage('pdf',''),second=ctx.auditPage('pdf',first.nextPageToken);
 assert.equal(first.files.length,1000);assert.equal(second.files.length,1);assert.equal(second.nextPageToken,'');assert.equal(first.files[0].path,'shalom/Avulsos/Meu Deus é Grande/PDF/Meu Deus é Grande - Versão 0.pdf');assert.equal(first.files[0].group,'Grupo de louvor');assert.equal(first.files[0].issues.length,0);assert.equal(first.files[0].md5,first.files[1].md5);assert.equal(writes(),0);
 assert.equal(ctx.auditFile_({name:'Hino.pdf',mimeType:'application/pdf'},['shalom','Mocidade','Hino','PDF']).group,'Jovens');
});
test('auditoria rejeita pasta fora do acervo antes de listar seu conteúdo',()=>{const {ctx}=context();assert.throws(()=>ctx.auditPage('outside',''),/fora do acervo/);assert.throws(()=>ctx.auditPage("x' or true",''),/inválida/);});
test('tipo MIME prevalece sobre extensão e imagens permanecem originais',()=>{
 const {ctx}=context(),parts=['shalom','Avulsos','Meu Deus é Grande','PDF'];
 const image=ctx.auditFile_({id:'image',name:'foto.pdf',mimeType:'image/jpeg'},parts);assert.equal(image.type,'Imagem');assert.equal(image.suggestedName,'foto.pdf');assert.ok(image.issues.some(issue=>issue.includes('não corresponde')));assert.ok(image.issues.some(issue=>issue.includes('preservando o original')));
 const pdf=ctx.auditFile_({name:'partitura.pdf',mimeType:'application/pdf'},parts);assert.equal(pdf.suggestedName,'Meu Deus é Grande.pdf');assert.ok(pdf.issues.some(issue=>issue.includes('confirmar título e versão')));
 const wrong=ctx.auditFile_({name:'Meu Deus é Grande.txt',mimeType:'application/pdf'},parts);assert.equal(wrong.suggestedName,'Meu Deus é Grande.pdf');
 const moved=ctx.auditFile_({name:'Hino.pdf',mimeType:'application/pdf'},['shalom','Crianças']);assert.ok(moved.issues.some(issue=>issue.includes('Caminho fora')));
 const shortcut=ctx.auditFile_({name:'Partitura',mimeType:'application/vnd.google-apps.shortcut'},parts);assert.equal(shortcut.type,'Atalho');assert.ok(shortcut.issues.some(issue=>issue.includes('não percorrido')));
});
