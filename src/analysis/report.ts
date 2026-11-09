import type { Finding, FindingGroup, ParseResult, ScanReport } from './types';
import { findingsFromCalls, findingsFromMetadata } from './rules';
import { parseMetadata } from './metadata';
import { findLexicalCalls } from './lexical';
import { buildInsights, coverageSummary, groupEvidence, parserGapDetail } from './insights';
import { activityIconSvg, activityIconColor, activityIconBackground } from './privacy-icons';

export const ENGINE_VERSION = '0.3.6';
const BASE_LIMITATIONS = [
  'Static source analysis cannot prove what executes at runtime or that a mod is safe.',
  'Macro expansion, external headers/libraries, generated code, indirect calls and dynamic behavior may be missed.',
  'API presence does not prove that an operation runs, succeeds or is malicious.',
  'Only provided source is inspected. No compiled binary or dependencies are scanned.',
];

export async function hashSource(source: string): Promise<string> {
  const bytes = new TextEncoder().encode(source);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,'0')).join('');
}

export async function buildReport(
  source: string,
  filename: string,
  parsed?: ParseResult,
): Promise<ScanReport> {
  const metadata = parseMetadata(source);
  const scan = parsed ?? {
    calls: findLexicalCalls(source), coverage: 'lexical' as const,
    limitations: ['Only lexical detection was available. Some calls may be missed or misidentified.'],
  };
  const findings = [...findingsFromCalls(scan.calls), ...findingsFromMetadata(metadata)]
    .sort((a,b) => a.line - b.line || a.column - b.column || a.ruleId.localeCompare(b.ruleId));
  return {
    schemaVersion: 1,
    engineVersion: ENGINE_VERSION,
    filename,
    analyzedAt: new Date().toISOString(),
    sha256: await hashSource(source),
    sourceLines: source.split(/\r?\n/).length,
    coverage: scan.coverage,
    diagnostics: scan.diagnostics,
    limitations: [...BASE_LIMITATIONS, ...scan.limitations],
    metadata,
    findings,
  };
}

/** Deduplicate visual findings while preserving every distinct source occurrence.
 *  Group only calls with the same rule, API, contextual explanation and severity.
 *  The raw JSON findings array remains unchanged for consumers and comparisons.
 */
export function groupFindings(findings: Finding[]): FindingGroup[] {
  const groups: FindingGroup[] = [];
  const index = new Map<string, FindingGroup>();
  for (const finding of findings) {
    const key = JSON.stringify([finding.ruleId, finding.symbol, finding.title,
      finding.explanation, finding.severity, finding.certainty, finding.category]);
    let group = index.get(key);
    if (!group) {
      group = { id: finding.id, finding, occurrences: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.occurrences.push(finding);
  }
  return groups;
}

export interface DiffResult { added: Finding[]; removed: Finding[]; unchanged: number; }
function signature(f: Finding): string {
  // Ignore source line movement but retain API and content changes.
  return [f.ruleId, f.symbol, (f.arguments ?? f.excerpt).replace(/\s+/g,' ').trim()].join('|');
}
export function compareReports(before: ScanReport, after: ScanReport): DiffResult {
  const available = new Map<string, Finding[]>();
  for (const finding of before.findings) {
    const key = signature(finding);
    const group = available.get(key) ?? [];
    group.push(finding); available.set(key, group);
  }
  const added: Finding[] = [];
  let unchanged = 0;
  for (const finding of after.findings) {
    const group = available.get(signature(finding));
    if (group?.length) { group.pop(); unchanged++; }
    else added.push(finding);
  }
  return { added, removed: [...available.values()].flat(), unchanged };
}

export function reportFilename(report: ScanReport, ext: 'json' | 'html'): string {
  return `${report.metadata.id ?? report.filename}`.replace(/[^a-z0-9._-]/gi, '_').slice(0,100) + `-inspection.${ext}`;
}
const esc = (input: string) => input.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function reportHtml(report: ScanReport): string {
  const insights = buildInsights(report);
  const coverage = coverageSummary(report);
  const parserGap = parserGapDetail(report);
  const plainList = (priority: 'review' | 'note') => insights.filter(item=>item.priority===priority).map(item => {
    const refs = groupEvidence(item.findings).map(e=>`<li>${esc(e.label)} (${e.locations.length} reference${e.locations.length===1?'':'s'})</li>`).join('');
    return `<article><h3><span class="activity-icon" style="color:${activityIconColor(item.id)};background:${activityIconBackground(item.id)}">${activityIconSvg(item.id)}</span>${esc(item.title)}</h3><p>${esc(item.meaning)}</p>
      ${priority==='review'?`<p class="review"><b>What to review:</b> ${esc(item.next)}</p>`:''}
      <details><summary>Details (${item.findings.length} references)</summary><p>${esc(item.why)}</p><ul>${refs}</ul></details></article>`;
  }).join('');
  const review = plainList('review');
  const routine = plainList('note');
  const groups = groupFindings(report.findings);
  const rows = groups.map(({ finding: f, occurrences }) => {
    const evidence = occurrences.map(o => `<div><b>${o.line ? `Line ${o.line}` : 'Metadata'}</b>: <code>${esc(o.excerpt)}</code>
      ${o.arguments ? `<details><summary>Call arguments</summary><code>${esc(o.arguments)}</code></details>` : ''}</div>`).join('');
    return `<tr><td>${esc(f.category)}</td><td>${esc(f.severity)}</td><td>${esc(f.title)}</td><td>${esc(f.symbol)}</td><td>
      ${occurrences.length} occurrence${occurrences.length===1?'':'s'}<details><summary>Show source lines</summary>${evidence}</details></td></tr>`;
  }).join('');
  const diag = report.diagnostics;
  const parser = diag ? `<p>C++ calls inspected: ${diag.analyzedCalls}; parser recovery regions: ${diag.syntaxErrorNodes}; missing tokens: ${diag.missingNodes}; inspection limit reached: ${diag.truncated ? 'yes' : 'no'}.</p>
    ${parserGap ? `<p>${esc(parserGap)}. This is not a compilation check or a safety rating.</p>` : ''}
    ${report.coverage==='hybrid' ? `<p>Extra text-scan matches: ${diag.lexicalSupplementCalls ?? 0}. These are less precise than the C++ parser.</p>` : ''}` : '<p>Detailed C++ parser information unavailable.</p>';
  const limits = report.limitations.map(l=>`<li>${esc(l)}</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Windhawk Inspector Report</title><style>
  body{font:14px/1.6 system-ui,Arial,sans-serif;background:#1c1c1c;color:#eee;max-width:1050px;margin:35px auto;padding:0 18px}
  h1,h2,h3{font-weight:600}h1{color:#ffce2e} .activity-icon{width:28px;height:28px;display:inline-grid;place-items:center;background:#263320;border:1px solid color-mix(in srgb,currentColor 42%,transparent);border-radius:6px;margin-right:10px;vertical-align:middle}.activity-icon svg{width:19px;height:19px;display:block}h2{margin-top:27px}p,small{color:#bbb}article{background:#232323;border:1px solid #424242;padding:13px 18px;margin:12px 0;border-radius:4px}
  .review{color:#e2ca9d}h2{font-size:18px}h3{font-size:14px;margin:0 0 5px}article p{margin:4px 0 8px}details{font-size:12px}article details p{margin-top:8px}
  .notice{border:1px solid ${coverage.kind==='caution'?'#a17b3e':'#555'};padding:12px 15px;background:#262626}
  .notice.note{border:none;background:transparent;color:#a6b1a6;padding:0;font-size:12px}
  table{width:100%;border-collapse:collapse}td,th{border:1px solid #444;padding:9px;text-align:left;vertical-align:top;overflow-wrap:anywhere}
  details{margin:9px 0}summary{cursor:pointer;color:#e4d5a5}code{white-space:pre-wrap;overflow-wrap:anywhere}li{margin:7px 0}small{font-size:12px}
  </style></head><body><h1>Windhawk Inspector</h1><p>This is not a safety certificate. The tool only checks source code.</p>
  <h2>${esc(report.metadata.name ?? report.filename)}</h2><p>Engine ${esc(report.engineVersion)} · ${esc(report.analyzedAt)} · SHA-256 ${esc(report.sha256)}</p>
  <div class="notice ${coverage.kind}"><strong>${esc(coverage.title)}</strong><p>${esc(coverage.explanation)}</p></div>
  <h2>What we found</h2><p>Icons show potential capabilities. Colors indicate activity types, not risk.</p>
  ${review?`<h2>Worth a closer look</h2>${review}`:''}
  ${routine?`<h2>Other things found</h2>${routine}`:''}
  ${!insights.length?'<p>No matching functions were found. This does not mean the mod is safe.</p>':''}
  <h2>Technical evidence</h2><section><p>${report.findings.length} source matches, grouped into ${groups.length} technical items.</p>
    <p>Included processes: ${esc(report.metadata.includes.join(', ') || 'Not declared')}</p>
    ${parser}<table><thead><tr><th>Category</th><th>Level</th><th>Finding</th><th>API</th><th>Evidence</th></tr></thead><tbody>${rows}</tbody></table></section>
  <h2>What this check cannot prove</h2><ul>${limits}</ul></body></html>`;
}
