// Executado pelo Cron. SERVICE_ROLE_KEY fica apenas no servidor, nunca no aplicativo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (request: Request) => {
  const secret = Deno.env.get('CLEANUP_SECRET');
  if (!secret || request.headers.get('x-cleanup-secret') !== secret) return new Response('Unauthorized', { status: 401 });
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const { data: week, error: weekError } = await client.rpc('shalom_week');
    if (weekError) throw weekError;
    const { data: rooms, error: roomError } = await client.from('rooms').select('id');
    if (roomError) throw roomError;
    let removed = 0;
    for (const room of rooms ?? []) {
      // Cada pasta de semana contém apenas PDFs; processar página zero após
      // cada remoção evita pular arquivos por causa da mudança de offset.
      const { data: folders, error } = await client.storage.from('scores').list(room.id, { limit: 1000 });
      if (error) throw error;
      for (const folder of folders ?? []) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(folder.name) || folder.name >= week) continue;
        while (true) {
          const prefix = `${room.id}/${folder.name}`;
          const { data: files, error: listError } = await client.storage.from('scores').list(prefix, { limit: 100 });
          if (listError) throw listError;
          if (!files?.length) break;
          const { error: removeError } = await client.storage.from('scores').remove(files.map(f => `${prefix}/${f.name}`));
          if (removeError) throw removeError;
          removed += files.length;
        }
      }
    }
    const { error } = await client.from('scores').delete().eq('scope', 'weekly').lt('week', week);
    if (error) throw error;
    return Response.json({ removed, week });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Cleanup failed; retry scheduled job' }, { status: 500 });
  }
});
