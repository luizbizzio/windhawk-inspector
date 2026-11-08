import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { CATEGORIES, type Category, type Finding, type ScanReport } from './analysis/types';
import { compareReports, reportFilename, reportHtml } from './analysis/report';
import { readLocalFile, runAnalysis, type SourceInput } from './analysis/client';
import { loadSourceUrl, MAX_SOURCE_BYTES } from './analysis/url';

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

function SourcePanel({ title, data, setData, disabled }: { title:string; data: SourcePanelState; setData:(p:SourcePanelState)=>void; disabled:boolean; }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const setMode = (mode: SourceMode) => setData({ ...data, mode });
  return <section className="source-panel">
    <div className="panel-title"><span>{title}</span><span className="muted tiny">C++ source</span></div>
    <div className="mode-tabs" role="tablist" aria-label={`${title} input method`}>
      {([['url','URL','link'],['upload','Upload','upload'],['paste','Paste code','code']] as const).map(([mode,label,icon]) =>
        <button type="button" key={mode} disabled={disabled} role="tab" aria-selected={data.mode===mode} className={data.mode===mode?'tab active':'tab'} onClick={()=>setMode(mode)}><Icon name={icon} size={16}/>{label}</button>)}
    </div>
    {data.mode === 'url' && <div className="field"><label htmlFor={title+'-url'}>Windhawk or GitHub source URL</label><input id={title+'-url'} type="url" value={data.url} placeholder="https://windhawk.net/mods/..." disabled={disabled} onChange={e => setData({...data,url:e.target.value})}/><p className="hint">Official Windhawk catalog, GitHub file or raw URL. Public sources only.</p></div>}
    {data.mode === 'upload' && <div className="upload-zone"><input ref={fileRef} type="file" accept=".cpp,.h,.hpp,.txt" disabled={disabled} className="visually-hidden" onChange={(e:ChangeEvent<HTMLInputElement>)=>setData({...data,file:e.target.files?.[0]})}/><Icon name="upload" size={29}/><strong>{data.file?.name ?? 'Select a source file'}</strong><span className="muted">.wh.cpp · .cpp · .h · .hpp · .txt · up to 2 MB</span><button type="button" className="secondary compact" onClick={()=>fileRef.current?.click()} disabled={disabled}>Browse files</button></div>}
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
  if (new TextEncoder().encode(data.code).byteLength > MAX_SOURCE_BYTES) throw new Error('Pasted code exceeds the 2 MB limit.');
  return { source: data.code, filename: 'pasted-code.wh.cpp' };
}

const sample = `// ==WindhawkMod==
// @id example-inspector
// @name Example Mod
// @version 1.0.0
// @include explorer.exe
// ==/WindhawkMod==
#include <windows.h>
void Example() {
  Wh_SetFunctionHook(nullptr, nullptr, nullptr);
  // This comment mentions DeleteFileW(), but it must not trigger a finding.
  CreateProcessW(nullptr, L"tool.exe", nullptr, nullptr, FALSE, 0, nullptr, nullptr, nullptr, nullptr);
  RegSetValueExW(nullptr, L"Example", 0, REG_SZ, nullptr, 0);
}`;

function saveFile(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content],{type:mime}));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url), 3000);
}

function FindingCard({ finding, onShowLine }: { finding:Finding; onShowLine:(line:number)=>void; }) {
  const [open,setOpen] = useState(false);
  return <article className={'finding-card '+(open?'expanded':'')}>
    <button type="button" className="finding-toggle" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>
      <span className={'severity '+finding.severity}>{finding.severity}</span>
      <span className="finding-name"><strong>{finding.title}</strong><small>{finding.category} · {finding.symbol} · {finding.certainty}</small></span>
      <span className="line-tag">{finding.line ? `L${finding.line}`:'META'}</span><span className="chevron">{open?'−':'+'}</span>
    </button>
    {open && <div className="finding-details"><p>{finding.explanation}</p><div className="evidence"><code>{finding.excerpt || '(metadata)'}</code></div>{finding.arguments && <details><summary>Call arguments (source text, not resolved values)</summary><pre>{finding.arguments}</pre></details>}<p><strong>Review:</strong> {finding.recommendation}</p>{finding.line>0 && <button type="button" className="text-button" onClick={()=>onShowLine(finding.line)}>Show in source ↗</button>}</div>}
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
  const filtered = report.findings.filter(f => (category==='All'||f.category===category) && (severity==='all'||f.severity===severity) && `${f.title} ${f.category} ${f.symbol} ${f.explanation}`.toLowerCase().includes(search.toLowerCase()));
  const counts = CATEGORIES.map(c=>[c,report.findings.filter(f=>f.category===c).length] as const).filter(([,n])=>n>0);
  function jumpTo(line:number) { setFocusLine(line); document.querySelector('.viewer')?.scrollIntoView({behavior:'smooth'}); }
  return <section className="results">
    <div className="section-heading"><div><p className="eyebrow">INSPECTION REPORT</p><h2>{report.metadata.name ?? report.filename}</h2><p className="muted">{report.metadata.id ? `ID: ${report.metadata.id} · `:''}{report.metadata.version ? `Version ${report.metadata.version} · `:''}{report.filename}</p></div><span className={'coverage '+report.coverage}>{report.coverage==='ast'?'AST parsed':'Limited lexical scan'}</span></div>
    <div className="stats"><div><strong>{report.findings.length}</strong><span>Findings</span></div><div><strong>{counts.length}</strong><span>Categories</span></div><div><strong>{report.findings.filter(f=>f.severity==='high').length}</strong><span>High severity</span></div><div><strong>{report.sourceLines.toLocaleString()}</strong><span>Lines of code</span></div></div>
    <div className="meta-grid"><div><span>Included processes</span><strong>{report.metadata.includes.join(', ') || 'Not declared'}</strong></div><div><span>Excluded processes</span><strong>{report.metadata.excludes.join(', ') || 'None declared'}</strong></div><div><span>SHA-256</span><code title={report.sha256}>{report.sha256.slice(0,18)}…</code></div><div><span>Analyzed</span><strong>{new Date(report.analyzedAt).toLocaleString()}</strong></div></div>
    <div className="section-heading"><h3>Capabilities & findings</h3><div className="export-buttons"><button className="secondary compact" onClick={()=>saveFile(reportFilename(report,'json'),JSON.stringify(report,null,2),'application/json')}><Icon name="download" size={15}/> JSON</button><button className="secondary compact" onClick={()=>saveFile(reportFilename(report,'html'),reportHtml(report),'text/html')}><Icon name="download" size={15}/> HTML</button></div></div>
    <div className="filters"><input aria-label="Search findings" placeholder="Search findings..." value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Filter category" value={category} onChange={e=>setCategory(e.target.value as Category|'All')}><option value="All">All categories</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select><select aria-label="Filter severity" value={severity} onChange={e=>setSeverity(e.target.value)}><option value="all">All severities</option>{SEVERITY_ORDER.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
    <div className="findings-list">{filtered.length?filtered.slice(0,200).map(f=><FindingCard key={f.id} finding={f} onShowLine={jumpTo}/>):<div className="empty-findings">No matching findings. This does not mean the mod is safe.</div>}</div>
    {filtered.length>200 && <p className="hint">Showing the first 200 matching findings. Use filters or search to narrow results.</p>}
    <div className="limits"><div><Icon name="alert" size={19}/><strong>Interpretation limits</strong></div><ul>{report.limitations.map((l,i)=><li key={i}>{l}</li>)}</ul><p>Severity indicates the importance of reviewing a capability, not a probability that the mod is malware.</p></div>
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
  const loadSample=()=>{setInput({mode:'paste',code:sample,url:''});setError('');};
  return <div className="app">
    <header className="site-header"><div className="wrap header-inner"><a className="brand" href="./" aria-label="Windhawk Inspector home"><span className="brand-icon"><Icon name="shield" size={24}/></span><span>Windhawk <strong>Inspector</strong></span></a><nav><a href="https://github.com/luizbizzio/windhawk-inspector" target="_blank" rel="noopener noreferrer"><Icon name="github" size={18}/> GitHub</a></nav></div></header>
    <main className="wrap"><section className="hero"><p className="eyebrow"><span className="status-dot"/> OPEN SOURCE · BROWSER-BASED SECURITY ANALYSIS</p><h1>Know what a mod <em>can do.</em><br/>Before you install it.</h1><p className="subtitle">Inspect Windhawk mod source code for network access, file operations, registry changes, process execution, hooks and more. No installation. No code execution.</p><div className="hero-tags"><span><Icon name="check" size={15}/> Local analysis</span><span><Icon name="check" size={15}/> C++ source</span><span><Icon name="check" size={15}/> Evidence by line</span></div></section>
    <div className="workspace"><div className="workspace-top"><div><p className="eyebrow">START INSPECTION</p><h2>Analyze a mod</h2></div><button type="button" className="text-button" onClick={loadSample} disabled={busy}>Load example →</button></div>
    <SourcePanel title="Current version" data={input} setData={setInput} disabled={busy}/>
    <label className="compare-toggle"><input type="checkbox" checked={compare} disabled={busy} onChange={e=>setCompare(e.target.checked)}/><span><strong>Compare two versions</strong><small>See newly introduced or removed capabilities</small></span><Icon name="compare" size={20}/></label>
    {compare && <SourcePanel title="Previous version" data={before} setData={setBefore} disabled={busy}/>}
    {error && <div className="error" role="alert"><Icon name="alert" size={18}/>{error}</div>}
    <div className="action-line"><button type="button" className="primary" onClick={analyze} disabled={busy}><Icon name="search" size={20}/>{busy?'Analyzing source...':'Analyze security'}</button><span className="muted tiny">Files & pasted code stay in your browser. URL sources are fetched from GitHub.</span></div></div>
    <div id="results">{result && <><ReportView report={result.report} source={result.source} focusLine={focusLine} setFocusLine={setFocusLine}/>{previous && <DiffView previous={previous} current={result.report}/>}</>}</div>
    <section className="about"><div><Icon name="shield" size={23}/><h3>Transparency, not certification.</h3><p>Windhawk mods run native C++ code in Windows processes. This inspector reports detectable source-code capabilities and their evidence. It cannot certify safety, observe actual runtime behavior or inspect missing dependencies.</p></div><div><Icon name="file" size={23}/><h3>Your source stays local.</h3><p>Files and pasted code are processed inside your browser. A link is fetched directly from the public GitHub source. There is no backend, account, database or telemetry in this application.</p></div></section>
    </main><footer className="footer"><div className="wrap footer-inner"><span>Windhawk Inspector · Open-source static analysis</span><span>Independent project, not affiliated with Windhawk.</span></div></footer>
  </div>;
}
