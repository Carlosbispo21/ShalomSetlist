// Google Apps Script: read-only bridge. Configure properties; deploy as you.
// No Google token, password or Supabase service-role key leaves this script.
var SHALOM_ROOT = '1_uL6Lhot0KkzTIn5pxAtkNm1ZKmadsV4';
function doPost(e) {
  try {
    var input=JSON.parse(e.postData.contents),key=PropertiesService.getScriptProperties().getProperty('SHALOM_KEY');
    if(!key||input.key!==key)return json_({error:'Acesso não autorizado'});
    if(input.action==='catalog')return json_({files:catalog_(input.songs)});
    if(input.action==='file') {
      var file=DriveApp.getFileById(String(input.id||''));
      if(!insideRoot_(file)||!/\.pdf$/i.test(file.getName())||file.getSize()>20971520)throw new Error('PDF inválido ou fora da pasta configurada');
      return json_({name:file.getName(),size:file.getSize(),base64:Utilities.base64Encode(file.getBlob().getBytes())});
    }
    throw new Error('Operação inválida');
  }catch(error){return json_({error:'Não foi possível ler a pasta ou o PDF. Confira o acesso da conta que publicou o script.'});}
}
function json_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function norm_(value){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function group_(name){return {criancas:'Crianças',adolescentes:'Adolescentes',mocidade:'Jovens',jovens:'Jovens',varoes:'Varões',irmas:'Irmãs',avulsos:'Grupo de louvor','grupo de louvor':'Grupo de louvor'}[norm_(name)]||null;}
function catalog_(songs) {
  if(!Array.isArray(songs)||!songs.length||songs.length>50)throw new Error('Informe os hinos da programação');
  if(typeof Drive==='undefined')throw new Error('Ative o serviço Drive API v3 no Apps Script ou atualize appsscript.json');
  var files=[],queue=[],seen={},start=Date.now(),groups=children_(SHALOM_ROOT);
  // Query the group itself, then only folders named after requested hymns.
  // Never walk thousands of unrelated hymn/PDF folders in the shared archive.
  groups.forEach(function(groupFolder) {
    if(groupFolder.mimeType!=='application/vnd.google-apps.folder')return;
    var group=group_(groupFolder.name),wanted=songs.filter(function(song){return song.group===group;});
    if(!wanted.length)return;
    queue.push({id:groupFolder.id,names:['shalom',groupFolder.name],group:group,wanted:wanted,selected:false});
  });
  while(queue.length) {
    if(Date.now()-start>180000||Object.keys(seen).length>300||files.length>1000)throw new Error('A busca demorou. Importe menos hinos por vez.');
    var item=queue.shift(),id=item.id;if(seen[id])continue;seen[id]=true;
    children_(id).forEach(function(file){
      if(file.mimeType==='application/vnd.google-apps.folder'){
        var generic=['pdf','pdfs','partituras','hinos','arquivos'].includes(norm_(file.name)),matched=wantedName_(file.name,item.wanted);
        if(item.selected||generic||matched)queue.push({id:file.id,names:item.names.concat([file.name]),group:item.group,wanted:item.wanted,selected:item.selected||matched});
      }else if(/\.pdf$/i.test(file.name)&&(item.selected||wantedName_(file.name,item.wanted)))files.push({id:file.id,name:file.name,size:Number(file.size||0),path:item.names.concat([file.name]).join('/'),group:item.group,
        aliases:item.names.filter(function(name){return !group_(name)&&!['shalom','pdf','pdfs','partituras','arquivos'].includes(norm_(name));})});
    });
  }
  return files;
}
function children_(id){var files=[],token;do{var page=Drive.Files.list({q:"'"+id+"' in parents and trashed = false",pageSize:1000,fields:'nextPageToken,files(id,name,mimeType,size)',pageToken:token,includeItemsFromAllDrives:true,supportsAllDrives:true});files=files.concat(page.files||[]);token=page.nextPageToken;}while(token);return files;}
function wantedName_(name,songs){var value=' '+norm_(name.replace(/\.pdf$/i,''))+' ';return songs.some(function(song){return typeof song.title==='string'&&value.includes(' '+norm_(song.title)+' ');});}
function insideRoot_(file) {
  var queue=[file],seen={},checked=0;
  while(queue.length&&checked++<200) {
    var item=queue.shift(),parents=item.getParents();while(parents.hasNext()) {
      var parent=parents.next(),id=parent.getId();if(id===SHALOM_ROOT)return true;if(!seen[id]){seen[id]=true;queue.push(parent);}
    }
  }
  return false;
}
// Run manually once to authorise Drive access and check the folder.
function testarPasta(){var files=catalog_([{group:'Adolescentes',title:'Eu Creio'},{group:'Jovens',title:'Em Tua Presença'},{group:'Varões',title:'Visitando um Amigo'},{group:'Irmãs',title:'Esse Adorador'},{group:'Grupo de louvor',title:'Meu Deus é Grande'}]);console.log('PDFs encontrados para os cinco hinos de exemplo: '+files.length);}
function criarChave(){var props=PropertiesService.getScriptProperties();if(!props.getProperty('SHALOM_KEY'))props.setProperty('SHALOM_KEY',Utilities.getUuid()+Utilities.getUuid());}
