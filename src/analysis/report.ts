import type { Finding, FindingGroup, ParseResult, ScanReport } from './types';
import { findingsFromCalls, findingsFromMetadata } from './rules';
import { parseMetadata } from './metadata';
import { findLexicalCalls } from './lexical';

export const ENGINE_VERSION = '0.1.2';
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
  const groups = groupFindings(report.findings);
  const rows = groups.map(({ finding: f, occurrences }) => {
    const evidence = occurrences.map(o => `<div><b>${o.line ? `Line ${o.line}` : 'Metadata'}</b>: <code>${esc(o.excerpt)}</code></div>`).join('');
    return `<tr><td>${esc(f.category)}</td><td>${esc(f.severity)}</td><td>${esc(f.certainty)}</td><td>${esc(f.title)} <small>(${occurrences.length} occurrence${occurrences.length===1?'':'s'})</small></td><td>${evidence}<p>${esc(f.explanation)}</p><p><b>Review:</b> ${esc(f.recommendation)}</p></td></tr>`;
  }).join('');
  const diag = report.diagnostics;
  const parserSummary = diag ? `<p>C++ parser: ${diag.syntaxErrorNodes} error regions, ${diag.missingNodes} missing tokens, ${diag.analyzedCalls} analyzed calls${diag.truncated?' (inspection truncated)':''}.</p>${diag.sampledIssueLines.length ? `<p>Examples of ambiguous syntax at lines: ${diag.sampledIssueLines.join(', ')}</p>` : ''}` : '<p>Full parser diagnostics unavailable; lexical fallback or older report.</p>';
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Windhawk Inspector Report</title><style>body{font:15px system-ui;background:#1c1c1c;color:#f2f2f2;max-width:1100px;margin:40px auto;padding:0 20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #3a3a3a;padding:10px;text-align:left;vertical-align:top;overflow-wrap:anywhere}td div{margin-bottom:7px}code{white-space:pre-wrap}p,small{color:#aaa}h1{color:#68bafa}</style></head><body><h1>Windhawk Inspector</h1><p>Static source analysis only. Not a security certificate.</p><h2>${esc(report.metadata.name ?? report.filename)}</h2><p>Engine ${esc(report.engineVersion)} · ${esc(report.analyzedAt)} · ${esc(report.coverage)} parse · SHA-256 ${esc(report.sha256)}</p><h3>Process scope</h3><p>Includes: ${esc(report.metadata.includes.join(', ') || 'Not declared')}<br>Excludes: ${esc(report.metadata.excludes.join(', ') || 'None declared')}</p><h3>Parser coverage</h3>${parserSummary}<h3>Findings (${groups.length} grouped capabilities, ${report.findings.length} occurrences)</h3><table><thead><tr><th>Category</th><th>Severity</th><th>Confidence</th><th>Finding</th><th>Evidence</th></tr></thead><tbody>${rows}</tbody></table><h3>Limitations</h3><ul>${report.limitations.map(l=>`<li>${esc(l)}</li>`).join('')}</ul></body></html>`;
}
