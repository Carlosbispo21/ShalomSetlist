import {GROUPS,type Group,type Day} from './domain.ts';
export type ProgramDay=Day|'both'|'';
export type ProgramSong={id:string;group:Group;title:string;artist:string;day:ProgramDay};
export type DrivePdf={id:string;name:string;path:string;group:Group|null;aliases:string[];size:number};
export function normalized(value:string) {return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\.pdf$/i,'').replace(/[^a-z0-9]+/g,' ').trim();}
const aliases:Record<string,Group>={criancas:'Crianças',infantil:'Crianças',adolescentes:'Adolescentes',mocidade:'Jovens',jovens:'Jovens',varoes:'Varões',irmas:'Irmãs',avulsos:'Grupo de louvor',louvor:'Grupo de louvor','grupo de louvor':'Grupo de louvor'};
export function programGroup(value:string):Group|null{return aliases[normalized(value)]??null;}
export function parseProgram(text:string):ProgramSong[] {
  let group:Group|null=null,day:ProgramDay='';const songs:ProgramSong[]=[];
  for(const raw of text.slice(0,20000).split(/\r?\n/)) {
    const line=raw.replace(/[*_`]/g,'').replace(/^\s*(?:[-•–]|\d+[.)])\s*/,'').trim();if(!line)continue;
    const norm=normalized(line);
    if(/^(?:programacao\s+(?:de|do|para)\s+)?(?:sabado|domingo)(?:\s+(?:e|a)\s+(?:sabado|domingo))?$/.test(norm)) {
      day=norm.includes('sabado')&&norm.includes('domingo')?'both':norm.includes('sabado')?'saturday':'sunday';group=null;continue;
    }
    const colon=line.indexOf(':'),heading=colon<0?line:line.slice(0,colon),found=programGroup(heading);
    if(found){group=found;const inline=colon<0?'':line.slice(colon+1).trim();if(!inline)continue;add(inline);continue;}
    if(!group||/^(obs\b|observacao\b|observacoes\b|aviso\b|a paz\b|deus abencoe\b|boa semana\b)/.test(norm))continue;
    add(line);
  }
  function add(line:string) {
    const parts=line.split(/\s+[-–—]\s+/),title=parts.shift()!.trim(),artist=parts.join(' - ').trim();if(!title)return;
    if(songs.some(song=>song.group===group&&song.day===day&&normalized(song.title)===normalized(title)&&normalized(song.artist)===normalized(artist)))return;
    songs.push({id:`song-${songs.length}`,group:group!,title,artist,day});
  }
  return songs.sort((a,b)=>GROUPS.indexOf(a.group)-GROUPS.indexOf(b.group));
}
export function matchPdfs(song:ProgramSong,files:DrivePdf[]) {
  const title=normalized(song.title),full=normalized(`${song.title} ${song.artist}`);
  return files.filter(file=>file.group===song.group||file.group===null).map(file=>{
    const names=[file.name,...file.aliases].map(normalized);
    const score=names.some(name=>name===full)?100:names.some(name=>name===title)?90:names.some(name=>name.startsWith(`${title} `))?70:names.some(name=>` ${name} `.includes(` ${title} `))?60:0;
    return {file,score};
  }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.file.path.localeCompare(b.file.path,'pt-BR'));
}
export function automaticPdf(song:ProgramSong,files:DrivePdf[]):string {
  const matches=matchPdfs(song,files),best=matches[0];
  // Prefix matches are suggestions, not a licence to choose an arrangement.
  return best&&best.score>=90&&matches.filter(item=>item.score===best.score).length===1?best.file.id:'';
}
export function selectedDays(day:ProgramDay):Day[]{return day==='both'?['saturday','sunday']:day?[day]:[];}
