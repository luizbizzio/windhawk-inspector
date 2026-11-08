import type { Finding, ScanReport } from './types';
import { findingsFromCalls, findingsFromMetadata } from './rules';
import { parseMetadata } from './metadata';
import { findLexicalCalls } from './lexical';

export const ENGINE_VERSION = '0.1.1';
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
  parsed?: { calls: ReturnType<typeof findLexicalCalls>; coverage: 'ast' | 'lexical'; limitations: string[] },
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
    limitations: [...BASE_LIMITATIONS, ...scan.limitations],
    metadata,
    findings,
  };
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
  const rows = report.findings.map(f => `<tr><td>${esc(f.category)}</td><td>${esc(f.severity)}</td><td>${esc(f.certainty)}</td><td>${esc(f.title)}</td><td>${f.line || 'metadata'}</td><td><code>${esc(f.excerpt)}</code><p>${esc(f.explanation)}</p><p><b>Review:</b> ${esc(f.recommendation)}</p></td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Windhawk Inspector Report</title><style>body{font:15px system-ui;background:#1c1c1c;color:#f2f2f2;max-width:1100px;margin:40px auto;padding:0 20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #3a3a3a;padding:10px;text-align:left;vertical-align:top;overflow-wrap:anywhere}code{white-space:pre-wrap}p{color:#aaa}h1{color:#68bafa}</style></head><body><h1>Windhawk Inspector</h1><p>Static source analysis only. Not a security certificate.</p><h2>${esc(report.metadata.name ?? report.filename)}</h2><p>Engine ${esc(report.engineVersion)} · ${esc(report.analyzedAt)} · ${esc(report.coverage)} parse · SHA-256 ${esc(report.sha256)}</p><h3>Process scope</h3><p>Includes: ${esc(report.metadata.includes.join(', ') || 'Not declared')}<br>Excludes: ${esc(report.metadata.excludes.join(', ') || 'None declared')}</p><h3>Findings (${report.findings.length})</h3><table><thead><tr><th>Category</th><th>Severity</th><th>Confidence</th><th>Finding</th><th>Line</th><th>Evidence</th></tr></thead><tbody>${rows}</tbody></table><h3>Limitations</h3><ul>${report.limitations.map(l=>`<li>${esc(l)}</li>`).join('')}</ul></body></html>`;
}
