import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react';
import { CATEGORIES, type Category, type FindingGroup, type ScanReport } from './analysis/types';
import { compareReports, groupFindings, reportFilename, reportHtml } from './analysis/report';
import { readLocalFile, runAnalysis, type SourceInput } from './analysis/client';
import { loadSourceUrl, MAX_SOURCE_BYTES } from './analysis/url';
import { filterCatalog, parseCatalog, type CatalogMod } from './catalog';
import { buildInsights, coverageSummary, groupEvidence, type PlainInsight } from './analysis/insights';

type SourceMode = 'url' | 'upload' | 'paste';
interface SourcePanelState { mode: SourceMode; url: string; code: string; file?: File; }
const initialSource = (): SourcePanelState => ({ mode: 'url', url: '', code: '' });
const SEVERITY_ORDER = ['high', 'medium', 'low', 'info'];
function Icon({ name, size=20 }: {name:string; size?:number}) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  const icons: Record<string, ReactNode> = {
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7 .3l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7-.3l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></>,
    upload: <><path d="M12 16V3m-5 5 5-5 5 5"/><path d="M4 16v4h16v-4"/></>,
    code: <><path d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-12-2 16"/></>,
    alert: <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v.1"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    github: <><path d="M9 19c-4.5 1.4-4.5-2-6-2m6 4v-3c-4-1-5-3-5-7 0-1 .4-2 1.2-3C5 7 5 5.5 5.5 5.5s1.5-.2 3 1.3a11 11 0 0 1 7 0c1.5-1.5 3-1.3 3-1.3s.2 1.5-.7 2.5c.8 1 1.2 2 1.2 3 0 4-1 6-5 7v3"/></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/></>,
    compare: <><path d="M4 5h9m-4-4 4 4-4 4M20 19h-9m4-4-4 4 4 4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    file: <><path d="M5 3h9l5 5v13H5zM14 3v5h5"/><path d="M8 13h8m-8 4h8"/></>,
  };
  return <svg {...common}>{icons[name] ?? icons.shield}</svg>;
}

function ModPicker({ mods, data, setData, disabled, catalogStatus }: {mods:CatalogMod[];data:SourcePanelState;setData:(p:SourcePanelState)=>void;disabled:boolean;catalogStatus:string}) {
  const [query,setQuery] = useState('');
  const [expanded,setExpanded] = useState(false);
  const [active,setActive] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);
  const listId = useId();
  const matches = useMemo(() => filterCatalog(mods, query, 12), [mods, query]);
  const selected = mods.find(mod => data.url === `https://windhawk.net/mods/${mod.id}`);
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setExpanded(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);
  function choose(mod:CatalogMod) {
    setData({...data, mode:'url', url:`https://windhawk.net/mods/${mod.id}`});
    setQuery(mod.name); setExpanded(false); setActive(0);
  }
  function onKeyDown(event:KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {setExpanded(false);return;}
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setExpanded(true);
      setActive(i => Math.min(matches.length-1,Math.max(0,i+(event.key==='ArrowDown'?1:-1))));
    } else if (event.key === 'Enter' && expanded && matches.length) {
      event.preventDefault();choose(matches[Math.min(active,matches.length-1)]);
    }
  }
  return <div className="field mod-field" ref={wrapper}>
    <label htmlFor={`${listId}-search`}>Find a Windhawk mod</label>
    <div className="mod-search-wrap">
      <input id={`${listId}-search`} type="search" role="combobox" autoComplete="off"
        aria-autocomplete="list" aria-expanded={expanded && matches.length>0}
        aria-controls={`${listId}-results`} aria-activedescendant={expanded&&matches.length?`${listId}-item-${Math.min(active,matches.length-1)}`:undefined}
        placeholder={mods.length ? 'Search by name or mod ID' : catalogStatus}
        value={query} disabled={disabled||!mods.length}
        onFocus={()=>{if(query.trim())setExpanded(true);}}
        onChange={e=>{setQuery(e.target.value);setActive(0);setExpanded(Boolean(e.target.value.trim()));}}
        onKeyDown={onKeyDown}/>
      {expanded && query.trim() && <div id={`${listId}-results`} className="mod-results" role="listbox" aria-label="Matching Windhawk mods">
        {matches.length ? matches.map((mod,i)=><button type="button" role="option" aria-selected={active===i} id={`${listId}-item-${i}`} key={mod.id}
          className={'mod-result'+(active===i?' active':'')} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(mod)}>
          <span>{mod.name}<small>{mod.author ? `by ${mod.author}` : mod.id}</small></span><code>{mod.id}</code>
        </button>) : <p className="mod-empty">No matching mods</p>}
      </div>}
    </div>
    {selected && <div className="selected-mod"><span><strong>{selected.name}</strong><small>{selected.id}</small></span>
      <a href={`https://windhawk.net/mods/${selected.id}`} target="_blank" rel="noopener noreferrer">View mod ↗</a></div>}
    <p className="hint">{catalogStatus}. Select a mod to fill its source URL, or paste a URL below.</p>
  </div>;
}

function SourcePanel({ title, data, setData, disabled, mods, catalogStatus }: { title:string; data: SourcePanelState; setData:(p:SourcePanelState)=>void; disabled:boolean; mods:CatalogMod[];catalogStatus:string; }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const setMode = (mode: SourceMode) => setData({ ...data, mode });
  return <section className="source-panel">
    <div className="panel-title"><span>{title}</span><span className="muted tiny">C++ source</span></div>
    <div className="mode-tabs" role="tablist" aria-label={`${title} input method`}>
      {([['url','URL','link'],['upload','Upload','upload'],['paste','Paste code','code']] as const).map(([mode,label,icon]) =>
        <button type="button" key={mode} disabled={disabled} role="tab" aria-selected={data.mode===mode} className={data.mode===mode?'tab active':'tab'} onClick={()=>setMode(mode)}><Icon name={icon} size={16}/>{label}</button>)}
    </div>
    {data.mode === 'url' && <><ModPicker mods={mods} catalogStatus={catalogStatus} data={data} setData={setData} disabled={disabled}/><div className="field manual-source"><label htmlFor={title+'-url'}>Windhawk or GitHub source URL</label><input id={title+'-url'} type="url" value={data.url} placeholder="https://windhawk.net/mods/..." disabled={disabled} onChange={e => setData({...data,url:e.target.value})}/><p className="hint">Windhawk mod URL, GitHub file or raw URL. Public sources only.</p></div></>}
    {data.mode === 'upload' && <div className="upload-zone"><input ref={fileRef} type="file" accept=".cpp,.h,.hpp,.txt" disabled={disabled} className="visually-hidden" onChange={(e:ChangeEvent<HTMLInputElement>)=>setData({...data,file:e.target.files?.[0]})}/><Icon name="upload" size={29}/><strong>{data.file?.name ?? 'Select a source file'}</strong><span className="muted">.wh.cpp · .cpp · .h · .hpp · .txt · up to 50 MB</span><button type="button" className="secondary compact" onClick={()=>fileRef.current?.click()} disabled={disabled}>Browse files</button></div>}
    {data.mode === 'paste' && <div className="field"><label htmlFor={title+'-code'}>Paste C++ source</label><textarea id={title+'-code'} value={data.code} placeholder="// ==WindhawkMod==\n// @id example\n// @include explorer.exe\n// ==/WindhawkMod==" onChange={e=>setData({...data,code:e.target.value})} disabled={disabled} spellCheck={false} rows={7}/><p className="hint">Code is processed locally. No upload or execution.</p></div>}
  </section>;
}

async function prepareSource(data: SourcePanelState): Promise<SourceInput> {
  if (data.mode === 'url') {
    if (!data.url.trim()) throw new Error('Paste a Windhawk or GitHub URL.');
    return loadSourceUrl(data.url.trim());
  }
  if (data.mode === 'upload') {
    if (!data.file) throw new Error('Choose a C++ source file first.');
    return readLocalFile(data.file);
  }
  if (!data.code.trim()) throw new Error('Paste C++ code first.');
  if (new TextEncoder().encode(data.code).byteLength > MAX_SOURCE_BYTES) throw new Error('Pasted code exceeds the 50 MB limit.');
  return { source: data.code, filename: 'pasted-code.wh.cpp' };
}

function saveFile(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content],{type:mime}));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url), 3000);
}

function InsightCard({ insight, onShowLine }: { insight:PlainInsight; onShowLine:(line:number)=>void }) {
  const [expanded, setExpanded] = useState(false);
  const [all, setAll] = useState(false);
  const evidence = useMemo(() => groupEvidence(insight.findings), [insight]);
  const visible = all ? evidence : evidence.slice(0, 6);
  return <article className="insight-card">
    <div className="insight-top">
      <span className={'insight-level '+insight.priority}>{insight.priority==='review' ? 'Worth checking' : 'For your information'}</span>
      <span className="insight-count">{insight.findings.length} code {insight.findings.length===1?'match':'matches'}</span>
    </div>
    <h4>{insight.title}</h4>
    <p className="insight-meaning">{insight.meaning}</p>
    <p><strong>Why it matters</strong>{insight.why}</p>
    <p><strong>What to check</strong>{insight.next}</p>
    <button type="button" className="secondary compact insight-expand" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>
      {expanded ? 'Hide code examples' : `Show code examples (${evidence.length})`}
    </button>
    {expanded && <div className="insight-evidence">
      <p className="hint">These are source-code matches, not proof that the action happened. Matching calls are grouped to avoid repetition.</p>
      {visible.map((row,i)=><div className="insight-evidence-row" key={i}>
        <div><span>{row.label}</span><small>{row.locations.length} {row.locations.length===1?'location':'locations'}</small></div>
        <div className="line-links">{row.locations.slice(0,all?8:3).filter(f=>f.line>0).map(f=><button type="button" key={f.id} className="text-button" title={`Show line ${f.line} in source`} onClick={()=>onShowLine(f.line)}>L{f.line}</button>)}
        {row.locations.length>(all?8:3) && <small>+{row.locations.length-(all?8:3)} lines in JSON</small>}</div>
      </div>)}
      {evidence.length>6 && <button type="button" className="text-button insight-show-all" onClick={()=>setAll(v=>!v)}>{all?'Show fewer':`Show all ${evidence.length} examples`}</button>}
      <p className="hint">For full arguments and every code line, open Technical details or export the JSON report.</p>
    </div>}
  </article>;
}

function FindingCard({ group, onShowLine }: { group:FindingGroup; onShowLine:(line:number)=>void; }) {
  const [open,setOpen] = useState(false);
  const { finding, occurrences } = group;
  const first = occurrences[0];
  return <article className={'finding-card '+(open?'expanded':'')}>
    <button type="button" className="finding-toggle" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>
      <span className={'severity '+finding.severity}>{finding.severity}</span>
      <span className="finding-name"><strong>{finding.title}</strong><small>{finding.category} · {finding.symbol} · {finding.certainty}</small></span>
      <span className="line-tag">{occurrences.length===1 ? (first.line ? `L${first.line}`:'META') : `${occurrences.length} uses`}</span>
      <span className="chevron">{open?'−':'+'}</span>
    </button>
    {open && <div className="finding-details">
      <p>{finding.explanation}</p>
      <div className="occurrence-heading">Evidence ({occurrences.length} {occurrences.length===1?'location':'locations'})</div>
      <div className="occurrence-list">{occurrences.map(o=><div className="occurrence" key={o.id}>
        <div className="occurrence-top"><span>{o.line ? `Line ${o.line}`:'Metadata'}</span>{o.line > 0 && <button type="button" className="text-button" onClick={()=>onShowLine(o.line)}>Show in source ↗</button>}</div>
        <div className="evidence"><code>{o.excerpt || '(metadata)'}</code></div>
        {o.arguments && <details><summary>Call arguments (source text, not resolved values)</summary><pre>{o.arguments}</pre></details>}
      </div>)}</div>
      <p><strong>Review:</strong> {finding.recommendation}</p>
    </div>}
  </article>;
}

function SourceViewer({ source, focusLine }: {source:string; focusLine:number}) {
  const [show,setShow] = useState(false);
  const lines = useMemo(()=>source.split(/\r?\n/),[source]);
  const start = focusLine > 0 ? Math.max(0, focusLine - 151) : 0;
  const visibleLines = lines.slice(start, start + 301);
  useEffect(() => { if (focusLine) { setShow(true); requestAnimationFrame(()=>document.getElementById('source-line-'+focusLine)?.scrollIntoView({block:'center',behavior:'smooth'})); } }, [focusLine]);
  function reveal() { setShow(true); }
  return <section className="viewer">
    <div className="section-heading"><h3>Source code</h3><button className="secondary compact" onClick={()=>show?setShow(false):reveal()}>{show?'Hide':'View source'}</button></div>
    {show && <div className="source-lines" role="region" aria-label="C++ source code">
      <p className="hint" style={{paddingLeft:14}}>Showing lines {start+1} to {start+visibleLines.length} of {lines.length} to keep the browser responsive.</p>
      {visibleLines.map((line,index)=><div className={focusLine===start+index+1?'source-line focused':'source-line'} id={'source-line-'+(start+index+1)} key={start+index}><span>{start+index+1}</span><code>{line || ' '}</code></div>)}
    </div>}
  </section>;
}

function ReportView({ report, source, focusLine, setFocusLine }: { report:ScanReport; source:string; focusLine:number; setFocusLine:(line:number)=>void }) {
  const [category,setCategory] = useState<Category|'All'>('All');
  const [severity,setSeverity] = useState<string>('all');
  const [search,setSearch] = useState('');
  const groups = useMemo(()=>groupFindings(report.findings),[report]);
  const insights = useMemo(()=>buildInsights(report),[report]);
  const coverage = coverageSummary(report);
  const [advanced,setAdvanced] = useState(false);
  const filtered = groups.filter(g => {
    const f = g.finding;
    return (category==='All'||f.category===category) && (severity==='all'||f.severity===severity) &&
      `${f.title} ${f.category} ${f.symbol} ${f.explanation} ${g.occurrences.map(o=>o.excerpt).join(' ')}`.toLowerCase().includes(search.toLowerCase());
  });
  const counts = CATEGORIES.map(c=>[c,groups.filter(g=>g.finding.category===c).length] as const).filter(([,n])=>n>0);
  const parser = report.diagnostics;
  const parserIssues = (parser?.syntaxErrorNodes ?? 0) + (parser?.missingNodes ?? 0);
  function jumpTo(line:number) { setFocusLine(line); document.querySelector('.viewer')?.scrollIntoView({behavior:'smooth'}); }
  return <section className="results">
    <div className="section-heading"><div><p className="eyebrow">INSPECTION REPORT</p><h2>{report.metadata.name ?? report.filename}</h2><p className="muted">{report.metadata.id ? `ID: ${report.metadata.id} · `:''}{report.metadata.version ? `Version ${report.metadata.version} · `:''}{report.filename}</p></div><span className={'coverage '+report.coverage}>{report.coverage==='ast'?(parserIssues ? 'Parsing gaps found':'C++ parsed'):report.coverage==='hybrid'?'Mixed scan':'Basic text scan'}</span></div>
    <div className={'coverage-notice '+coverage.kind} role="status"><div><Icon name={coverage.kind==='caution'?'alert':'check'} size={19}/><strong>{coverage.title}</strong></div><p>{coverage.explanation}</p></div>
    <section className="plain-summary" aria-label="Plain-language findings">
      <div className="plain-summary-heading"><div><p className="eyebrow">IN SIMPLE WORDS</p><h3>What this mod may do</h3><p>{insights.length ? `${report.findings.length} code matches, shown as ${insights.length} understandable topics. A match is not proof of harmful behavior.` : 'No matching actions were found in the parts of the source checked. This does not mean the mod is safe.'}</p></div></div>
      {insights.some(i=>i.priority==='review') && <p className="review-note">Some actions are worth checking more closely. This is not a malware verdict or a risk score.</p>}
      <div className="insight-grid">{insights.map(item=><InsightCard key={item.id} insight={item} onShowLine={jumpTo}/>)}</div>
    </section>
    <div className="plain-actions"><button type="button" className="secondary" aria-expanded={advanced} onClick={()=>setAdvanced(v=>!v)}>{advanced?'Hide technical details':'Show technical details'}</button><div className="export-buttons"><button className="secondary compact" onClick={()=>saveFile(reportFilename(report,'json'),JSON.stringify(report,null,2),'application/json')}><Icon name="download" size={15}/> JSON</button><button className="secondary compact" onClick={()=>saveFile(reportFilename(report,'html'),reportHtml(report),'text/html')}><Icon name="download" size={15}/> HTML</button></div></div>
    {advanced && <div className="advanced-report" aria-label="Technical details">
    <div className="stats"><div><strong>{groups.length}</strong><span>Technical groups</span></div><div><strong>{counts.length}</strong><span>Categories</span></div><div><strong>{groups.filter(g=>g.finding.severity==='high'||g.finding.severity==='medium').length}</strong><span>Review suggested</span></div><div><strong>{report.findings.length}</strong><span>Occurrences</span></div></div>
    <div className="meta-grid"><div><span>Included processes</span><strong>{report.metadata.includes.join(', ') || 'Not declared'}</strong></div><div><span>Excluded processes</span><strong>{report.metadata.excludes.join(', ') || 'None declared'}</strong></div><div><span>SHA-256</span><code title={report.sha256}>{report.sha256.slice(0,18)}…</code></div><div><span>Analyzed</span><strong>{new Date(report.analyzedAt).toLocaleString()}</strong></div></div>
    <div className="parser-summary" aria-label="C++ parser coverage">
      <strong>Parser coverage</strong>
      {(report.coverage==='ast'||report.coverage==='hybrid') && parser ? <>
        <span>{parser.analyzedCalls.toLocaleString()} C++ calls inspected</span>
        {report.coverage==='hybrid' && <span>{parser.lexicalSupplementCalls ?? 0} extra text matches</span>}
        <span>{parser.syntaxErrorNodes} error regions</span>
        <span>{parser.missingNodes} missing tokens</span>
        {parser.truncated && <span className="parser-warning">Inspection limit reached</span>}
        {!!parser.sampledIssueLines.length && <span>Examples at lines {parser.sampledIssueLines.join(', ')}</span>}
      </> : <span>Basic text scan. Full C++ parser diagnostics unavailable.</span>}
      <p>These counts describe syntax analysis, not the percentage of safe or understood code. Macros and external dependencies are not resolved.</p>
    </div>
    <div className="section-heading"><h3>Raw technical findings</h3><p className="muted tiny">Every source match is kept in the JSON export.</p></div>
    <div className="filters"><input aria-label="Search findings" placeholder="Search findings..." value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Filter category" value={category} onChange={e=>setCategory(e.target.value as Category|'All')}><option value="All">All categories</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select><select aria-label="Filter severity" value={severity} onChange={e=>setSeverity(e.target.value)}><option value="all">All severities</option>{SEVERITY_ORDER.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
    <div className="findings-list">{filtered.length?filtered.slice(0,200).map(g=><FindingCard key={g.id} group={g} onShowLine={jumpTo}/>):<div className="empty-findings">No matching findings. This does not mean the mod is safe.</div>}</div>
    {filtered.length>200 && <p className="hint">Showing the first 200 matching capabilities. Use filters or search to narrow results.</p>}
    <div className="limits"><div><Icon name="alert" size={19}/><strong>Interpretation limits</strong></div><ul>{report.limitations.map((l,i)=><li key={i}>{l}</li>)}</ul><p>Severity indicates the importance of reviewing a capability, not a probability that the mod is malware.</p></div>
    </div>}
    <SourceViewer source={source} focusLine={focusLine}/>
  </section>;
}

function DiffView({ previous, current }: {previous:ScanReport; current:ScanReport}) {
  const diff = useMemo(()=>compareReports(previous,current),[previous,current]);
  return <section className="diff"><div className="section-heading"><h3>Changes compared with previous version</h3><span className="muted tiny">Source-level comparison</span></div><div className="diff-stats"><span>+ {diff.added.length} added</span><span>− {diff.removed.length} removed</span><span>{diff.unchanged} unchanged</span></div><p className="hint">Matching uses rule, API and source line text (ignoring whitespace). Refactors can appear as additions/removals even without a behavior change.</p>
    <div className="diff-columns"><div><h4>Added findings</h4>{diff.added.length?diff.added.map(f=><p key={f.id} className="diff-item added">+ {f.title} <span>{f.symbol}</span></p>):<p className="muted">No newly detected findings.</p>}</div><div><h4>Removed findings</h4>{diff.removed.length?diff.removed.map(f=><p key={f.id} className="diff-item removed">− {f.title} <span>{f.symbol}</span></p>):<p className="muted">No removed findings.</p>}</div></div></section>;
}

export default function App() {
  const [input,setInput] = useState<SourcePanelState>(initialSource);
  const [mods,setMods] = useState<CatalogMod[]>([]);
  const [catalogStatus,setCatalogStatus] = useState('Loading catalog');
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/catalog.json`, {signal:ctrl.signal});
        if(!response.ok) throw new Error(`HTTP ${response.status}`);
        const catalog = parseCatalog(await response.json());
        if (!ctrl.signal.aborted) {
          setMods(catalog.mods);
          setCatalogStatus(`${catalog.mods.length.toLocaleString()} mods · updated ${new Date(catalog.generatedAt).toLocaleDateString()}`);
        }
      } catch(err) {
        if (!ctrl.signal.aborted) setCatalogStatus('Catalog unavailable');
      }
    })();
    return () => ctrl.abort();
  }, []);
  const [before,setBefore] = useState<SourcePanelState>(initialSource);
  const [compare,setCompare] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [result,setResult] = useState<{report:ScanReport; source:string} | null>(null);
  const [previous,setPrevious] = useState<ScanReport | null>(null);
  const [focusLine,setFocusLine] = useState(0);
  async function analyze() {
    if (busy) return;
    setBusy(true); setError(''); setResult(null); setPrevious(null); setFocusLine(0);
    try {
      const currentSource = await prepareSource(input);
      const oldSource = compare ? await prepareSource(before) : null;
      const currentReport = await runAnalysis(currentSource);
      const oldReport = oldSource ? await runAnalysis(oldSource) : null;
      setResult({report:currentReport,source:currentSource.source}); setPrevious(oldReport);
      requestAnimationFrame(()=>document.getElementById('results')?.scrollIntoView({behavior:'smooth',block:'start'}));
    } catch(err) { setError(err instanceof Error ? err.message : 'An unexpected error occurred.'); }
    finally { setBusy(false); }
  }
  return <div className="app">
    <main className="wrap main">
      <div className="page-heading">
        <div className="page-heading-copy">
          <div className="page-title-row">
            <span className="brand-mark page-logo" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}assets/windhawk-logo.svg`} alt="" width="36" height="36" /></span>
            <h1>Windhawk Inspector</h1>
          </div>
          <p>Understand what a Windhawk mod can do. Check C++ source for sensitive capabilities, with evidence from the code.</p>
        </div>
        <div className="page-heading-meta">
          <nav className="page-links" aria-label="Project links">
            <a href="https://windhawk.net/" target="_blank" rel="noopener noreferrer">Windhawk ↗</a>
            <a href="https://windhawk-badges.luizbizzio.com/" target="_blank" rel="noopener noreferrer">Windhawk Badges ↗</a>
            <a href="https://github.com/luizbizzio/windhawk-inspector" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
          </nav>
        </div>
      </div>

      <section className="workspace panel" aria-labelledby="analyze-title">
        <div className="workspace-top panel-heading">
          <div><p className="eyebrow">SOURCE ANALYZER</p><h2 id="analyze-title">Analyze a mod</h2></div>
        </div>
        <SourcePanel title="Current version" data={input} setData={setInput} disabled={busy} mods={mods} catalogStatus={catalogStatus}/>
        <label className="compare-toggle">
          <input type="checkbox" checked={compare} disabled={busy} onChange={e=>setCompare(e.target.checked)}/>
          <span><strong>Compare versions</strong><small>Show added and removed capabilities</small></span>
        </label>
        {compare && <SourcePanel title="Previous version" data={before} setData={setBefore} disabled={busy} mods={mods} catalogStatus={catalogStatus}/>}
        {error && <div className="error" role="alert"><Icon name="alert" size={18}/>{error}</div>}
        <div className="action-line">
          <button type="button" className="primary" onClick={analyze} disabled={busy}><Icon name="search" size={16}/>{busy?'Analyzing...':'Analyze source'}</button>
          <span className="muted tiny">Uploaded files and pasted code never leave your browser. URL sources are fetched directly.</span>
        </div>
      </section>

      <div id="results">{result && <><ReportView report={result.report} source={result.source} focusLine={focusLine} setFocusLine={setFocusLine}/>{previous && <DiffView previous={previous} current={result.report}/>}</>}</div>
      <p className="disclaimer"><Icon name="alert" size={16}/> This tool shows possible source-code capabilities, not what happens at runtime. No findings does not mean a mod is safe.</p>
    </main>
    <footer className="footer"><div className="wrap footer-inner">
      <div className="footer-main">
        <div className="footer-brand"><span className="brand-mark" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}assets/windhawk-logo.svg`} alt="" width="31" height="31"/></span><div><strong>Windhawk Inspector</strong><p>Open-source static analysis for Windhawk mods.</p></div></div>
        <div className="footer-links"><a href="https://windhawk.net/" target="_blank" rel="noopener noreferrer">Windhawk</a><a href="https://windhawk-badges.luizbizzio.com/" target="_blank" rel="noopener noreferrer">Windhawk Badges</a><a href="https://github.com/luizbizzio/windhawk-inspector" target="_blank" rel="noopener noreferrer">GitHub</a></div>
      </div>
      <div className="footer-bottom"><span>Independent project, not affiliated with Windhawk.</span><span>No tracking · No server uploads · Apache-2.0 License</span></div>
    </div></footer>
  </div>;
}
