import { useCallback, useEffect, useRef, useState } from 'react';
import type * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {openPdf,pdfDeadline} from './pdfEngine';
import { useInk } from './useInk';
import { renderPage } from './pageRaster';
import { ArrowLeft, ChevronLeft, ChevronRight, Columns2, Rows3, PenLine, Undo2, Eraser, Minus, Plus, Play, Pause, X, SlidersHorizontal, LoaderCircle, Check, Maximize, Type } from 'lucide-react';
import { getAnnotations, saveAnnotations } from './db';
import { downloadPdf } from './sync';
import { validBpm, isFestivity, type Annotations, type Score, type Stroke, type TextNote, type Point } from './domain';
import { nativeAndroid } from './native';
import { TextNotes, NoteEditor } from './TextNotes';
import { Share2 } from 'lucide-react';
import { pdfFilename, sharePdf, shareCancelled } from './sharing';

function PdfPage({ pdf, number, strokes, onChange, onReady, pen, color, penWidth, zoom, notes, textTool, onCreateNote, onEditNote, onMoveNote }: {
  pdf: pdfjs.PDFDocumentProxy; number: number; strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void; pen: boolean; color: string; penWidth: number; zoom: number;
  onReady:(number:number)=>void;
  notes: TextNote[]; textTool: boolean; onCreateNote: (position: Point) => void;
  onEditNote: (note: TextNote) => void; onMoveNote: (note: TextNote) => void;
}) {
  const wrapper = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(1.414), [visible, setVisible] = useState(false), [ready, setReady] = useState(false);
  const [renderedNumber, setRenderedNumber] = useState(0);
  const [pageError,setPageError]=useState(''),[retry,setRetry]=useState(0);
  const ink=useInk({active:pen && renderedNumber===number,ratio,color,width:penWidth,strokes,onChange});
  const [originalWidth, setOriginalWidth] = useState(612);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); }, { rootMargin: '500px' });
    if (wrapper.current) observer.observe(wrapper.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let disposed=false, request=0;
    const render=async()=>{
      const id=++request;
      setPageError('');
      try {
        const width=wrapper.current!.clientWidth;
        const raster=await renderPage(pdf,number,width);
        if(disposed || id!==request || !canvas.current)return;
        const output=canvas.current;
        output.width=raster.canvas.width;output.height=raster.canvas.height;
        output.getContext('2d')!.drawImage(raster.canvas,0,0);
        setOriginalWidth(raster.width);setRatio(raster.ratio);setReady(true);setRenderedNumber(number);
        onReady(number);
        if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)output.animate?.([{opacity:.85,transform:'translateX(8px)'},{opacity:1,transform:'translateX(0)'}],{duration:150,easing:'ease-out'});
        if(number<pdf.numPages)void renderPage(pdf,number+1,width).catch(()=>{});
        if(number>1)void renderPage(pdf,number-1,width).catch(()=>{});
      }catch(error){if(!disposed&&id===request){setRenderedNumber(0);setPageError(error instanceof Error?error.message:'Não foi possível preparar esta página.');}}
    };
    const observer=new ResizeObserver(()=>void render());
    if(wrapper.current)observer.observe(wrapper.current);
    void render();
    return()=>{disposed=true;observer.disconnect();};
  },[pdf,number,visible,zoom,retry]);
  return <div ref={wrapper} className="pdf-page" style={{ aspectRatio: `1 / ${ratio}` }} data-page={number}>
    {pageError ? <div className="page-loading page-load-error" role="alert"><span>{pageError}</span><button className="button primary" onClick={()=>setRetry(value=>value+1)}>Tentar novamente</button></div> : !ready && <div className="page-loading"><LoaderCircle className="spin" /><span>Preparando página {number}</span></div>}
    <canvas ref={canvas} aria-label={`Partitura, página ${renderedNumber || number}`} />
    <svg ref={ink.layer} className={`ink-layer ${pen ? 'drawing' : ''}`} viewBox={`0 0 1000 ${1000 * ratio}`} style={{ touchAction: pen ? 'none' : 'auto' }} {...ink.handlers}>
      {[...strokes, ...(ink.draft ? [ink.draft] : [])].map(stroke => <polyline key={stroke.id} points={stroke.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />)}
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
  const [loadAttempt,setLoadAttempt]=useState(0);
  const [readyPages,setReadyPages]=useState<Set<number>>(new Set());
  const markReady=useCallback((number:number)=>setReadyPages(previous=>previous.has(number)?previous:new Set(previous).add(number)),[]);
  const [sharedFile, setSharedFile] = useState<File | null>(null), [sharing, setSharing] = useState(false);
  async function share() {
    if (!sharedFile || sharing) return;
    setSharing(true);
    try { if (await sharePdf(sharedFile) === 'downloaded') notify('PDF baixado. Compartilhe o arquivo pela pasta de downloads.'); }
    catch (error) { if (!shareCancelled(error)) notify('Não foi possível compartilhar o PDF. Tente novamente.'); }
    finally { setSharing(false); }
  }
  const [mode, setMode] = useState<'pages' | 'cascade'>(() => localStorage.getItem('shalom-reader-mode') === 'cascade' ? 'cascade' : 'pages');
  const [page, setPage] = useState(initialPage), [pen, setPen] = useState(false), [color, setColor] = useState('#5367de');
  const [penWidth,setPenWidth]=useState(2.5);
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
    let disposed = false; let closePdf:(()=>Promise<void>)|undefined;
    const load = async () => {
      setError('');setPdf(null);setSharedFile(null);setReadyPages(new Set());
      try {
        const [blob, ink] = await pdfDeadline(Promise.all([downloadPdf(score), getAnnotations(score.id)]),30000,'O PDF demorou para baixar. Confira a conexão e tente novamente.');
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if(disposed)return;
        const session=await openPdf(bytes),loaded=session.document;
        closePdf=session.dispose;
        if (disposed) { await closePdf(); return; }
        setSharedFile(new File([blob],pdfFilename(score.filename || score.title),{type:'application/pdf'}));
        inkRef.current = ink; setAnnotations(ink); setPage(Math.min(initialPage, loaded.numPages)); setPdf(loaded);
      } catch(error) { if (!disposed) setError(error instanceof Error?error.message:'Não foi possível abrir o PDF. Tente novamente.'); }
    };
    void load();
    let wake: { release: () => Promise<void> } | undefined;
    const keepAwake = async () => { try { if ('wakeLock' in navigator) wake = await navigator.wakeLock.request('screen'); } catch { /* unsupported devices can still read */ } };
    void keepAwake();
    const visibility = () => { if (documentVisibility()) void keepAwake(); };
    function documentVisibility() { return window.document.visibilityState === 'visible'; }
    window.document.addEventListener('visibilitychange', visibility);
    return () => { disposed = true; void closePdf?.().catch(()=>{}); void wake?.release(); window.document.removeEventListener('visibilitychange', visibility); };
  }, [score.id,loadAttempt]);
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
      else if (!pen && !textTool && ['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].includes(event.key)) {
        event.preventDefault(); void navigate(['ArrowRight','PageDown'].includes(event.key) ? 1 : -1);
      }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });
  const touchState=useRef({pen,textTool,mode,zoom,navigate,setControls});
  touchState.current={pen,textTool,mode,zoom,navigate,setControls};
  useEffect(()=>{
    const element=scroll.current!;
    let start:{x:number;y:number;time:number;scrollX:number;scrollY:number;id:number}|null=null;
    const down=(event:TouchEvent)=>{
      if(touchState.current.pen||touchState.current.textTool||event.touches.length!==1){start=null;return;}
      const finger=event.touches[0];start={x:finger.clientX,y:finger.clientY,time:performance.now(),scrollX:element.scrollLeft,scrollY:element.scrollTop,id:finger.identifier};
    };
    const move=(event:TouchEvent)=>{
      if(!start)return;if(event.touches.length!==1){start=null;return;}
      const finger=event.touches[0],dx=finger.clientX-start.x,dy=finger.clientY-start.y;
      if(touchState.current.mode==='pages'&&touchState.current.zoom<=100&&Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.4)event.preventDefault();
    };
    const up=(event:TouchEvent)=>{
      const initial=start;start=null;const state=touchState.current;
      if(!initial||state.pen||state.textTool)return;
      let finger:Touch|undefined;for(let i=0;i<event.changedTouches.length;i++)if(event.changedTouches[i].identifier===initial.id)finger=event.changedTouches[i];
      if(!finger)return;const dx=finger.clientX-initial.x,dy=finger.clientY-initial.y;
      if(Math.abs(element.scrollLeft-initial.scrollX)>5||Math.abs(element.scrollTop-initial.scrollY)>5)return;
      if(state.mode==='pages'&&state.zoom<=100&&Math.abs(dx)>70&&Math.abs(dy)<65){event.preventDefault();void state.navigate(dx<0?1:-1);return;}
      if(Math.abs(dx)>10||Math.abs(dy)>10||performance.now()-initial.time>500)return;
      const bounds=element.getBoundingClientRect(),fraction=(finger.clientX-bounds.left)/bounds.width;
      if((state.mode==='cascade'||state.zoom<=100)&&fraction<.25)void state.navigate(-1);
      else if((state.mode==='cascade'||state.zoom<=100)&&fraction>.75)void state.navigate(1);
      else state.setControls(value=>!value);
    };
    const cancel=()=>{start=null;};
    element.addEventListener('touchstart',down,{passive:true});element.addEventListener('touchmove',move,{passive:false});element.addEventListener('touchend',up,{passive:false});element.addEventListener('touchcancel',cancel);
    return()=>{element.removeEventListener('touchstart',down);element.removeEventListener('touchmove',move);element.removeEventListener('touchend',up);element.removeEventListener('touchcancel',cancel);};
  },[]);
  const pageWidth = (mode === 'pages' ? Math.min(dimensions.width, dimensions.height / ratio) : dimensions.width) * zoom / 100;
  return <div className={`reader immersive ${controls ? '' : 'controls-hidden'}`}>
    <header className="reader-header"><button className="icon-button back" aria-label="Voltar ao repertório" onClick={() => void close()}><ArrowLeft /></button><div className="reader-title"><h1>{score.title}</h1><p>{score.group}{isFestivity(score) ? ' · Festividade' : ''}{score.demo ? ' · Exemplo' : ''}</p></div><span className="reader-offline"><Check size={14} />{pdf ? 'No aparelho' : 'Carregando'}</span><button className="icon-button" aria-label="Compartilhar PDF" title="Compartilhar PDF original, sem anotações" disabled={!sharedFile || sharing} onClick={() => void share()}>{sharing ? <LoaderCircle className="spin" size={19} /> : <Share2 size={19} />}</button>{!nativeAndroid && document.fullscreenEnabled && <button className="icon-button" aria-label="Alternar tela cheia" onClick={() => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => notify('Tela cheia indisponível neste navegador.'))}><Maximize size={19} /></button>}<button className={`icon-button ${metro ? 'selected' : ''}`} aria-label="Abrir metrônomo" onClick={() => setMetro(!metro)}><SlidersHorizontal /></button></header>
    <div className="reader-tools">
      <div className="segmented"><button className={mode === 'pages' ? 'active' : ''} onClick={() => setMode('pages')}><Columns2 size={16} />Por página</button><button className={mode === 'cascade' ? 'active' : ''} onClick={() => setMode('cascade')}><Rows3 size={16} />Contínua</button></div>
      <div className="pen-tools"><button disabled={!pdf||!readyPages.has(page)} className={`button small ${pen ? 'primary' : 'ghost'}`} onClick={() => { setPen(!pen); setTextTool(false); }} aria-pressed={pen}><PenLine size={16} />Caneta</button>{pen && <>
        <label className="pen-width">Traço<select aria-label="Espessura da caneta" value={penWidth} onChange={event=>setPenWidth(Number(event.target.value))}><option value={1.5}>Fino</option><option value={2.5}>Médio</option><option value={4}>Grosso</option></select></label><div className="pen-colors">{['#5367de', '#e36959', '#263247'].map(c => <button key={c} aria-label={`Cor ${c}`} style={{ background: c }} className={color === c ? 'active' : ''} onClick={() => setColor(c)} />)}</div>
        <button className="icon-button" aria-label="Desfazer último traço" disabled={!annotations[page]?.length} onClick={() => updateInk(page, annotations[page].slice(0, -1))}><Undo2 size={17} /></button>
        <button className="icon-button" aria-label="Apagar rabiscos desta página" disabled={!annotations[page]?.length} onClick={() => updateInk(page, [])}><Eraser size={17} /></button>
      </>}</div>
      <button className={`button small text-tool ${textTool ? 'primary' : 'ghost'}`} aria-pressed={textTool} onClick={() => { setTextTool(!textTool); setPen(false); }}><Type size={16} />Cifras</button>
      <div className="zoom-tools"><button className="icon-button" aria-label="Diminuir zoom" disabled={zoom <= 75} onClick={() => setZoom(Math.max(75, zoom - 25))}><Minus size={16} /></button><span>{zoom}%</span><button className="icon-button" aria-label="Aumentar zoom" disabled={zoom >= 200} onClick={() => setZoom(Math.min(200, zoom + 25))}><Plus size={16} /></button></div>
      {textTool && <p className="text-mode-hint">Toque na folha para inserir. Arraste uma cifra para mover ou toque nela para editar.</p>}
    </div>
    {metro && <Metronome bpm={bpm} onBpm={setBpm} onClose={() => setMetro(false)} />}
    <div className={`reader-scroll ${mode}`} style={{ touchAction: pen ? 'none' : mode === 'pages' && zoom <= 100 ? 'pan-y' : 'auto' }} ref={scroll} onPointerDown={e => {
      if ((('ontouchstart' in window || navigator.maxTouchPoints>0) && e.pointerType !== 'mouse')) return;
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
      {error ? <div className="reader-error"><h2>Não foi possível abrir a partitura</h2><p>{error}</p><button className="button primary" onClick={()=>setLoadAttempt(value=>value+1)}>Tentar abrir novamente</button><button className="button ghost" onClick={() => void close()}>Voltar ao repertório</button></div> : !pdf ? <div className="reader-error"><LoaderCircle className="spin" /><p>Abrindo partitura…</p></div> : <div className="pages-container" style={{ width: Math.max(dimensions.width, pageWidth) }}>{(mode === 'pages' ? [page] : Array.from({ length: count }, (_, i) => i + 1)).map(number => <section key={mode === 'pages' ? 'paged-sheet' : number} style={{ width: pageWidth, maxWidth: 'none' }}>
        <PdfPage pdf={pdf} number={number} pen={pen} color={color} penWidth={penWidth} zoom={zoom} strokes={annotations[number] ?? []} onReady={markReady} onChange={strokes => updateInk(number, strokes)}
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
