import {useCallback,useEffect,useState} from 'react';
import {Users,Plus,X,LoaderCircle} from 'lucide-react';
import {cloud,grantDirector,listBandMembers,removeDirector,type BandMember} from './sync';
function message(error:unknown) {return error && typeof error==='object' && 'message' in error ? String(error.message) : 'Não foi possível alterar o acesso. Tente novamente.';}
export default function Directors({notify}:{notify:(message:string)=>void}) {
  const [members,setMembers]=useState<BandMember[]>([]),[email,setEmail]=useState(''),[error,setError]=useState('');
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[currentId,setCurrentId]=useState('');
  const refresh=useCallback(async()=>{
    try{setMembers(await listBandMembers());setError('');}
    catch{setError('Não foi possível carregar as contas da banda. Verifique a conexão e tente novamente.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();void cloud?.auth.getSession().then(({data})=>setCurrentId(data.session?.user.id??''));},[refresh]);
  async function grant(target:string) {
    setBusy(true);setError('');
    try{await grantDirector(target);setEmail('');await refresh();notify('Responsável liberado. A conta já pode enviar partituras.');}
    catch(error){setError(message(error));}finally{setBusy(false);}
  }
  async function revoke(id:string) {
    setBusy(true);setError('');
    try{await removeDirector(id);await refresh();notify('Conta alterada para músico.');}
    catch(error){setError(message(error));}finally{setBusy(false);}
  }
  const accounts=members.filter(member=>member.email&&!member.is_anonymous);
  return <section className="settings-card directors-card"><div className="directors-heading"><Users size={20}/><h2>Responsáveis</h2></div>
    <p className="directors-help">Escolha uma conta abaixo para liberar o envio. Você também pode liberar pelo e-mail de uma conta já criada, mesmo antes de ela entrar na banda.</p>
    {loading?<p className="directors-help">Carregando…</p>:<div className="directors-list">{accounts.map(member=><div className="director-row" key={member.user_id}>
      <span className="director-avatar">{member.email[0]?.toUpperCase()}</span><div><strong>{member.email}</strong><small>{member.is_owner?'Criador da banda':member.role==='director'?'Responsável':'Músico'}{member.user_id===currentId?' · Você':''}</small></div>
      {member.role==='musician'?<button className="button small ghost" disabled={busy} onClick={()=>void grant(member.email)} aria-label={`Tornar ${member.email} responsável`}>Tornar responsável</button>:!member.is_owner&&member.user_id!==currentId&&<button className="icon-button" disabled={busy} aria-label={`Remover permissão de ${member.email}`} onClick={()=>void revoke(member.user_id)}><X size={17}/></button>}
    </div>)}</div>}
    <form className="director-form" onSubmit={event=>{event.preventDefault();void grant(email);}}><label>E-mail da conta<input aria-label="E-mail do novo responsável" type="email" required value={email} onChange={event=>setEmail(event.target.value)} placeholder="nome@email.com"/></label><button className="button primary" disabled={busy}>{busy?<LoaderCircle className="spin" size={16}/>:<Plus size={16}/>}Liberar responsável</button></form>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {members.some(member=>member.is_anonymous)&&<p className="directors-help">Músicos que entraram somente pelo código precisam criar uma conta com e-mail para receber acesso de responsável.</p>}
  </section>;
}
