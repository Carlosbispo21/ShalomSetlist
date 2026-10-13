import {useState} from 'react';
import {Bookmark,Plus,X,Trash2} from 'lucide-react';
export type PageMark={id:string;page:number;label:string};
export function PageMarks({page,count,marks,onChange,onJump}:{page:number;count:number;marks:PageMark[];onChange:(marks:PageMark[])=>void;onJump:(page:number)=>void}) {
  const [open,setOpen]=useState(false),[label,setLabel]=useState('');
  return <div className="page-marks">
    <button className={`button small ${open?'primary':'ghost'}`} aria-label="Marcadores" aria-expanded={open} onClick={()=>setOpen(!open)}><Bookmark size={16}/><span>Marcadores</span></button>
    {open&&<div className="marks-panel" role="dialog" aria-label="Marcadores da partitura">
      <div className="marks-heading"><strong>Marcadores</strong><button className="icon-button" aria-label="Fechar marcadores" onClick={()=>setOpen(false)}><X size={16}/></button></div>
      <form onSubmit={event=>{event.preventDefault();onChange([...marks,{id:crypto.randomUUID(),page,label:label.trim()||`Página ${page}`}]);setLabel('');}}>
        <input aria-label="Nome do marcador" maxLength={40} placeholder="Refrão, retorno…" value={label} onChange={event=>setLabel(event.target.value)}/>
        <button className="icon-button" aria-label="Marcar página atual" title={`Marcar página ${page}`}><Plus size={18}/></button>
      </form>
      {!marks.length&&<p>Marque esta página para voltar com um toque.</p>}
      <div className="marks-list">{marks.filter(mark=>mark.page<=count).map(mark=><div key={mark.id}><button className="mark-jump" onClick={()=>{onJump(mark.page);setOpen(false);}}><span>{mark.label}</span><small>Pág. {mark.page}</small></button><button className="icon-button" aria-label={`Excluir marcador ${mark.label}`} onClick={()=>onChange(marks.filter(item=>item.id!==mark.id))}><Trash2 size={15}/></button></div>)}</div>
    </div>}
  </div>;
}
