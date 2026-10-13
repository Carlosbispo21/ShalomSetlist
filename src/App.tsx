import { useCallback, useEffect, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Music2, CalendarDays, BookOpen, Users, Settings2, Plus, Search, ChevronDown, ChevronRight, ArrowUpRight, FileMusic, CloudDownload, Check, WifiOff, X, UploadCloud, Smartphone, Tablet, ShieldCheck, Copy, LogOut, LoaderCircle, RefreshCw, Trash2, Info, Heart, Sparkles, Download, PartyPopper } from 'lucide-react';
import { GROUPS, MAX_PDF_BYTES, formatDate, sortScores, validBpm, weekKey, weekendDate, isActiveScore, isFestivity, type ScoreScope, type Day, type Group, type Room, type Score } from './domain';
import { clearExpired, getPdf, getScores, removeScore, saveScore } from './db';
import { cloud, deleteScore, downloadPdf, getRoom, joinRoom, loginDirector, publishScore, pullScores, ROOM_CACHE_KEY } from './sync';
import { loadDemo } from './demo';
import Reader from './Reader';
import Festivities from './Festivities';
import Directors from './Directors';
import { hasAppUpdate, updateApp, appVersion } from './pwa';
import { nativeAndroid, readerDisplay } from './native';
import { shareInvitation, shareCancelled } from './sharing';
import { importDrivePdfs } from './driveImport';
import { Share2, HardDrive } from 'lucide-react';

type View = 'week' | 'library' | 'festivity' | 'band' | 'settings';
type Modal = 'upload' | 'connect' | null;
const navigation = [ { id: 'week' as View, title: 'Repertório', icon: CalendarDays }, { id: 'festivity' as View, title: 'Festividade', icon: PartyPopper }, { id: 'library' as View, title: 'Partituras', icon: BookOpen }, { id: 'band' as View, title: 'Nossa banda', icon: Users }, { id: 'settings' as View, title: 'Ajustes', icon: Settings2 } ];
const groupClass = (group: Group) => `group-${GROUPS.indexOf(group)}`;

function ModalFrame({ title, description, onClose, children }: React.PropsWithChildren<{ title: string; description: string; onClose: () => void }>) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const elements = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, a[href], [tabindex="0"]');
        if (!elements?.length) return;
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1} ref={panel}><button className="icon-button modal-close" aria-label="Fechar" onClick={onClose}><X /></button><div className="modal-symbol"><Music2 /></div><h2 id="modal-title">{title}</h2><p className="modal-description">{description}</p>{children}</div></div>;
}

function Connect({ onClose, onConnected }: { onClose: () => void; onConnected: (room: Room) => void }) {
  const [tab, setTab] = useState<'musician' | 'director'>('musician'), [signup, setSignup] = useState(false);
  const [code, setCode] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [existingBand, setExistingBand] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { const room = tab === 'musician' ? await joinRoom(code) : await loginDirector(email, password, signup, existingBand ? code : undefined); if (!room) throw new Error('Não foi possível encontrar a banda. Tente novamente.'); onConnected(room); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível conectar.'); }
    finally { setBusy(false); }
  }
  return <ModalFrame title="Conectar à banda" description="Entre pelo código da banda ou com sua conta." onClose={onClose}>
    {!cloud ? <><div className="setup-note"><Info size={22} /><div><strong>A conexão entre aparelhos precisa ser ativada</strong><p>O app já funciona com PDFs neste aparelho. Para distribuir pelo celular, configure o projeto gratuito do Supabase conforme o README.</p></div></div><button className="button primary full" onClick={onClose}>Entendi</button></> : <>
      <div className="segmented wide"><button className={tab === 'musician' ? 'active' : ''} onClick={() => { setTab('musician'); setError(''); }}><Tablet size={16} />Sou músico</button><button className={tab === 'director' ? 'active' : ''} onClick={() => { setTab('director'); setError(''); }}><Smartphone size={16} />Sou responsável</button></div>
      {tab === 'director' && <label className="existing-band"><input type="checkbox" checked={existingBand} onChange={e => setExistingBand(e.target.checked)} />Entrar em uma banda existente</label>}
      {tab === 'director' && existingBand && <label className="band-code-label">Código da banda<input aria-label="Código da banda existente" className="code-input" required minLength={12} maxLength={12} value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} placeholder="A1B2C3D4E5F6" /><small>Após entrar, um responsável deve liberar a permissão de envio para seu e-mail.</small></label>}
      <form onSubmit={submit}>{tab === 'musician' ? <label>Código da banda<input className="code-input" autoComplete="off" placeholder="A1B2C3D4E5F6" value={code} maxLength={12} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} required minLength={12} /><small>Peça o código ao responsável pela banda.</small></label> : <><label>E-mail<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" /></label><label>Senha<input type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} value={password} onChange={e => setPassword(e.target.value)} required placeholder="Pelo menos 8 caracteres" /></label></>}
      {error && <p className="form-error" role="alert">{error}</p>}<button className="button primary full" disabled={busy || (tab === 'director' && existingBand && code.length !== 12)} type="submit">{busy ? <LoaderCircle className="spin" size={18} /> : <ArrowUpRight size={18} />}{tab === 'musician' ? 'Conectar à banda' : signup ? existingBand ? 'Criar conta e entrar' : 'Criar conta e banda' : 'Entrar'}</button></form>
      {tab === 'director' && <button className="text-button full" onClick={() => { setSignup(!signup); setError(''); }}>{signup ? 'Já tenho uma conta' : 'Primeiro acesso? Criar minha conta'}</button>}
    </>}
  </ModalFrame>;
}

function Upload({ room, position, scope = 'weekly', initialGroup = 'Grupo de louvor', onClose, onSaved }: { room: Room | null; position: number; scope?: ScoreScope; initialGroup?: Group; onClose: () => void; onSaved: (group: Group) => void }) {
  const [files, setFiles] = useState<File[]>([]), [title, setTitle] = useState('');
  const [day, setDay] = useState<Day>('saturday'), [group, setGroup] = useState<Group>(initialGroup), [bpm, setBpm] = useState(80);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [progress, setProgress] = useState('');
  function choose(list: FileList | File[] | null) { const chosen = Array.from(list ?? []); setFiles(chosen); setTitle(chosen.length === 1 ? chosen[0].name.replace(/\.pdf$/i, '') : ''); setError(''); }
  async function fromDrive() {
    if (busy) return;
    setBusy(true); setError(''); setProgress('Abrindo arquivos…');
    try { const selected = await importDrivePdfs(); if (selected.length) choose(selected); }
    catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível importar os PDFs. Verifique a conexão com o Drive.'); }
    finally { setBusy(false); setProgress(''); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!files.length || busy) return;
    setBusy(true); setError(''); let completed = 0;
    try {
      // Validate the whole batch before publishing any file.
      const documents = [];
      for (const file of files) {
        if (file.size > MAX_PDF_BYTES) throw new Error(`${file.name}: o limite é de 20 MB por PDF.`);
        if (!file.name.toLowerCase().endsWith('.pdf')) throw new Error('Escolha apenas arquivos PDF.');
        let pdf; try { pdf = await PDFDocument.load(await file.arrayBuffer()); } catch { throw new Error(`${file.name}: PDF inválido ou protegido por senha.`); }
        if (!pdf.getPageCount()) throw new Error(`${file.name}: o PDF está vazio.`);
        documents.push({ file, pages: pdf.getPageCount() });
      }
      for (const [i, { file, pages }] of documents.entries()) {
        setProgress(`Enviando ${i + 1} de ${files.length}…`);
        const score: Score = { id: crypto.randomUUID(), title: (files.length === 1 ? title.trim() : file.name.replace(/\.pdf$/i, '')).slice(0,120), day, group, scope, bpm: validBpm(bpm), week: scope === 'festivity' ? null : weekKey(), pages, position: position + i, filename: file.name };
        if (!score.title) throw new Error('Informe o nome do hino.');
        if (room) await publishScore(score, file, room); else await saveScore(score, file);
        completed++;
      }
      onSaved(group);
    } catch (e) { setFiles(files.slice(completed)); setError(`${e instanceof Error ? e.message : 'Não foi possível enviar.'}${completed ? ` ${completed} PDF(s) já foram enviados; tente novamente os restantes.` : ''}`); }
    finally { setBusy(false); setProgress(''); }
  }
  return <ModalFrame title={scope === 'festivity' ? 'Partituras da festividade' : room ? 'Enviar partituras' : 'Adicionar partituras'} description={scope === 'festivity' ? 'Escolha o grupo. Os PDFs permanecem disponíveis até a exclusão manual.' : room ? 'Os tablets conectados receberão os PDFs automaticamente.' : 'Salve PDFs neste aparelho. Conecte a banda para distribuir aos tablets.'} onClose={() => { if (!busy) onClose(); }}>
    <form onSubmit={submit}><label className="dropzone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); choose(e.dataTransfer.files); }}><UploadCloud size={30} /><strong>{files.length ? `${files.length} PDF${files.length > 1 ? 's selecionados' : ' selecionado'}` : 'Escolha suas partituras'}</strong><span>{files.length ? files.map(f => f.name).join(', ') : 'Toque para selecionar ou arraste os PDFs aqui'}</span><small>PDF · Até 20 MB por arquivo</small><input aria-label="Selecionar PDFs" type="file" accept="application/pdf,.pdf" multiple onChange={e => choose(e.target.files)} disabled={busy} /></label>
    {nativeAndroid && <div className="drive-import"><button type="button" className="button ghost full" disabled={busy} onClick={() => void fromDrive()}><HardDrive size={18} />Importar do Google Drive</button><p>No seletor, abra o menu lateral e escolha Google Drive. O Drive precisa estar instalado e conectado à sua conta.</p></div>}
    {files.length === 1 && <label>Nome do hino<input value={title} onChange={e => setTitle(e.target.value)} required maxLength={120} /></label>}
    <div className="form-row">{scope === 'weekly' && <label>Dia<select aria-label="Dia" value={day} onChange={e => setDay(e.target.value as Day)}><option value="saturday">Sábado</option><option value="sunday">Domingo</option></select></label>}<label>Grupo<select aria-label="Grupo" value={group} onChange={e => setGroup(e.target.value as Group)}>{GROUPS.map(g => <option key={g}>{g}</option>)}</select></label></div>
    <label>Andamento inicial (BPM)<input type="number" min="30" max="240" value={bpm} onChange={e => setBpm(Number(e.target.value))} required /></label>
    {error && <p className="form-error" role="alert">{error}</p>}<button type="submit" className="button primary full" disabled={!files.length || busy}>{busy ? <LoaderCircle size={18} className="spin" /> : <UploadCloud size={18} />}{progress || (room ? 'Enviar para a banda' : 'Salvar neste aparelho')}</button>
    </form>
  </ModalFrame>;
}

function ScoreRow({ score, cached, onOpen, canEdit, onDelete }: { score: Score; cached: boolean; onOpen: () => void; canEdit: boolean; onDelete: () => void }) {
  return <div className="score-row"><button className="score-open" onClick={onOpen}><span className={`score-icon ${groupClass(score.group)}`}><FileMusic size={22} /></span><span className="score-info"><strong>{score.title}</strong><span><i className={`group-dot ${groupClass(score.group)}`} />{score.group}<b>·</b>{score.pages} páginas{isFestivity(score) && <b className="festivity-tag">Festividade</b>}{score.demo && <b className="example-tag">Exemplo</b>}</span></span><span className="score-tempo">{score.bpm}<small>BPM</small></span><span className="score-cache" title={cached ? 'PDF salvo neste aparelho' : 'O PDF será baixado ao abrir'}>{cached ? <Check size={16} /> : <CloudDownload size={17} />}</span><ChevronRight size={19} className="score-arrow" /></button>{canEdit && <button className="icon-button delete-score" aria-label={`Remover ${score.title}`} onClick={onDelete}><Trash2 size={16} /></button>}</div>;
}

function RemoveFestivity({ score, onClose, onRemoved }: { score: Score; onClose: () => void; onRemoved: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function remove() {
    setBusy(true); setError('');
    try { await deleteScore(score); onRemoved(); }
    catch { setError('Não foi possível concluir a exclusão. Verifique a conexão e tente novamente.'); }
    finally { setBusy(false); }
  }
  return <ModalFrame title="Remover da festividade" description={`${score.title} será removida${score.roomId ? ' dos aparelhos conectados à banda' : ' deste aparelho'}.`} onClose={() => { if (!busy) onClose(); }}>
    <p className="removal-note">As anotações dessa partitura também serão removidas.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="connection-actions"><button className="button ghost" disabled={busy} onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy} onClick={() => void remove()}>{busy && <LoaderCircle className="spin" size={16} />}Remover partitura</button></div>
  </ModalFrame>;
}

export default function App() {
  const [view, setView] = useState<View>('week'), [modal, setModal] = useState<Modal>(null), [reader, setReader] = useState<Score | null>(null);
  const [scores, setScores] = useState<Score[]>([]), [room, setRoom] = useState<Room | null>(() => {
    if (!cloud) return null;
    try {
      const cached = JSON.parse(localStorage.getItem(ROOM_CACHE_KEY) ?? 'null');
      return cached && typeof cached.id === 'string' && typeof cached.name === 'string' && typeof cached.code === 'string' && typeof cached.ownerId === 'string' && ['director', 'musician'].includes(cached.role) ? cached as Room : null;
    } catch { return null; }
  }), [week, setWeek] = useState(weekKey());
  const [filter, setFilter] = useState<Group | 'all'>('all'), [query, setQuery] = useState(''), [expanded, setExpanded] = useState<Set<Day>>(new Set(['saturday']));
  const [festivityGroup, setFestivityGroup] = useState<Group>('Grupo de louvor'), [deletingFestivity, setDeletingFestivity] = useState<Score | null>(null);
  const [cached, setCached] = useState<Set<string>>(new Set()), [syncing, setSyncing] = useState(false), [synced, setSynced] = useState(false), [online, setOnline] = useState(navigator.onLine), [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true), [demoBusy, setDemoBusy] = useState(false);
  const [appUpdate, setAppUpdate] = useState(hasAppUpdate);
  const [readerLastPage, setReaderLastPage] = useState(false);
  const reading = !!reader;
  useEffect(() => {
    if (nativeAndroid) void readerDisplay.setReading({ reading }).catch(() => {});
    else if (!reading && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, [reading]);
  useEffect(() => { const update = () => setAppUpdate(true); window.addEventListener('shalom-app-update',update); return () => window.removeEventListener('shalom-app-update',update); }, []);
  const syncLock = useRef(false), roomRef = useRef<Room | null>(null), toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const notify = useCallback((message: string) => { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 6000); }, []);
  const reload = useCallback(async () => {
    const all = await getScores(); setScores(sortScores(all.filter(s => isActiveScore(s, weekKey()))));
    const flags = await Promise.all(all.map(async s => await getPdf(s.id) ? s.id : null));
    setCached(new Set(flags.filter((id): id is string => !!id)));
  }, []);
  useEffect(() => {
    let disposed = false;
    void (async () => {
      try { await clearExpired(weekKey()); await reload(); if (cloud && navigator.onLine) { const connected = await getRoom(); if (!disposed) setRoom(connected); } }
      catch { notify('Não foi possível conectar agora. Os PDFs já salvos continuam disponíveis.'); }
      finally { if (!disposed) setLoading(false); }
    })();
    return () => { disposed = true; };
  }, [reload, notify]);
  useEffect(() => {
    roomRef.current = room; setSynced(false);
    try { if (room) localStorage.setItem(ROOM_CACHE_KEY, JSON.stringify(room)); else localStorage.removeItem(ROOM_CACHE_KEY); }
    catch { notify('Não foi possível salvar a conexão da banda para a próxima abertura. Verifique o espaço do aparelho.'); }
  }, [room, notify]);
  const synchronize = useCallback(async (silent = false) => {
    const connected = roomRef.current;
    if (!connected || syncLock.current || !navigator.onLine) return;
    syncLock.current = true; setSyncing(true);
    try {
      const refreshedRoom = await getRoom();
      if (roomRef.current?.id !== connected.id) return;
      if (refreshedRoom && (refreshedRoom.id !== connected.id || refreshedRoom.role !== connected.role)) { roomRef.current = refreshedRoom; setRoom(refreshedRoom); }
      const latest = await pullScores(connected);
      if (roomRef.current?.id !== connected.id) return;
      await reload(); setSynced(true);
      for (const score of latest) { if (roomRef.current?.id !== connected.id) break; await downloadPdf(score); }
      await reload(); if (!silent) notify('Repertório atualizado e PDFs salvos neste aparelho.');
    } catch { setSynced(false); if (!silent) notify('Não foi possível atualizar. Verifique a internet; os PDFs salvos continuam disponíveis.'); }
    finally { syncLock.current = false; setSyncing(false); }
  }, [reload, notify]);
  useEffect(() => {
    if (!room || !cloud) return;
    void synchronize(true);
    const timer = setInterval(() => void synchronize(true), 30000);
    const channel = cloud.channel(`scores-${room.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `room_id=eq.${room.id}` }, () => void synchronize(true)).subscribe();
    return () => { clearInterval(timer); void cloud?.removeChannel(channel); };
  }, [room, synchronize, week]);
  useEffect(() => {
    const checkWeek = () => {
      const current = weekKey();
      if (current !== week) { setWeek(current); setReader(active => active && isFestivity(active) ? active : null); void clearExpired(current).then(reload).catch(() => notify('Não foi possível limpar os arquivos antigos neste aparelho.')); notify('Repertório da semana anterior removido.'); }
      if (navigator.onLine) void synchronize(true);
    };
    const connectivity = () => { setOnline(navigator.onLine); if (navigator.onLine) checkWeek(); };
    const visibility = () => { if (document.visibilityState === 'visible') checkWeek(); };
    const timer = setInterval(checkWeek, 60000);
    window.addEventListener('online', connectivity); window.addEventListener('offline', connectivity); document.addEventListener('visibilitychange', visibility);
    return () => { clearInterval(timer); window.removeEventListener('online', connectivity); window.removeEventListener('offline', connectivity); document.removeEventListener('visibilitychange', visibility); clearTimeout(toastTimer.current); };
  }, [week, reload, notify, synchronize]);
  const bandScores = scores.filter(s => room ? s.roomId === room.id : !s.roomId);
  const visibleScores = view === 'week' ? bandScores.filter(s => !isFestivity(s)) : bandScores;
  const readingDay = reader ? bandScores.filter(s => isFestivity(reader) ? isFestivity(s) && s.group === reader.group : !isFestivity(s) && s.day === reader.day) : [];
  const readingIndex = readingDay.findIndex(s => s.id === reader?.id);
  const filtered = visibleScores.filter(s => (filter === 'all' || s.group === filter) && `${s.title} ${s.group}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
  const demo = visibleScores.some(s => s.demo), canEdit = !room || room.role === 'director';
  async function remove(score: Score) { try { await deleteScore(score); await reload(); notify('Partitura removida do repertório.'); } catch { notify('Não foi possível remover a partitura. Tente novamente.'); } }
  function requestRemove(score: Score) { if (isFestivity(score)) setDeletingFestivity(score); else void remove(score); }
  async function startDemo() { setDemoBusy(true); try { await loadDemo(); await reload(); setExpanded(new Set(['saturday', 'sunday'])); notify('Exemplos carregados. Abra um PDF para experimentar o leitor.'); } catch { notify('Não foi possível carregar os exemplos.'); } finally { setDemoBusy(false); } }
  async function endDemo() { for (const s of scores.filter(s => s.demo)) await removeScore(s.id); await reload(); }
  async function disconnect() {
    if (!cloud) return;
    const previous = room;
    roomRef.current = null; setRoom(null);
    await cloud.auth.signOut();
    if (previous) for (const s of await getScores()) if (s.roomId === previous.id) await removeScore(s.id);
    await reload(); notify('Este aparelho foi desconectado da banda.');
  }
  const saturday = weekendDate(week, 'saturday'), sunday = weekendDate(week, 'sunday');
  const status = !online ? 'Sem internet' : room ? syncing ? 'Atualizando…' : synced ? 'Banda conectada' : 'Aguardando conexão' : 'Neste aparelho';
  return <>
    {reader ? <Reader key={reader.id} score={reader} initialPage={readerLastPage ? reader.pages : 1}
      previous={readingIndex >= 0 ? readingDay[readingIndex - 1] : undefined}
      next={readingIndex >= 0 ? readingDay[readingIndex + 1] : undefined}
      onSong={(song, lastPage) => { setReaderLastPage(lastPage); setReader(song); }}
      onClose={() => { setReader(null); setReaderLastPage(false); void reload(); }} notify={notify} /> : <div className="app-shell">
      <aside className="sidebar"><a className="brand" href="#" onClick={e => { e.preventDefault(); setView('week'); }}><span className="brand-mark"><Music2 size={27} /></span><span>shalom<small>PARTITURAS</small></span></a><div className="sidebar-label">ESPAÇO DA BANDA</div><nav>{navigation.map(({ id, title, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon size={20} /><span>{title}</span>{view === id && <i />}</button>)}</nav><div className="sidebar-card"><span className="mini-icon"><Tablet size={21} /></span><strong>Acesso da banda</strong><p>Gerencie a conexão deste aparelho.</p><button onClick={() => room ? setView('band') : setModal('connect')}>{room ? 'Ver conexão' : 'Conectar aparelho'}<ArrowUpRight size={16} /></button></div><div className="sidebar-bottom"><span className="band-avatar">S</span><div><strong>{room?.name ?? 'Banda Shalom'}</strong><small>{room ? room.role === 'director' ? 'Responsável conectado' : 'Músico conectado' : 'Aparelho não conectado'}</small></div></div></aside>
      <div className="main-shell"><header className="topbar"><a className="mobile-brand" href="#" aria-label="Shalom, página inicial" onClick={e => { e.preventDefault(); setView('week'); }}><span className="brand-mark"><Music2 size={21} /></span><span>shalom</span></a><span className="breadcrumb"><strong>{navigation.find(n => n.id === view)?.title}</strong></span><div className="topbar-right"><span className={`connection-status ${!online ? 'offline' : ''}`}>{!online ? <WifiOff size={14} /> : <i />}{status}</span><span className="avatar">S</span></div></header>
      <main className="main-content">
        {appUpdate && <div className="app-update"><span>Nova versão disponível.{nativeAndroid ? ' Baixe o APK e confirme a instalação.' : ''}</span><button className="button small primary" onClick={() => void updateApp(true).catch(() => notify('Não foi possível abrir a atualização. Tente novamente.'))}>Atualizar aplicativo</button></div>}
        {view === 'week' || view === 'library' ? <>
          <div className="page-heading"><div><h1>{view === 'week' ? 'Repertório' : 'Partituras'}</h1><p>{view === 'week' ? 'Partituras de sábado e domingo.' : 'PDFs do repertório atual.'}</p></div>{canEdit && <button className="button primary upload-main" onClick={() => setModal('upload')}><Plus size={19} />{room ? 'Enviar partituras' : 'Adicionar partituras'}</button>}</div>
          {view === 'week' && <section className="week-hero"><div className="summary-glow" aria-hidden="true" /><div className="hero-copy"><span className="hero-tag"><CalendarDays size={16} />Semana atual</span><h2>{formatDate(saturday, { day: '2-digit' })} e {formatDate(sunday, { day: '2-digit', month: 'long' })}</h2><div className="summary-total"><strong>{visibleScores.length.toString().padStart(2,'0')}</strong><span>{visibleScores.length === 1 ? 'partitura' : 'partituras'}</span></div><div className="hero-facts"><span><Users size={15} />6 grupos</span><span><Check size={15} />{visibleScores.filter(s => cached.has(s.id)).length} no aparelho</span></div></div><div className="summary-days"><span><i>SÁB</i><strong>{formatDate(saturday, { day: '2-digit' })}</strong><small>{visibleScores.filter(s => s.day === 'saturday').length} hinos</small></span><span><i>DOM</i><strong>{formatDate(sunday, { day: '2-digit' })}</strong><small>{visibleScores.filter(s => s.day === 'sunday').length} hinos</small></span></div></section>}
          {demo && <div className="demo-banner"><Sparkles size={17} /><span>Você está explorando partituras de exemplo.</span><button onClick={() => void endDemo()}>Limpar exemplos<X size={14} /></button></div>}
          <div className="repertoire-heading"><div><h2>{view === 'week' ? 'Hinos da semana' : 'Hinos'}</h2><p>{view === 'week' ? 'Selecione o dia e o grupo.' : 'Os PDFs com ✓ já estão salvos no aparelho.'}</p></div><label className="search"><Search size={17} /><input aria-label="Buscar hino" placeholder="Buscar hino…" value={query} onChange={e => setQuery(e.target.value)} />{query && <button className="icon-button" aria-label="Limpar busca" onClick={() => setQuery('')}><X size={14} /></button>}</label></div>
          <div className="group-filters" aria-label="Filtrar por grupo"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todos os grupos<span>{visibleScores.length}</span></button>{GROUPS.map(group => <button key={group} className={filter === group ? 'active' : ''} onClick={() => setFilter(group)}><i className={`group-dot ${groupClass(group)}`} />{group}</button>)}</div>
          {loading ? <div className="empty-state"><LoaderCircle className="spin" /><p>Carregando repertório…</p></div> : view === 'week' ? <div className="day-cards">{(['saturday', 'sunday'] as Day[]).map(day => {
            const all = visibleScores.filter(s => s.day === day), list = filtered.filter(s => s.day === day), open = expanded.has(day), date = weekendDate(week, day);
            return <section className={`day-card ${open ? 'expanded' : ''}`} key={day}><button className="day-toggle" aria-expanded={open} onClick={() => setExpanded(previous => { const next = new Set(previous); if (next.has(day)) next.delete(day); else next.add(day); return next; })}><span className={`date-square ${day}`}><small>{formatDate(date, { month: 'short' }).replace('.', '')}</small><strong>{formatDate(date, { day: '2-digit' })}</strong></span><span className="day-info"><strong>{day === 'saturday' ? 'Sábado' : 'Domingo'}</strong><span>{formatDate(date, { day: '2-digit', month: 'long' })}</span></span><span className="count-pill">{all.length} {all.length === 1 ? 'hino' : 'hinos'}</span><ChevronDown className="day-chevron" size={20} /></button>{open && <div className="day-content">{list.length ? list.map(score => <ScoreRow key={score.id} score={score} cached={cached.has(score.id)} canEdit={canEdit} onOpen={() => setReader(score)} onDelete={() => requestRemove(score)} />) : <div className="day-empty"><FileMusic size={25} /><div><strong>{all.length ? 'Nenhum hino neste filtro' : 'Nenhum hino adicionado'}</strong><p>{all.length ? 'Experimente outro grupo ou uma nova busca.' : canEdit ? 'Adicione as partituras deste dia.' : 'Os hinos aparecerão aqui quando o responsável enviar.'}</p></div>{canEdit && !all.length && <button className="icon-button" aria-label={`Adicionar hinos para ${day === 'saturday' ? 'sábado' : 'domingo'}`} onClick={() => setModal('upload')}><Plus size={20} /></button>}</div>}</div>}</section>;
          })}</div> : <div className="library-list">{filtered.length ? filtered.map(score => <ScoreRow key={score.id} score={score} cached={cached.has(score.id)} canEdit={canEdit} onOpen={() => setReader(score)} onDelete={() => requestRemove(score)} />) : <div className="empty-state"><BookOpen size={30} /><h3>Nenhuma partitura por aqui</h3><p>Adicione PDFs ou conecte este aparelho à banda.</p></div>}</div>}
          <div className="week-note"><RefreshCw size={16} /><p>Limpeza semanal.<span> O repertório semanal é limpo na segunda-feira, à meia-noite. Festividades são removidas manualmente.</span></p><span className="note-badge">Renova na segunda</span></div>
          {!visibleScores.length && !room && <div className="explore-note"><span>Leitor PDF</span><button className="text-button" onClick={() => void startDemo()} disabled={demoBusy}>{demoBusy ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}Explorar com exemplos<ArrowUpRight size={15} /></button></div>}
        </> : view === 'festivity' ? <Festivities scores={bandScores.filter(isFestivity)} group={festivityGroup} onGroup={setFestivityGroup} canEdit={canEdit} connected={!!room} onUpload={() => setModal('upload')}
          renderScore={score => <ScoreRow key={score.id} score={score} cached={cached.has(score.id)} canEdit={canEdit} onOpen={() => setReader(score)} onDelete={() => requestRemove(score)} />} /> : view === 'band' ? <>
          <div className="page-heading"><div><h1>Banda</h1><p>Acessos e sincronização.</p></div></div>
          <section className="connection-card"><div className="connection-illustration"><Smartphone size={36} /><span>···</span><Tablet size={53} /></div><h2>{room ? 'Aparelho conectado' : 'Conectar aparelho'}</h2><p>{room ? room.role === 'director' ? 'Compartilhe o código abaixo com os músicos. Envie os PDFs pela tela de repertório.' : 'Você recebe os hinos enviados pelo responsável. As suas anotações são só suas.' : 'Conecte este aparelho para receber as partituras.'}</p>{room ? <><div className="room-code"><span>{room.code}</span><button className="icon-button" aria-label="Copiar código" onClick={() => { void navigator.clipboard.writeText(room.code).then(() => notify('Código copiado.')).catch(() => notify(`Código da banda: ${room.code}`)); }}><Copy size={20} /></button></div><div className="connection-actions"><button className="button primary" disabled={syncing || !online} onClick={() => void synchronize()}><RefreshCw size={17} className={syncing ? 'spin' : ''} />Atualizar repertório</button><button className="button ghost" onClick={() => { if (room) void shareInvitation(room).then(result => { if (result === 'copied') notify('Convite copiado. Cole no aplicativo desejado.'); }).catch(error => { if (!shareCancelled(error)) notify('Não foi possível compartilhar o convite. Use Copiar código.'); }); }}><Share2 size={17} />Compartilhar banda</button><button className="button ghost" onClick={() => void disconnect()}><LogOut size={17} />Desconectar</button></div></> : <button className="button primary" onClick={() => setModal('connect')}><Users size={18} />Conectar à banda</button>}</section>
          {room?.role === 'director' && <Directors notify={notify} />}
          <div className="features-grid"><div><CloudDownload /><h3>Receba automaticamente</h3><p>Novos hinos aparecem nos aparelhos conectados à mesma banda.</p></div><div><ShieldCheck /><h3>Leitura offline</h3><p>Após o download, o PDF permanece disponível mesmo sem internet.</p></div><div><PenLineIcon /><h3>Anotações individuais</h3><p>Marque entradas, dinâmica e lembretes sem alterar o PDF da banda.</p></div></div>
        </> : <>
          <div className="page-heading"><div><h1>Ajustes</h1><p>Downloads e instalação.</p></div></div>
          <section className="settings-card"><h2>No seu aparelho</h2><div className="setting-row"><span className="setting-icon"><Download /></span><div><strong>Partituras salvas</strong><p>{visibleScores.filter(s => cached.has(s.id)).length} de {visibleScores.length} PDFs disponíveis para leitura sem internet.</p></div>{room && <button className="button small ghost" disabled={syncing} onClick={() => void synchronize()}>{syncing ? 'Baixando…' : 'Baixar todos'}</button>}</div><div className="setting-row"><span className="setting-icon"><CalendarDays /></span><div><strong>Renovação automática</strong><p>Somente o repertório semanal · segunda-feira, à meia-noite de São Paulo.</p></div><span className="setting-value">Ativada<Check size={15} /></span></div><div className="setting-row"><span className="setting-icon"><Tablet /></span><div><strong>Instalar no iPad</strong><p>No Safari, abra o endereço do app, toque em Compartilhar e em “Adicionar à Tela de Início”. A instalação e o modo offline precisam de um endereço HTTPS.</p></div></div><div className="setting-row"><span className="setting-icon"><Smartphone /></span><div><strong>Instalar no Android</strong><p>Instale o APK da banda ou adicione o app à tela inicial pelo Chrome.</p></div></div></section>
          <section className="settings-card"><h2>Sobre o aplicativo</h2><p className="about-copy">Repertório semanal, leitor PDF, anotações individuais e metrônomo visual.</p><div className="about-footer"><span>Versão {appVersion}</span></div></section>
        </>}
        <footer className="main-footer"><span className="mobile-band-summary"><strong>{room?.name ?? 'Banda Shalom'}</strong><small>{room ? room.role === 'director' ? 'Responsável conectado' : 'Músico conectado' : 'Aparelho não conectado'}</small></span><span className="author-credit">Carlos Bispo</span></footer>
      </main></div><nav className="mobile-nav" aria-label="Navegação principal">{navigation.map(({ id, title, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon size={21} /><span>{id === 'band' ? 'Banda' : title}</span></button>)}</nav>
    </div>}
    {modal === 'connect' && <Connect onClose={() => setModal(null)} onConnected={connected => { setRoom(connected); setModal(null); setView('band'); notify('Aparelho conectado à banda.'); }} />}
    {modal === 'upload' && <Upload room={room} scope={view === 'festivity' ? 'festivity' : 'weekly'} initialGroup={view === 'festivity' ? festivityGroup : 'Grupo de louvor'} position={Math.max(0, ...bandScores.map(s => s.position + 1))} onClose={() => setModal(null)} onSaved={group => { setModal(null); if (view === 'festivity') setFestivityGroup(group); setExpanded(new Set(['saturday', 'sunday'])); void reload(); notify(room ? 'Partituras enviadas para a banda.' : 'Partituras salvas neste aparelho.'); }} />}
    {deletingFestivity && <RemoveFestivity score={deletingFestivity} onClose={() => setDeletingFestivity(null)} onRemoved={() => { setDeletingFestivity(null); void reload(); notify('Partitura removida da festividade.'); }} />}
    {toast && <div className="toast" role="status"><Info size={18} /><span>{toast}</span><button className="icon-button" aria-label="Fechar aviso" onClick={() => setToast('')}><X size={16} /></button></div>}
  </>;
}
function PenLineIcon() { return <FileMusic />; }
