import { useEffect, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { Point, TextNote } from './domain';

function Mark({ note, active, pageWidth, ratio, onEdit, onMove }: {
  note: TextNote; active: boolean; pageWidth: number; ratio: number;
  onEdit: (note: TextNote) => void; onMove: (note: TextNote) => void;
}) {
  const [position, setPosition] = useState<Point | null>(null);
  const drag = useRef<{ client: Point; position: Point; next: Point; moved: boolean } | null>(null);
  const size = note.fontSize * 1000 / pageWidth, lines = note.text.split('\n');
  const width = Math.max(...lines.map(line => [...line].length), 1) * size * .65;
  const shown = position ?? note.position;
  return <g role={active ? 'button' : undefined} tabIndex={active ? 0 : undefined}
    aria-label={active ? `Editar cifra ${note.text}` : undefined} className={`text-note ${active ? 'editable' : ''}`}
    data-note-id={note.id} transform={`translate(${shown.x} ${shown.y})`} style={{ touchAction: active ? 'none' : 'auto' }}
    onKeyDown={event => { if (active && ['Enter', ' '].includes(event.key)) { event.preventDefault(); event.stopPropagation(); onEdit(note); } }}
    onPointerDown={event => {
      if (!active || !event.isPrimary || event.button !== 0) return;
      event.stopPropagation(); event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { client: { x: event.clientX, y: event.clientY }, position: note.position, next: note.position, moved: false };
    }} onPointerMove={event => {
      const start = drag.current; if (!start) return;
      event.stopPropagation();
      const bounds = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
      const dx = event.clientX - start.client.x, dy = event.clientY - start.client.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) start.moved = true;
      start.next = { x: Math.max(0, Math.min(990, start.position.x + dx / bounds.width * 1000)),
        y: Math.max(0, Math.min(ratio * 1000 - size, start.position.y + dy / bounds.height * ratio * 1000)) };
      setPosition(start.next);
    }} onPointerUp={event => {
      if (!drag.current) return;
      event.stopPropagation(); const start = drag.current; drag.current = null; setPosition(null);
      if (start.moved) onMove({ ...note, position: start.next }); else onEdit(note);
    }} onPointerCancel={event => { event.stopPropagation(); drag.current = null; setPosition(null); }}>
    {active && <rect x={-5} y={-5} width={width + 10} height={lines.length * size * 1.25 + 5} rx={3} className="text-note-target" />}
    <text fill={note.color} fontSize={size} fontFamily="Arial, sans-serif" fontWeight="600" dominantBaseline="hanging">
      {lines.map((line, index) => <tspan key={index} x={0} y={index * size * 1.25}>{line}</tspan>)}
    </text>
  </g>;
}

export function TextNotes({ notes, active, ratio, pageWidth, onCreate, onEdit, onMove }: {
  notes: TextNote[]; active: boolean; ratio: number; pageWidth: number;
  onCreate: (position: Point) => void; onEdit: (note: TextNote) => void; onMove: (note: TextNote) => void;
}) {
  const tap = useRef<{ x: number; y: number; time: number } | null>(null);
  return <svg className={`text-layer ${active ? 'writing' : ''}`} viewBox={`0 0 1000 ${1000 * ratio}`}
    aria-label="Cifras da página" onPointerDown={event => {
      if (!active || !event.isPrimary || event.button !== 0) { tap.current = null; return; }
      event.stopPropagation(); tap.current = { x: event.clientX, y: event.clientY, time: performance.now() };
    }} onPointerCancel={() => { tap.current = null; }} onPointerUp={event => {
      const start = tap.current; tap.current = null;
      if (!active || !start) return;
      event.stopPropagation();
      if (Math.abs(start.x - event.clientX) > 8 || Math.abs(start.y - event.clientY) > 8 || performance.now() - start.time > 500) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      onCreate({ x: Math.max(0, Math.min(990, (event.clientX - bounds.left) / bounds.width * 1000)),
        y: Math.max(0, Math.min(ratio * 1000 - 20, (event.clientY - bounds.top) / bounds.height * ratio * 1000)) });
    }}>
    {notes.map(note => <Mark key={note.id} note={note} active={active} pageWidth={pageWidth} ratio={ratio} onEdit={onEdit} onMove={onMove} />)}
  </svg>;
}

export function NoteEditor({ note, isNew, onSave, onDelete, onCancel }: {
  note: TextNote; isNew: boolean; onSave: (note: TextNote) => void; onDelete: () => void; onCancel: () => void;
}) {
  const [text, setText] = useState(note.text), [size, setSize] = useState(String(note.fontSize)), [color, setColor] = useState(note.color);
  const input = useRef<HTMLTextAreaElement>(null), panel = useRef<HTMLFormElement>(null);
  const valid = text.trim().length > 0 && Number.isFinite(Number(size)) && Number(size) > 0 && Number(size) <= 1000;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => previous?.focus();
  }, []);
  return <div className="note-editor-backdrop" onPointerDown={event => event.stopPropagation()}>
    <form className="note-editor" role="dialog" aria-modal="true" aria-labelledby="note-editor-title" ref={panel}
      onSubmit={event => { event.preventDefault(); if (valid) onSave({ ...note, text: text.trim(), fontSize: Number(size), color }); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancel(); }
        if (event.key === 'Tab') {
          const controls = panel.current!.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, input');
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }}>
      <div className="note-editor-heading"><h2 id="note-editor-title">{isNew ? 'Adicionar cifra' : 'Editar cifra'}</h2><button type="button" className="icon-button" aria-label="Cancelar edição da cifra" onClick={onCancel}><X size={20} /></button></div>
      <label>Cifra ou nota<textarea ref={input} aria-label="Texto da cifra" rows={2} maxLength={200} value={text} onChange={event => setText(event.target.value)} placeholder="Dó, Fá♯, Am, C/G…" /></label>
      <div className="note-editor-options"><label>Tamanho da fonte<input aria-label="Tamanho da fonte" type="number" inputMode="decimal" min="1" max="1000" step="any" value={size} onChange={event => setSize(event.target.value)} /><small>Em pontos · aceita valores personalizados</small></label><label>Cor<input type="color" aria-label="Cor da cifra" value={color} onChange={event => setColor(event.target.value)} /></label></div>
      <p>Para reposicionar, arraste a cifra com a ferramenta Cifras ativada.</p>
      <div className="note-editor-actions">{!isNew && <button className="button ghost" type="button" onClick={onDelete}><Trash2 size={16} />Excluir cifra</button>}<button className="button ghost" type="button" onClick={onCancel}>Cancelar</button><button className="button primary" type="submit" disabled={!valid}>Salvar cifra</button></div>
    </form>
  </div>;
}
