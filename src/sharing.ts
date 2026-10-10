import { Share } from '@capacitor/share';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { nativeAndroid } from './native';
import type { Room } from './domain';

export function invitation(room: Room): ShareData {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL;
  const url = configured && /^https:\/\//.test(configured) ? configured : !nativeAndroid && location.protocol === 'https:' ? location.origin : 'https://github.com/Carlosbispo21/ShalomSetlist/releases/latest';
  return { title:room.name, text:`${room.name}\nCódigo da banda: ${room.code}\nAbra o Shalom e escolha Conectar à banda.`, url };
}
export async function shareInvitation(room: Room) {
  const data = invitation(room);
  if (nativeAndroid) { await Share.share({title:data.title,text:data.text,url:data.url,dialogTitle:'Compartilhar banda'}); return 'shared'; }
  if (navigator.share) { await navigator.share(data); return 'shared'; }
  await navigator.clipboard.writeText(`${data.text}\n${data.url}`); return 'copied';
}
export function pdfFilename(name: string) {
  const clean = name.replace(/[\\/<>:"|?*\u0000-\u001f]/g,'_').trim().slice(0,120) || 'Partitura';
  return /\.pdf$/i.test(clean) ? clean : `${clean}.pdf`;
}
export async function sharePdf(file: File) {
  if (nativeAndroid) {
    // Private cache only: never make the score bucket or a download link public.
    const folder = 'shalom-shared';
    await Filesystem.mkdir({path:folder,directory:Directory.Cache,recursive:true}).catch(() => {});
    const entries = await Filesystem.readdir({path:folder,directory:Directory.Cache});
    for (const entry of entries.files) if (entry.mtime && entry.mtime < Date.now()-86400000) {
      await Filesystem.deleteFile({path:`${folder}/${entry.name}`,directory:Directory.Cache}).catch(() => {});
    }
    const data = await new Promise<string>((resolve,reject) => {
      const reader = new FileReader(); reader.onerror = () => reject(new Error('Não foi possível preparar o PDF.'));
      reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(file);
    });
    const path = `${folder}/${crypto.randomUUID()}-${pdfFilename(file.name)}`;
    const saved = await Filesystem.writeFile({path,directory:Directory.Cache,data});
    await Share.share({title:file.name,files:[saved.uri],dialogTitle:'Compartilhar PDF'});
    return 'shared';
  }
  if (navigator.canShare?.({files:[file]})) { await navigator.share({files:[file],title:file.name}); return 'shared'; }
  const url = URL.createObjectURL(file), link = document.createElement('a');
  link.href = url; link.download = file.name; link.click();
  setTimeout(() => URL.revokeObjectURL(url),60000);
  return 'downloaded';
}
export function shareCancelled(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError' || error instanceof Error && /cancel/i.test(error.message);
}
