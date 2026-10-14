import {useState} from 'react';
import {PDFDocument} from 'pdf-lib';
import {X,LoaderCircle,UploadCloud,Search,Settings2} from 'lucide-react';
import {parseProgram,automaticPdf,matchPdfs,selectedDays,normalized,type ProgramSong,type ProgramDay,type DrivePdf} from './program';
import {driveCatalog,driveFile} from './programDrive';
import {publishScore} from './sync';
import {MAX_PDF_BYTES,weekKey,type Room,type Score} from './domain';
import {nativeAndroid,programs} from './native';

export default function ProgramImport({room,existing,initialText,onClose,onSaved,onPublished}:{room:Room;existing:Score[];initialText:string;onClose:()=>void;onSaved:()=>void;onPublished:()=>void}) {
  const [text,setText]=useState(initialText),[rows,setRows]=useState<ProgramSong[]>([]),[files,setFiles]=useState<DrivePdf[]>([]),[selected,setSelected]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[progress,setProgress]=useState(''),[defaultDay,setDefaultDay]=useState<ProgramDay>('');
  const [completed,setCompleted]=useState<Set<string>>(new Set()),[ids]=useState<Record<string,string>>({});
  const choicesKey=`shalom-drive-choices:${room.id}`;
  function choices():Record<string,string>{try{return JSON.parse(localStorage.getItem(choicesKey)??'{}');}catch{return {};}}
  function songKey(song:ProgramSong){return `${song.group}:${normalized(song.title)}:${normalized(song.artist)}`;}
  async function analyse() {
    const parsed=parseProgram(text);if(!parsed.length){setError('Não encontrei hinos com grupos. Use títulos como Crianças:, Mocidade: ou Avulsos:.');return;}
    setRows(parsed);setFiles([]);setSelected({});setCompleted(new Set());setBusy(true);setError('');setProgress('Consultando as subpastas do Drive…');
    try{const catalog=await driveCatalog(parsed),saved=choices();setFiles(catalog);setSelected(Object.fromEntries(parsed.map(song=>[song.id,matchPdfs(song,catalog).some(item=>item.file.id===saved[songKey(song)])?saved[songKey(song)]:automaticPdf(song,catalog)])));}
    catch(error){setError(error instanceof Error?error.message:'Não foi possível consultar o Drive.');}
    finally{setBusy(false);setProgress('');}
  }
  function days(song:ProgramSong){return selectedDays(song.day||defaultDay);}
  function already(song:ProgramSong,file:DrivePdf,day:string){return existing.some(score=>score.scope!=='festivity'&&score.week===weekKey()&&score.day===day&&score.group===song.group&&score.filename===file.name);}
  const missing=rows.some(song=>!selected[song.id]||!days(song).length);
  async function send() {
    if(busy||missing||!rows.length)return;setBusy(true);setError('');
    const sent=new Set(completed);let count=0;
    try{
      for(const song of rows){
        const file=files.find(file=>file.id===selected[song.id]);if(!file)throw new Error(`Escolha o PDF de ${song.title}.`);
        const destinations=days(song).filter(day=>!sent.has(`${song.id}:${day}`)&&!already(song,file,day));if(!destinations.length)continue;
        setProgress(`Baixando ${song.title}…`);const pdf=await driveFile(file.id);
        if(pdf.size>MAX_PDF_BYTES)throw new Error(`${file.name}: limite de 20 MB.`);
        let document;try{document=await PDFDocument.load(await pdf.arrayBuffer());}catch{throw new Error(`${file.name}: PDF inválido ou protegido por senha.`);}
        if(!document.getPageCount())throw new Error(`${file.name}: PDF vazio.`);
        for(const day of destinations){
          const key=`${song.id}:${day}`;ids[key]??=crypto.randomUUID();setProgress(`Enviando ${song.title} (${day==='saturday'?'sábado':'domingo'})…`);
          const score:Score={id:ids[key],title:song.title,group:song.group,day,week:weekKey(),scope:'weekly',bpm:80,pages:document.getPageCount(),position:Math.max(0,...existing.map(score=>score.position+1))+rows.indexOf(song),filename:pdf.name};
          await publishScore(score,pdf,room);sent.add(key);setCompleted(new Set(sent));count++;localStorage.setItem(choicesKey,JSON.stringify({...choices(),[songKey(song)]:file.id}));onPublished();
        }
      }
      if(localStorage.getItem('shalom-program-draft')===text)localStorage.removeItem('shalom-program-draft');onSaved();
    }catch(error){setError(`${error instanceof Error?error.message:'Não foi possível enviar a programação.'}${count?' Os hinos já enviados serão preservados; tente novamente os restantes.':''}`);}
    finally{setBusy(false);setProgress('');}
  }
  function changeText(value:string){setText(value);setRows([]);setFiles([]);setSelected({});setCompleted(new Set());Object.keys(ids).forEach(key=>delete ids[key]);localStorage.setItem('shalom-program-draft',value);}
  return <div className="modal-backdrop"><div className="modal program-modal" role="dialog" aria-modal="true" aria-label="Importar programação">
    <button className="icon-button modal-close" aria-label="Fechar programação" disabled={busy} onClick={onClose}><X/></button><h2>Importar programação</h2><p className="modal-description">Cole a mensagem. Confira os PDFs e os dias antes de enviar.</p>
    <label>Mensagem da programação<textarea aria-label="Mensagem da programação" maxLength={20000} rows={7} value={text} disabled={busy} onChange={event=>changeText(event.target.value)} placeholder={'Adolescentes:\nEu Creio - Sarah Beatriz\n\nMocidade:\nEm Tua Presença - Diante do Trono'}/></label>
    <label>Dia quando a mensagem não informa<select aria-label="Dia da programação" value={defaultDay} disabled={busy} onChange={event=>setDefaultDay(event.target.value as ProgramDay)}><option value="">Escolher</option><option value="saturday">Sábado</option><option value="sunday">Domingo</option><option value="both">Sábado e domingo</option></select></label>
    <button className="button ghost full" disabled={busy||!text.trim()} onClick={()=>void analyse()}><Search size={16}/>Buscar PDFs no Drive</button><p className="program-choice-note">A versão escolhida de cada hino fica lembrada neste aparelho.</p>
    {rows.length>0&&<div className="program-results">{rows.map(song=>{
      const matches=matchPdfs(song,files),file=files.find(file=>file.id===selected[song.id]);
      const done=file&&days(song).length&&days(song).every(day=>completed.has(`${song.id}:${day}`)||already(song,file,day));
      return <div className="program-song" key={song.id}><strong>{song.title}</strong><small>{song.group}{song.artist?` · ${song.artist}`:''}</small>
        <label>PDF<select aria-label={`PDF de ${song.title}`} disabled={busy||Boolean(done)} value={selected[song.id]??''} onChange={event=>setSelected({...selected,[song.id]:event.target.value})}><option value="">{matches.length?'Escolha a versão':'Nenhum PDF correspondente'}</option>{matches.map(({file})=><option value={file.id} key={file.id}>{file.path}</option>)}</select></label>
        <label>Dia<select aria-label={`Dia de ${song.title}`} value={song.day} disabled={busy||Boolean(done)} onChange={event=>setRows(rows.map(row=>row.id===song.id?{...row,day:event.target.value as ProgramDay}:row))}><option value="">Usar escolha acima</option><option value="saturday">Sábado</option><option value="sunday">Domingo</option><option value="both">Sábado e domingo</option></select></label>
        {done&&<p>Já está no repertório.</p>}
      </div>;
    })}</div>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    <button className="button primary full" disabled={busy||missing||!rows.length||!files.length} onClick={()=>void send()}>{busy?<LoaderCircle className="spin" size={17}/>:<UploadCloud size={17}/>} {progress||'Enviar programação para a banda'}</button>
    <details className="program-setup"><summary>Conectar a pasta do Drive</summary><p>A configuração é feita uma vez por um responsável. <a target="_blank" rel="noreferrer" href="https://github.com/Carlosbispo21/ShalomSetlist/blob/main/GUIA_AUTOMACAO.md">Abrir passo a passo</a></p><label>Identificador da banda<input aria-label="Identificador da banda para integração" readOnly value={room.id}/></label></details>
    {nativeAndroid&&<div className="program-notifications"><strong>Receber programações do WhatsApp</strong><p>Opcional: ative o acesso às notificações no Android. O app identifica textos de programação recebidos pelo WhatsApp e guarda um rascunho neste celular para sua revisão. Não lê o histórico das conversas nem envia os hinos sozinho. Se a notificação vier incompleta, use Compartilhar → Shalom ou cole a mensagem.</p><button className="button ghost full" onClick={()=>void programs.settings().catch(()=>setError('Abra Ajustes do Android → Acesso às notificações.'))}><Settings2 size={16}/>Configurar recebimento automático</button></div>}
  </div></div>;
}
