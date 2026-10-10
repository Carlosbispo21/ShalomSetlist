export const GROUPS = ['Crianças', 'Adolescentes', 'Jovens', 'Varões', 'Irmãs', 'Grupo de louvor'] as const;
export type Group = typeof GROUPS[number];
export type Day = 'saturday' | 'sunday';
export type ScoreScope = 'weekly' | 'festivity';
export type Score = {
  id: string; title: string; group: Group; day: Day; week: string | null; scope?: ScoreScope;
  bpm: number; pages: number; position: number; filename: string;
  storagePath?: string; roomId?: string; demo?: boolean;
};
export type Room = { id: string; name: string; code: string; ownerId: string; role: 'director' | 'musician' };
export type Point = { x: number; y: number };
export type Stroke = { id: string; color: string; width: number; points: Point[] };
export type TextNote = { id: string; kind: 'text'; text: string; color: string; fontSize: number; position: Point };
// O campo adicional preserva as listas de rabiscos lidas pelas versões antigas.
export type Annotations = Record<number, Stroke[]> & { texts?: Record<number, TextNote[]> };
const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
export function localDate(now = new Date()) {
  const parts = dateFormatter.formatToParts(now);
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}-${parts.find(p => p.type === 'day')!.value}`;
}
export function weekKey(now = new Date()) {
  const date = new Date(`${localDate(now)}T12:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}
export function weekendDate(week: string, day: Day) {
  const date = new Date(`${week}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + (day === 'saturday' ? 5 : 6));
  return date;
}
export function formatDate(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('pt-BR', { ...options, timeZone: 'America/Sao_Paulo' }).format(date);
}
export function validBpm(value: number) { return Math.max(30, Math.min(240, Math.round(value) || 80)); }
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export function sortScores(scores: Score[]) { return [...scores].sort((a, b) => a.position - b.position || a.title.localeCompare(b.title, 'pt-BR')); }
export const isFestivity = (score: Score) => score.scope === 'festivity';
export const isActiveScore = (score: Score, week: string) => isFestivity(score) || score.week === week;
export const isExpiredScore = (score: Score, week: string) => !isFestivity(score) && score.week !== null && score.week < week;
export function scoreFolder(score: Score) {
  if (isFestivity(score)) return 'festivity';
  if (!score.week) throw new Error('Informe a semana do repertório.');
  return score.week;
}
