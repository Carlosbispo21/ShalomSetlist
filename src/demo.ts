import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { saveScore } from './db';
import { weekKey, type Score, type Group } from './domain';
export async function makeDemoPdf(title: string) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (let n = 1; n <= 2; n++) {
    const page = pdf.addPage([595, 842]);
    page.drawText('SHALOM', { x: 46, y: 790, size: 12, font: bold, color: rgb(.32, .4, .86) });
    page.drawText(title, { x: 46, y: 752, size: 26, font: bold });
    page.drawText('Partitura ilustrativa para testar o leitor', { x: 46, y: 725, size: 11, font });
    page.drawText('Andante   q = 80     4/4', { x: 46, y: 694, size: 11, font });
    for (let staff = 0; staff < 6; staff++) {
      const top = 650 - staff * 89;
      for (let line = 0; line < 5; line++) page.drawLine({ start: { x: 46, y: top - line * 8 }, end: { x: 549, y: top - line * 8 }, thickness: .7 });
      for (let bar = 0; bar < 4; bar++) {
        page.drawLine({ start: { x: 46 + bar * 126, y: top }, end: { x: 46 + bar * 126, y: top - 32 }, thickness: .8 });
        for (let note = 0; note < 4; note++) {
          const x = 64 + bar * 126 + note * 25, y = top - ((note + staff + n) % 7) * 4;
          page.drawEllipse({ x, y, xScale: 4.5, yScale: 3.5 });
          page.drawLine({ start: { x: x + 4, y }, end: { x: x + 4, y: y + 26 }, thickness: 1 });
        }
      }
      page.drawLine({ start: { x: 549, y: top }, end: { x: 549, y: top - 32 }, thickness: 1 });
    }
    page.drawText(`Exemplo ficticio, sem repertorio oficial da igreja.      ${n} / 2`, { x: 46, y: 48, size: 9, font, color: rgb(.5, .5, .5) });
  }
  return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' });
}
export async function loadDemo() {
  const names: [string, Group, Score['day']][] = [
    ['Exemplo 01', 'Grupo de louvor', 'saturday'],
    ['Exemplo 02', 'Crianças', 'saturday'],
    ['Exemplo 03', 'Jovens', 'sunday']
  ];
  for (const [position, [title, group, day]] of names.entries()) {
    const score: Score = { id: `demo-${position}`, title, group, day, week: weekKey(), bpm: 80 + position * 8, pages: 2, position, filename: `${title}.pdf`, demo: true };
    await saveScore(score, await makeDemoPdf(title));
  }
}
