import { openDB } from 'idb';
import { isExpiredScore, type Annotations, type Score } from './domain';
const database = openDB('shalom-v1', 1, { upgrade(db) {
  db.createObjectStore('scores', { keyPath: 'id' });
  db.createObjectStore('pdfs'); db.createObjectStore('annotations');
} });
export const getScores = async (): Promise<Score[]> => (await database).getAll('scores');
export const saveScore = async (score: Score, pdf?: Blob) => {
  const db = await database;
  const tx = db.transaction(['scores', 'pdfs'], 'readwrite');
  await tx.objectStore('scores').put(score);
  if (pdf) await tx.objectStore('pdfs').put(pdf, score.id);
  await tx.done;
};
export const getPdf = async (id: string): Promise<Blob | undefined> => (await database).get('pdfs', id);
export const savePdf = async (id: string, blob: Blob) => (await database).put('pdfs', blob, id);
export const getAnnotations = async (id: string): Promise<Annotations> => (await database).get('annotations', id).then(value => value ?? {});
export const saveAnnotations = async (id: string, annotations: Annotations) => (await database).put('annotations', annotations, id);
export async function removeScore(id: string) {
  const tx = (await database).transaction(['scores', 'pdfs', 'annotations'], 'readwrite');
  for (const store of ['scores', 'pdfs', 'annotations']) await tx.objectStore(store).delete(id);
  await tx.done;
}
export async function clearExpired(week: string) {
  for (const score of await getScores()) if (isExpiredScore(score, week)) await removeScore(score.id);
}
