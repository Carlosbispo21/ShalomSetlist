import { createClient } from '@supabase/supabase-js';
import { getPdf, getScores, removeScore, savePdf, saveScore } from './db';
import { type Room, type Score, weekKey, isActiveScore, isFestivity, scoreFolder } from './domain';
import { describeUploadError, isConnectionError } from './uploadErrors';
const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const cloud = url && key ? createClient(url, key) : null;
export const ROOM_CACHE_KEY = `shalom-room:${url ?? 'local'}`;
export function requireCloud() { if (!cloud) throw new Error('Configure o Supabase para conectar os aparelhos. Veja o README do projeto.'); return cloud; }
function fromRow(row: Record<string, unknown>): Score {
  return { id: String(row.id), title: String(row.title), group: row.group_name as Score['group'], day: row.day as Score['day'], week: row.week == null ? null : String(row.week), scope: row.scope === 'festivity' ? 'festivity' : 'weekly', bpm: Number(row.bpm), pages: Number(row.pages), position: Number(row.position), filename: String(row.filename), roomId: String(row.room_id), storagePath: String(row.storage_path) };
}
export async function getRoom(): Promise<Room | null> {
  const client = requireCloud();
  const { data: { session } } = await client.auth.getSession();
  if (!session) return null;
  const { data, error } = await client.from('members').select('room_id, role, rooms(*)').eq('user_id', session.user.id).limit(1).maybeSingle();
  if (error) throw error;
  if (!data?.rooms) return null;
  const row = data.rooms as unknown as { id: string; name: string; join_code: string; owner_id: string };
  return { id: row.id, name: row.name, code: row.join_code, ownerId: row.owner_id, role: data.role === 'director' ? 'director' : 'musician' };
}
export async function joinRoom(code: string) {
  const client = requireCloud();
  const { data: { session } } = await client.auth.getSession();
  if (!session) { const { error } = await client.auth.signInAnonymously(); if (error) throw new Error('Não foi possível conectar. Verifique se o login anônimo está ativado no Supabase.'); }
  const { error } = await client.rpc('join_shalom_room', { room_code: code.trim().toUpperCase() });
  if (error) throw new Error('Código não encontrado ou conexão indisponível. Confira o código com o responsável.');
  return getRoom();
}
export async function loginDirector(email: string, password: string, signup: boolean, bandCode?: string) {
  const client = requireCloud();
  if (signup) {
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error('Conta criada. Confirme o e-mail e depois entre como responsável.');
  } else {
    const { error } = await client.auth.signInWithPassword({ email, password }); if (error) throw error;
  }
  if (bandCode) return joinRoom(bandCode);
  const existing = await getRoom();
  if (existing) return existing;
  const { error } = await client.rpc('create_shalom_room', { room_name: 'Banda Shalom' }); if (error) throw error;
  return getRoom();
}
export type Director = { user_id: string; email: string; is_owner: boolean };
export async function listDirectors(): Promise<Director[]> {
  const { data, error } = await requireCloud().rpc('list_shalom_directors');
  if (error) throw error; return data ?? [];
}
export async function grantDirector(email: string) {
  const { error } = await requireCloud().rpc('grant_shalom_director', { target_email: email.trim() });
  if (error) throw error;
}
export async function removeDirector(userId: string) {
  const { error } = await requireCloud().rpc('remove_shalom_director', { target_user: userId });
  if (error) throw error;
}
export async function pullScores(room: Room) {
  const { data, error } = await requireCloud().from('scores').select('*').eq('room_id', room.id).or(`week.eq.${weekKey()},scope.eq.festivity`).order('position');
  if (error) throw error;
  const scores = (data ?? []).map(fromRow);
  const ids = new Set(scores.map(s => s.id));
  for (const local of await getScores()) if (local.roomId === room.id && isActiveScore(local, weekKey()) && !ids.has(local.id)) await removeScore(local.id);
  for (const score of scores) await saveScore(score);
  return scores;
}
export async function downloadPdf(score: Score) {
  const cached = await getPdf(score.id); if (cached) return cached;
  if (!score.storagePath) throw new Error('PDF não encontrado neste aparelho.');
  const { data, error } = await requireCloud().storage.from('scores').download(score.storagePath);
  if (error) throw new Error('Não foi possível baixar a partitura. Verifique sua conexão.');
  await savePdf(score.id, data); return data;
}
export async function publishScore(score: Score, file: Blob, room: Room) {
  const client = requireCloud(), path = `${room.id}/${scoreFolder(score)}/${score.id}.pdf`;
  // Materialize the PDF before fetch: Android picker files can be backed by a
  // temporary content URI which cannot be streamed reliably through FormData.
  let bytes: ArrayBuffer;
  try { bytes = await file.arrayBuffer(); } catch (error) { throw describeUploadError('leitura do PDF', error); }
  try {
    const upload = await client.storage.from('scores').upload(path, bytes, { contentType: 'application/pdf', upsert: false });
    if (upload.error) throw upload.error;
  } catch (error) { throw describeUploadError('envio do PDF', error); }
  const { error } = await client.from('scores').insert({ id: score.id, room_id: room.id, title: score.title, group_name: score.group, day: score.day, week: score.week, scope: score.scope ?? 'weekly', bpm: score.bpm, pages: score.pages, position: score.position, filename: score.filename, storage_path: path });
  if (error) {
    if (isConnectionError(error)) {
      // A lost response does not imply a failed transaction. Confirm before
      // deleting a PDF that may already be referenced by a saved hymn.
      const confirmation = await client.from('scores').select('id').eq('id',score.id).maybeSingle();
      if (!confirmation.error && confirmation.data) {
        await saveScore({ ...score, roomId: room.id, storagePath: path }, file); return;
      }
    } else { await client.storage.from('scores').remove([path]); }
    throw describeUploadError('cadastro do hino', error);
  }
  await saveScore({ ...score, roomId: room.id, storagePath: path }, file);
}
export async function deleteScore(score: Score) {
  if (score.roomId) {
    // Festividades não entram no Cron: remova o PDF antes da linha para que uma
    // falha de Storage mantenha a exclusão disponível para nova tentativa manual.
    if (isFestivity(score) && score.storagePath) {
      const removal = await requireCloud().storage.from('scores').remove([score.storagePath]);
      if (removal.error) throw removal.error;
    }
    const { error } = await requireCloud().from('scores').delete().eq('id', score.id); if (error) throw error;
    // Failed storage cleanup is retried by the scheduled cleanup function.
    if (score.storagePath && !isFestivity(score)) await requireCloud().storage.from('scores').remove([score.storagePath]);
  }
  await removeScore(score.id);
}
