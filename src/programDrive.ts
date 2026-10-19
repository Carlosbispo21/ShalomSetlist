import {cloud} from './sync';
import {nativeAndroid} from './native';
import type {DrivePdf,ProgramSong} from './program';
async function request(action:'catalog'|'file',extra:Record<string,unknown>) {
  if(!cloud)throw new Error('Conecte sua conta à banda.');
  const {data:{session}}=await cloud.auth.getSession();if(!session)throw new Error('Conecte este aparelho à banda.');
  const base=nativeAndroid?(import.meta.env.VITE_PUBLIC_APP_URL||'https://shalomsetlist.pages.dev'):location.origin;
  const response=await fetch(`${base}/api/drive`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action,...extra}),signal:AbortSignal.timeout(200000)});
  const data=await response.json();if(!response.ok||data.error)throw new Error(data.error||'Não foi possível consultar o Drive.');return data;
}
export async function driveCatalog(songs:ProgramSong[]):Promise<DrivePdf[]> {const data=await request('catalog',{songs:songs.map(({group,title})=>({group,title}))});if(!Array.isArray(data.files))throw new Error('Catálogo do Drive inválido.');return data.files;}
export async function driveFile(id:string):Promise<File> {
  const data=await request('file',{id});if(typeof data.base64!=='string'||data.base64.length>28000000)throw new Error('PDF inválido ou maior que 20 MB.');
  const binary=atob(data.base64),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return new File([bytes],data.name,{type:'application/pdf'});
}
