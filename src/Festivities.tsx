import { PartyPopper, Plus, Search, FileMusic, X } from 'lucide-react';
import { GROUPS, type Group, type Score } from './domain';
import { useState } from 'react';
export default function Festivities({ scores, group, onGroup, canEdit, connected, onUpload, renderScore }: {
  scores: Score[]; group: Group; onGroup: (group: Group) => void; canEdit: boolean; connected: boolean;
  onUpload: () => void; renderScore: (score: Score) => React.ReactNode;
}) {
  const [query, setQuery] = useState('');
  const selected = scores.filter(score => score.group === group);
  const filtered = selected.filter(score => score.title.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
  return <>
    <div className="page-heading"><div><h1>Festividade</h1><p>Partituras mantidas até a exclusão manual.</p></div>{canEdit && <button className="button primary upload-main" onClick={onUpload}><Plus size={19} />{connected ? 'Enviar partituras' : 'Adicionar partituras'}</button>}</div>
    <div className="festivity-groups" aria-label="Grupo da festividade">{GROUPS.map((name, index) => {
      const count = scores.filter(score => score.group === name).length;
      return <button className={group === name ? 'active' : ''} aria-pressed={group === name} key={name} onClick={() => { onGroup(name); setQuery(''); }}>
        <span className={`festivity-group-icon group-${index}`}><PartyPopper size={22} /></span><strong>{name}</strong><small>{count} {count === 1 ? 'partitura' : 'partituras'}</small>
      </button>;
    })}</div>
    <div className="repertoire-heading"><div><h2>{group}</h2><p>{selected.length} {selected.length === 1 ? 'partitura' : 'partituras'}</p></div><label className="search"><Search size={17} /><input aria-label="Buscar partitura da festividade" placeholder="Buscar partitura…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button className="icon-button" aria-label="Limpar busca da festividade" onClick={() => setQuery('')}><X size={14} /></button>}</label></div>
    <div className="library-list">{filtered.length ? filtered.map(renderScore) : <div className="empty-state"><FileMusic size={30} /><h3>{query ? 'Nenhuma partitura nesta busca' : 'Nenhuma partitura neste grupo'}</h3><p>{canEdit ? 'Adicione os PDFs da festividade.' : 'As partituras aparecerão quando um responsável enviar.'}</p></div>}</div>
    <div className="week-note"><PartyPopper size={16} /><p>As partituras da festividade ficam disponíveis nas próximas semanas.</p></div>
  </>;
}
