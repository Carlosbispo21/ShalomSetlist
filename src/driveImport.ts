import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { scoreFiles } from './native';

export async function importDrivePdfs():Promise<File[]> {
  const { files } = await scoreFiles.pickPdfs();
  try {
    const imported:File[]=[];
    for (const file of files) {
      const result = await fetch(Capacitor.convertFileSrc(file.uri));
      if (!result.ok) throw new Error('Não foi possível ler o PDF selecionado.');
      imported.push(new File([await result.blob()],file.name,{type:'application/pdf'}));
    }
    return imported;
  } finally {
    await Promise.all(files.map(file => Filesystem.deleteFile({path:file.uri}).catch(() => {})));
  }
}
