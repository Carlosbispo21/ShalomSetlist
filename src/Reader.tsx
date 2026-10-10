import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { ArrowLeft, ChevronLeft, ChevronRight, Columns2, Rows3, PenLine, Undo2, Eraser, Minus, Plus, Play, Pause, X, SlidersHorizontal, LoaderCircle, Check, Maximize, Type } from 'lucide-react';
import { getAnnotations, saveAnnotations } from './db';
import { downloadPdf } from './sync';
import { validBpm, isFestivity, type Annotations, type Score, type Stroke, type TextNote, type Point } from './domain';
import { nativeAndroid } from './native';
import { TextNotes, NoteEditor } from './TextNotes';
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

function PdfPage({ pdf, number, strokes, onChange, pen, color, zoom, notes, textTool, onCreateNote, onEditNote, onMoveNote }: {
  pdf: pdfjs.PDFDocumentProxy; number: number; strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void; pen: boolean; color: string; zoom: number;
  notes: TextNote[]; textTool: boolean; onCreateNote: (position: Point) => void;
  onEditNote: (note: TextNote) => void; onMoveNote: (note: TextNote) => void;
}) {
  const wrapper = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(1.414), [visible, setVisible] = useState(false), [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const draftRef = useRef<Stroke | null>(null);
  const [originalWidth, setOriginalWidth] = useState(612);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); }, { rootMargin: '500px' });
    if (wrapper.current) observer.observe(wrapper.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let disposed = false, task: pdfjs.RenderTask | undefined;
    let queue = Promise.resolve();
    const render = () => {
      queue = queue.catch(() => {}).then(async () => {
        if (disposed || !canvas.current || !wrapper.current) return;
        const page = await pdf.getPage(number);
        if (disposed) return;
        const original = page.getViewport({ scale: 1 });
        setOriginalWidth(original.width);
        setRatio(original.height / original.width);
        const scale = wrapper.current.clientWidth / original.width;
        const viewport = page.getViewport({ scale: scale * Math.min(devicePixelRatio || 1, 2) });
        const ctx = canvas.current!.getContext('2d')!;
        canvas.current!.width = Math.floor(viewport.width); canvas.current!.height = Math.floor(viewport.height);
        task = page.render({ canvasContext: ctx, viewport });
        try { await task.promise; if (!disposed) setReady(true); } catch (error) {
          if (!(error instanceof Error && error.name === 'RenderingCancelledException')) throw error;
        }
      });
    };
    const observer = new ResizeObserver(render);
    if (wrapper.current) observer.observe(wrapper.current);
    return () => { disposed = true; observer.disconnect(); task?.cancel(); };
  }, [pdf, number, visible, zoom]);
  function point(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1000, (event.clientX - rect.left) / rect.width * 1000)), y: Math.max(0, Math.min(1000 * ratio, (event.clientY - rect.top) / rect.height * 1000 * ratio)) };
  }
  function finish() {
    if (!draftRef.current) return;
    const stroke = draftRef.current;
    if (stroke.points.length === 1) stroke.points.push({ x: stroke.points[0].x + .1, y: stroke.points[0].y + .1 });
    onChange([...strokes, stroke]); draftRef.current = null; setDraft(null);
  }
  return <div ref={wrapper} className="pdf-page" style={{ aspectRatio: `1 / ${ratio}` }} data-page={number}>
    {!ready && <div className="page-loading"><LoaderCircle className="spin" /><span>Preparando página {number}</span></div>}
    <canvas ref={canvas} aria-label={`Partitura, página ${number}`} />
    <svg className={`ink-layer ${pen ? 'drawing' : ''}`} viewBox={`0 0 1000 ${1000 * ratio}`} style={{ touchAction: pen ? 'none' : 'auto' }}
      onPointerDown={event => {
        if (!pen || event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const stroke = { id: crypto.randomUUID(), color, width: 2.5, points: [point(event)] };
        draftRef.current = stroke; setDraft(stroke);
      }} onPointerMove={event => {
        if (!draftRef.current) return;
        const next = { ...draftRef.current, points: [...draftRef.current.points, point(event)] };
        draftRef.current = next; setDraft(next);
      }} onPointerUp={finish} onPointerCancel={() => { draftRef.current = null; setDraft(null); }}>
      {[...strokes, ...(draft ? [draft] : [])].map(stroke => <polyline key={stroke.id} points={stroke.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
    <TextNotes notes={notes} active={textTool && ready} ratio={ratio} pageWidth={originalWidth}
      onCreate={onCreateNote} onEdit={onEditNote} onMove={onMoveNote} />
  </div>;
}

function Metronome({ bpm, onBpm, onClose }: { bpm: number; onBpm: (bpm: number) => void; onClose: () => void }) {
  const [running, setRunning] = useState(false), [beat, setBeat] = useState(false), [count, setCount] = useState(1);
  const [bpmDraft, setBpmDraft] = useState(String(bpm));
  useEffect(() => { setBpmDraft(String(bpm)); }, [bpm]);
  useEffect(() => {
    if (!running) { setBeat(false); return; }
    let frame: number; const start = performance.now(), period = 60000 / bpm;
    const tick = (time: number) => {
      const elapsed = time - start;
      setBeat(elapsed % period < Math.min(100, period * .22));
      setCount(Math.floor(elapsed / period) % 4 + 1);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [running, bpm]);
  return <div className="metronome">
    <div className="metro-top"><span className={`beat-dot ${beat ? 'lit' : ''}`} data-testid="beat-dot" /><span>Metrônomo</span><button className="icon-button" aria-label="Fechar metrônomo" onClick={onClose}><X size={16} /></button></div>
    <div className="metro-value"><button className="icon-button" aria-label="Diminuir BPM" onClick={() => onBpm(validBpm(bpm - 1))}><Minus size={17} /></button><label><input aria-label="Batidas por minuto" type="number" min="30" max="240" value={bpmDraft} onChange={e => { setBpmDraft(e.target.value); const next = Number(e.target.value); if (next >= 30 && next <= 240) onBpm(validBpm(next)); }} onBlur={() => { const next = validBpm(Number(bpmDraft)); onBpm(next); setBpmDraft(String(next)); }} /><span>BPM</span></label><button className="icon-button" aria-label="Aumentar BPM" onClick={() => onBpm(validBpm(bpm + 1))}><Plus size={17} /></button></div>
    <input aria-label="Velocidade do metrônomo" type="range" min="30" max="240" value={bpm} onChange={e => onBpm(Number(e.target.value))} />
    <div className="metro-bottom"><span className="beats">{[1,2,3,4].map(n => <i key={n} className={running && n === count ? 'current' : ''} />)}</span><button className="button small primary" onClick={() => setRunning(!running)}>{running ? <Pause size={14} /> : <Play size={14} />}{running ? 'Pausar' : 'Iniciar'}</button></div>
  </div>;
}

export default function Reader({ score, initialPage = 1, onClose, onSong, previous, next, notify }: {
  score: Score; initialPage?: number; onClose: () => void;
  onSong: (score: Score, lastPage: boolean) => void; previous?: Score; next?: Score;
  notify: (message: string) => void;
}) {
  const [pdf, setPdf] = useState<pdfjs.PDFDocumentProxy | null>(null), [error, setError] = useState('');
  const [mode, setMode] = useState<'pages' | 'cascade'>(() => localStorage.getItem('shalom-reader-mode') === 'cascade' ? 'cascade' : 'pages');
  const [page, setPage] = useState(initialPage), [pen, setPen] = useState(false), [color, setColor] = useState('#5367de');
  const [textTool, setTextTool] = useState(false), [editing, setEditing] = useState<{ number: number; note: TextNote; isNew: boolean } | null>(null);
  const [noteSize, setNoteSize] = useState(16), [noteColor, setNoteColor] = useState('#20282a');
  const [controls, setControls] = useState(true), [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight }), [ratio, setRatio] = useState(1.414);
  const [annotations, setAnnotations] = useState<Annotations>({}), [zoom, setZoom] = useState(100), [metro, setMetro] = useState(false), [bpm, setBpm] = useState(score.bpm);
  const inkRef = useRef<Annotations>({}), saveQueue = useRef(Promise.resolve()), dirty = useRef(false);
  const swipe = useRef<{ x: number; y: number; time: number; scrollX: number; scrollY: number; id: number } | null>(null), scroll = useRef<HTMLDivElement>(null);
  const changing = useRef(false);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height }));
    if (scroll.current) observer.observe(scroll.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let disposed = false;
    if (pdf) void pdf.getPage(page).then(p => { if (!disposed) { const viewport = p.getViewport({ scale: 1 }); setRatio(viewport.height / viewport.width); } });
    return () => { disposed = true; };
  }, [pdf, page]);
  useEffect(() => {
    let disposed = false; let document: pdfjs.PDFDocumentProxy | undefined;
    const load = async () => {
      try {
        const [blob, ink] = await Promise.all([downloadPdf(score), getAnnotations(score.id)]);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const loaded = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
        document = loaded;
        if (disposed) { await loaded.destroy(); return; }
        inkRef.current = ink; setAnnotations(ink); setPage(Math.min(initialPage, loaded.numPages)); setPdf(loaded);
      } catch { if (!disposed) setError('Não foi possível abrir o PDF. Conecte-se à internet e tente novamente.'); }
    };
    void load();
    let wake: { release: () => Promise<void> } | undefined;
    const keepAwake = async () => { try { if ('wakeLock' in navigator) wake = await navigator.wakeLock.request('screen'); } catch { /* unsupported devices can still read */ } };
    void keepAwake();
    const visibility = () => { if (documentVisibility()) void keepAwake(); };
    function documentVisibility() { return window.document.visibilityState === 'visible'; }
    window.document.addEventListener('visibilitychange', visibility);
    return () => { disposed = true; void document?.destroy(); void wake?.release(); window.document.removeEventListener('visibilitychange', visibility); };
  }, [score.id]);
  useEffect(() => { localStorage.setItem('shalom-reader-mode', mode); }, [mode]);
  function updateInk(number: number, strokes: Stroke[]) {
    const next = { ...inkRef.current, [number]: strokes };
    persistAnnotations(next);
  }
  function persistAnnotations(next: Annotations) {
    inkRef.current = next; setAnnotations(next); dirty.current = true;
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => saveAnnotations(score.id, next)).then(() => { dirty.current = false; }).catch(() => { notify('Não foi possível salvar as anotações. Verifique o espaço do aparelho.'); dirty.current = true; });
  }
  function updateNote(number: number, note: TextNote) {
    const existing = inkRef.current.texts?.[number] ?? [];
    persistAnnotations({ ...inkRef.current, texts: { ...inkRef.current.texts, [number]: existing.some(item => item.id === note.id)
      ? existing.map(item => item.id === note.id ? note : item) : [...existing, note] } });
  }
  function deleteNote(number: number, id: string) {
    persistAnnotations({ ...inkRef.current, texts: { ...inkRef.current.texts,
      [number]: (inkRef.current.texts?.[number] ?? []).filter(note => note.id !== id) } });
  }
  async function close() {
    if (editing) { setEditing(null); return; }
    await saveQueue.current;
    if (dirty.current) { notify('As últimas anotações ainda não foram salvas. Tente novamente antes de sair.'); return; }
    onClose();
  }
  useEffect(() => {
    const back = () => { void close(); };
    window.addEventListener('shalom-reader-back', back);
    return () => window.removeEventListener('shalom-reader-back', back);
  });
  const count = pdf?.numPages ?? score.pages;
  async function navigate(direction: -1 | 1) {
    if (!pdf || editing || changing.current) return;
    const target = page + direction;
    if (mode === 'pages' && target >= 1 && target <= count) { setPage(target); scroll.current?.scrollTo(0, 0); return; }
    const song = direction === 1 ? next : previous;
    if (!song) { if (direction === 1) notify(isFestivity(score) ? 'Fim das partituras desta festividade.' : 'Fim dos hinos deste dia.'); return; }
    changing.current = true;
    await saveQueue.current;
    if (dirty.current) { changing.current = false; notify('Salve as anotações antes de trocar de hino.'); return; }
    onSong(song, mode === 'pages' && direction === -1);
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (editing || (event.target as HTMLElement).matches('input, select, textarea')) return;
      if (event.key === 'Escape') { event.preventDefault(); void close(); }
      else if (!pen && !textTool && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault(); void navigate(event.key === 'ArrowRight' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });
  const pageWidth = (mode === 'pages' ? Math.min(dimensions.width, dimensions.height / ratio) : dimensions.width) * zoom / 100;
  return <div className={`reader immersive ${controls ? '' : 'controls-hidden'}`}>
    <header className="reader-header"><button className="icon-button back" aria-label="Voltar ao repertório" onClick={() => void close()}><ArrowLeft /></button><div className="reader-title"><h1>{score.title}</h1><p>{score.group}{isFestivity(score) ? ' · Festividade' : ''}{score.demo ? ' · Exemplo' : ''}</p></div><span className="reader-offline"><Check size={14} />{pdf ? 'No aparelho' : 'Carregando'}</span>{!nativeAndroid && document.fullscreenEnabled && <button className="icon-button" aria-label="Alternar tela cheia" onClick={() => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => notify('Tela cheia indisponível neste navegador.'))}><Maximize size={19} /></button>}<button className={`icon-button ${metro ? 'selected' : ''}`} aria-label="Abrir metrônomo" onClick={() => setMetro(!metro)}><SlidersHorizontal /></button></header>
    <div className="reader-tools">
      <div className="segmented"><button className={mode === 'pages' ? 'active' : ''} onClick={() => setMode('pages')}><Columns2 size={16} />Por página</button><button className={mode === 'cascade' ? 'active' : ''} onClick={() => setMode('cascade')}><Rows3 size={16} />Contínua</button></div>
      <div className="pen-tools"><button className={`button small ${pen ? 'primary' : 'ghost'}`} onClick={() => { setPen(!pen); setTextTool(false); }} aria-pressed={pen}><PenLine size={16} />Caneta</button>{pen && <>
        <div className="pen-colors">{['#5367de', '#e36959', '#263247'].map(c => <button key={c} aria-label={`Cor ${c}`} style={{ background: c }} className={color === c ? 'active' : ''} onClick={() => setColor(c)} />)}</div>
        <button className="icon-button" aria-label="Desfazer último traço" disabled={!annotations[page]?.length} onClick={() => updateInk(page, annotations[page].slice(0, -1))}><Undo2 size={17} /></button>
        <button className="icon-button" aria-label="Apagar rabiscos desta página" disabled={!annotations[page]?.length} onClick={() => updateInk(page, [])}><Eraser size={17} /></button>
      </>}</div>
      <button className={`button small text-tool ${textTool ? 'primary' : 'ghost'}`} aria-pressed={textTool} onClick={() => { setTextTool(!textTool); setPen(false); }}><Type size={16} />Cifras</button>
      <div className="zoom-tools"><button className="icon-button" aria-label="Diminuir zoom" disabled={zoom <= 75} onClick={() => setZoom(Math.max(75, zoom - 25))}><Minus size={16} /></button><span>{zoom}%</span><button className="icon-button" aria-label="Aumentar zoom" disabled={zoom >= 200} onClick={() => setZoom(Math.min(200, zoom + 25))}><Plus size={16} /></button></div>
      {textTool && <p className="text-mode-hint">Toque na folha para inserir. Arraste uma cifra para mover ou toque nela para editar.</p>}
    </div>
    {metro && <Metronome bpm={bpm} onBpm={setBpm} onClose={() => setMetro(false)} />}
    <div className={`reader-scroll ${mode}`} style={{ touchAction: mode === 'pages' && zoom <= 100 ? 'pan-y' : 'auto' }} ref={scroll} onPointerDown={e => {
      if (e.isPrimary && e.button === 0 && !pen && !textTool) swipe.current = { x: e.clientX, y: e.clientY, time: performance.now(), scrollX: e.currentTarget.scrollLeft, scrollY: e.currentTarget.scrollTop, id: e.pointerId };
      else swipe.current = null;
    }} onPointerCancel={() => { swipe.current = null; }} onPointerUp={e => {
      const start = swipe.current; swipe.current = null;
      if (!start || start.id !== e.pointerId || pen || textTool) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (Math.abs(start.scrollX - e.currentTarget.scrollLeft) > 5 || Math.abs(start.scrollY - e.currentTarget.scrollTop) > 5) return;
      if (mode === 'pages' && zoom <= 100 && Math.abs(dx) > 80 && Math.abs(dy) < 65) { void navigate(dx < 0 ? 1 : -1); return; }
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10 || performance.now() - start.time > 500) return;
      const bounds = e.currentTarget.getBoundingClientRect(), fraction = (e.clientX - bounds.left) / bounds.width;
      if ((mode === 'cascade' || zoom <= 100) && fraction < .25) void navigate(-1);
      else if ((mode === 'cascade' || zoom <= 100) && fraction > .75) void navigate(1);
      else setControls(value => !value);
    }} onScroll={() => {
      if (mode !== 'cascade' || !scroll.current) return;
      const containerTop = scroll.current.getBoundingClientRect().top;
      const pages = scroll.current.querySelectorAll<HTMLElement>('[data-page]');
      for (const element of pages) { const bounds = element.getBoundingClientRect(); if (bounds.bottom > containerTop + 100) { setPage(Number(element.dataset.page)); break; } }
    }}>
      {error ? <div className="reader-error"><h2>Não foi possível abrir a partitura</h2><p>{error}</p><button className="button primary" onClick={() => void close()}>Voltar ao repertório</button></div> : !pdf ? <div className="reader-error"><LoaderCircle className="spin" /><p>Abrindo partitura…</p></div> : <div className="pages-container" style={{ width: Math.max(dimensions.width, pageWidth) }}>{(mode === 'pages' ? [page] : Array.from({ length: count }, (_, i) => i + 1)).map(number => <section key={number} style={{ width: pageWidth, maxWidth: 'none' }}>
        <PdfPage pdf={pdf} number={number} pen={pen} color={color} zoom={zoom} strokes={annotations[number] ?? []} onChange={strokes => updateInk(number, strokes)}
          notes={annotations.texts?.[number] ?? []} textTool={textTool}
          onCreateNote={position => setEditing({ number, isNew: true, note: { id: crypto.randomUUID(), kind: 'text', text: '', color: noteColor, fontSize: noteSize, position } })}
          onEditNote={note => setEditing({ number, note, isNew: false })} onMoveNote={note => updateNote(number, note)} />
      </section>)}</div>}
    </div>
    <footer className="reader-footer"><div className="page-navigation"><button className="icon-button" aria-label={mode === 'cascade' ? 'Hino anterior' : 'Página anterior'} disabled={!pdf || ((mode === 'cascade' || page === 1) && !previous)} onClick={() => void navigate(-1)}><ChevronLeft size={20} /></button><span>{page} <i>/ {count}</i></span><button className="icon-button" aria-label={mode === 'cascade' ? 'Próximo hino' : 'Próxima página'} disabled={!pdf} title={mode === 'cascade' || page === count ? next ? `Próximo hino: ${next.title}` : 'Fim dos hinos deste dia' : 'Próxima página'} onClick={() => void navigate(1)}><ChevronRight size={20} /></button></div></footer>
    <button className="reader-controls-toggle" aria-label={controls ? 'Ocultar controles' : 'Mostrar controles'} onClick={() => setControls(!controls)}><SlidersHorizontal size={19} /></button>
    {editing && <NoteEditor key={editing.note.id} note={editing.note} isNew={editing.isNew}
      onCancel={() => setEditing(null)} onDelete={() => { deleteNote(editing.number, editing.note.id); setEditing(null); }}
      onSave={note => { updateNote(editing.number, note); setNoteSize(note.fontSize); setNoteColor(note.color); setEditing(null); }} />}
  </div>;
}
