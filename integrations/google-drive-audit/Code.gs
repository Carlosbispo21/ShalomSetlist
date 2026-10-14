// Separate, private Apps Script project. Read-only: no Drive files are modified.
var AUDIT_ROOT = '1_uL6Lhot0KkzTIn5pxAtkNm1ZKmadsV4';
var AUDIT_FOLDER = 'application/vnd.google-apps.folder';
function doGet() { return HtmlService.createHtmlOutputFromFile('Index').setTitle('Conferir acervo'); }
function auditConfig() { return {root:AUDIT_ROOT}; }
function testarAuditoria() { var page=auditPage(AUDIT_ROOT,'');console.log('Primeiro lote: '+page.folders.length+' pastas e '+page.files.length+' arquivos. Nenhum arquivo foi alterado.'); }
function auditNorm_(name) { return String(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }
function auditGroup_(name) {
  return {criancas:'Crianças',adolescentes:'Adolescentes',mocidade:'Jovens',jovens:'Jovens',varoes:'Varões',irmas:'Irmãs',avulsos:'Grupo de louvor','grupo de louvor':'Grupo de louvor'}[auditNorm_(name)] || '';
}
function auditPath_(folderId) {
  var id=folderId,seen={},names=[];
  for(var depth=0;depth<40;depth++) {
    if(seen[id])break;seen[id]=true;
    var file=Drive.Files.get(id,{fields:'id,name,mimeType,parents,trashed',supportsAllDrives:true});
    if(file.trashed||file.mimeType!==AUDIT_FOLDER)throw new Error('A pasta não está disponível.');
    names.unshift(file.name);
    if(id===AUDIT_ROOT)return names;
    if(!file.parents||file.parents.length!==1)break;
    id=file.parents[0];
  }
  throw new Error('Pasta fora do acervo configurado ou estrutura não suportada.');
}
// Each browser request reads one metadata page, then checkpoints locally.
// Thousands of folders do not have to fit in one Apps Script execution.
function auditPage(folderId,pageToken) {
  if(!/^[a-zA-Z0-9_-]{1,200}$/.test(String(folderId||'')))throw new Error('Pasta inválida.');
  var parts=auditPath_(folderId);
  var options={q:"'"+folderId+"' in parents and trashed = false",pageSize:1000,
    fields:'nextPageToken,files(id,name,mimeType,size,md5Checksum,capabilities(canRename,canMoveItemWithinDrive))',
    includeItemsFromAllDrives:true,supportsAllDrives:true};
  if(pageToken)options.pageToken=String(pageToken);
  var page=Drive.Files.list(options);
  return {folders:(page.files||[]).filter(function(file){return file.mimeType===AUDIT_FOLDER;}).map(function(file){return {id:file.id,name:file.name};}),
    files:(page.files||[]).filter(function(file){return file.mimeType!==AUDIT_FOLDER;}).map(function(file){return auditFile_(file,parts);}),nextPageToken:page.nextPageToken||''};
}
function auditFile_(file,parts) {
  var mime=String(file.mimeType||''),name=String(file.name||''),group=auditGroup_(parts[1]||''),issues=[];
  var type=mime==='application/pdf'?'PDF':mime.indexOf('image/')===0?'Imagem':mime==='application/vnd.google-apps.shortcut'?'Atalho':'Outro';
  var extension=(name.match(/\.([^.]+)$/)||[])[1];extension=String(extension||'').toLowerCase();
  if(!group)issues.push('Grupo não reconhecido');
  if(type==='PDF'&&extension!=='pdf')issues.push('PDF sem extensão .pdf');
  if(type!=='PDF'&&extension==='pdf')issues.push('Extensão .pdf não corresponde ao tipo informado pelo Drive');
  if(type==='Imagem')issues.push('Imagem: candidata à conversão para PDF, preservando o original');
  if(type==='Atalho')issues.push('Atalho não percorrido; revisar o arquivo de destino');
  if(type==='Outro')issues.push('Formato fora do repertório PDF');
  var structure=group&&parts.length===4&&auditNorm_(parts[3])==='pdf'&&parts[2].trim();
  if(!structure)issues.push('Caminho fora do padrão Grupo / Hino / PDF');
  var stem=name.replace(/\.[^.]+$/,''),hymn=group&&parts.length>=3?parts[2].trim():'';
  var generic=/^(partitura|partituras|pdf|scan|digitalizacao|documento|imagem|img\s*\d*|dsc\s*\d*)$/.test(auditNorm_(stem));
  var suggestion=name;
  if(type==='PDF') {
    if(generic&&hymn&& !['pdf','pdfs','partituras','hinos','arquivos'].includes(auditNorm_(hymn))) {
      suggestion=hymn+'.pdf';issues.push('Nome genérico: confirmar título e versão antes de renomear');
    } else if(extension!=='pdf')suggestion=(extension?stem:name)+'.pdf';
    if(hymn&&!generic&&!auditNorm_(stem).includes(auditNorm_(hymn)))issues.push('Nome do arquivo não identifica o hino da pasta: revisar título e versão');
    if(/\s{2,}|^\s|\s$/.test(name)){suggestion=suggestion.replace(/\s+/g,' ').trim();issues.push('Espaçamento irregular no nome');}
  }
  return {id:file.id,name:name,path:parts.concat([name]).join('/'),group:group,type:type,mimeType:mime,size:Number(file.size||0),
    md5:file.md5Checksum||'',suggestedName:suggestion,issues:issues,canRename:!!(file.capabilities&&file.capabilities.canRename),
    canMove:!!(file.capabilities&&file.capabilities.canMoveItemWithinDrive)};
}
