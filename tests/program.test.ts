import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseProgram,programGroup,automaticPdf,matchPdfs,selectedDays,type DrivePdf} from '../src/program.ts';
test('mensagem da banda preserva títulos/intérpretes e traduz Mocidade e Avulsos',()=>{
  const rows=parseProgram('A paz a todos, segue programação do final de semana!\n\nAdolescentes:\nEu Creio - Sarah Beatriz\nMocidade:\nEm tua presença - Diante do Trono\nVarões:\nVisitando um amigo - Canção e Louvor\nIrmãs:\nEsse Adorador - Shirley Carvalhaes\nAvulsos:\nMeu Deus é Grande');
  assert.equal(rows.length,5);assert.equal(rows[1].group,'Jovens');assert.equal(rows[4].group,'Grupo de louvor');assert.equal(rows[0].artist,'Sarah Beatriz');assert.ok(rows.every(row=>row.day===''));
  assert.equal(programGroup('Avulsos'),'Grupo de louvor');
});
test('dias explícitos, formatação WhatsApp, inline e repetição não misturam o repertório',()=>{
  const rows=parseProgram('*Sábado*\n*Crianças:* Hino Um - Autor\nHino Um - Autor\nDomingo\nMocidade:\n- Hino Dois\nObs: ensaio às 18h');
  assert.equal(rows.length,2);assert.equal(rows[0].day,'saturday');assert.equal(rows[1].day,'sunday');assert.deepEqual(selectedDays('both'),['saturday','sunday']);assert.deepEqual(selectedDays(''),[]);
});
test('PDF em grupo errado é descartado e versões ambíguas exigem escolha',()=>{
  const song=parseProgram('Mocidade:\nEm Tua Presença - Diante do Trono')[0];
  const files:DrivePdf[]=[{id:'a',name:'Em tua presença - Diante do Trono.pdf',path:'Mocidade/Hino/PDF/a',group:'Jovens',aliases:[],size:12},{id:'b',name:'Em tua presença - Diante do Trono.pdf',path:'Irmãs/a',group:'Irmãs',aliases:[],size:12}];
  assert.equal(automaticPdf(song,files),'a');assert.equal(automaticPdf(song,[...files,{...files[0],id:'c'}]),'');assert.equal(matchPdfs(song,files).length,1);
  assert.equal(automaticPdf(song,[{...files[0],name:'Partitura.pdf',aliases:['Em tua presença - Diante do Trono']}]),'a');
  assert.equal(automaticPdf(song,[{...files[0],name:'Em tua presença - Diante do Trono versão 2.pdf'}]),'');
});
