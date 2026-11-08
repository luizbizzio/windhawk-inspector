import { describe, expect, it } from 'vitest';
import { buildReport, reportHtml } from '../src/analysis/report';
import { buildInsights, coverageSummary, groupEvidence } from '../src/analysis/insights';
import { supplementTruncatedAst } from '../src/analysis/hybrid';
import { findingsFromCalls } from '../src/analysis/rules';
import { findLexicalCalls } from '../src/analysis/lexical';
import type { ParseResult } from '../src/analysis/types';

describe('clear explanation for non-technical users', () => {
  it('groups repeated DLL exports and Windows components without hiding raw evidence', async () => {
    const source = `// ==WindhawkMod==\n// @include explorer.exe\n// ==/WindhawkMod==\nGetProcAddress(m, "sqlite3_open_v2");
GetProcAddress(m, "sqlite3_step");
GetProcAddress(m, "sqlite3_open_v2");
CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER, &factory);`;
    const report = await buildReport(source, 'windows.wh.cpp');
    const insights = buildInsights(report);
    expect(insights).toHaveLength(1);
    expect(insights[0].id).toBe('windows-components');
    expect(insights[0].findings).toHaveLength(4);
    expect(insights[0].priority).toBe('note');
    const examples = groupEvidence(insights[0].findings);
    expect(examples.find(r => r.label.includes('sqlite3_open_v2'))?.locations).toHaveLength(2);
    expect(examples.some(r=>r.label.includes('WICImagingFactory'))).toBe(true);
    expect(report.findings).toHaveLength(4);
  });
  it('has a clear non-safety warning for incomplete and lexical-only scans', () => {
    const hybrid = coverageSummary({coverage:'hybrid',limitations:[]});
    expect(hybrid.kind).toBe('caution');
    expect(hybrid.explanation).toContain('can miss');
    const lexical = coverageSummary({coverage:'lexical',limitations:[]});
    expect(lexical.kind).toBe('caution');
  });
  it('keeps the plain-language summary and escaped evidence in HTML', async () => {
    const report = await buildReport('// ==WindhawkMod==\n// @include explorer.exe\n// ==/WindhawkMod==\nGetProcAddress(a, "sqlite3_step"); // <script>x</script>', 'mod.wh.cpp');
    const html = reportHtml(report);
    expect(html).toContain('What we found');
    expect(html).toContain('Other things found');
    expect(html).toContain('Technical evidence');
    expect(html).not.toContain('<script>');
  });
  it('does not treat an unknown file-open mode as a confirmed file modification', async () => {
    const report = await buildReport('// ==WindhawkMod==\n// @include explorer.exe\n// ==/WindhawkMod==\n_wfopen(file, mode);', 'mod.cpp');
    expect(buildInsights(report)[0]?.id).toBe('files-open');
  });
});

describe('sensitive call interpretation', () => {
  it('distinguishes querying a process from modifying its memory', () => {
    const code = `OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
OpenProcess(SYNCHRONIZE, FALSE, pid);
OpenProcess(PROCESS_VM_WRITE | PROCESS_VM_OPERATION, FALSE, pid);`;
    const hits = findingsFromCalls(findLexicalCalls(code));
    expect(hits.map(h=>h.severity)).toEqual(['info','info','medium']);
    expect(hits[0].title).toBe('Process information access');
    expect(buildInsights({findings:hits}).map(i=>i.id)).toEqual(['process-memory','process-details']);
  });
  it('distinguishes checking permissions from requesting permission changes', () => {
    const code = `OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token);
OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY | TOKEN_ADJUST_PRIVILEGES, &token);
AdjustTokenPrivileges(token, FALSE, &privileges, 0, nullptr, nullptr);`;
    const hits = findingsFromCalls(findLexicalCalls(code));
    expect(hits.map(h=>h.severity)).toEqual(['info','medium','medium']);
    expect(buildInsights({findings:hits}).map(i=>i.id)).toEqual(['permission-changes','permission-checks']);
  });
  it('recognizes UTF-8 read mode in _wfopen', () => {
    const hits = findingsFromCalls(findLexicalCalls('_wfopen(shim.c_str(), L"rt, ccs=UTF-8");'));
    expect(hits).toHaveLength(1);
    expect(hits[0].title).toBe('File/handle read access');
    expect(buildInsights({findings:hits})[0].id).toBe('files-read');
  });
});

describe('full-source text supplement when the C++ scanner stops early', () => {
  it('adds late API calls once and keeps the partial-coverage warning', () => {
    const source = 'GetProcAddress(m, "sqlite3_open");\n' + 'int untouched = 1;\n'.repeat(50_000) + 'DeleteFileW(L"x.txt");';
    const parsed: ParseResult = {
      coverage: 'ast',
      calls: [{name:'GetProcAddress',line:1,column:1,args:'m, "sqlite3_open"',excerpt:'GetProcAddress(m, "sqlite3_open");'}],
      limitations:[],
      diagnostics: {visitedNodes:500000,callExpressions:1,analyzedCalls:1,syntaxErrorNodes:0,missingNodes:0,sampledIssueLines:[],truncated:true},
    };
    const result = supplementTruncatedAst(source, parsed);
    expect(result.coverage).toBe('hybrid');
    expect(result.diagnostics?.truncated).toBe(true);
    expect(result.diagnostics?.lexicalSupplementCalls).toBe(1);
    expect(result.calls.filter(f=>f.name.includes('DeleteFileW'))).toHaveLength(1);
    expect(result.calls.filter(f=>f.name.includes('GetProcAddress'))).toHaveLength(1);
    expect(result.calls.at(-1)?.line).toBe(50_002);
  });
});

describe('reader-first report', () => {
  it('keeps read-only process and permissions checks out of the review list', async () => {
    const code = `OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token);
AdjustTokenPrivileges(token, FALSE, &privileges, 0, nullptr, nullptr);`;
    const findings = findingsFromCalls(findLexicalCalls(code));
    const topics = buildInsights({ findings });
    expect(topics.find(item => item.id==='process-details')?.priority).toBe('note');
    expect(topics.find(item => item.id==='permission-checks')?.priority).toBe('note');
    expect(topics.find(item => item.id==='permission-changes')?.priority).toBe('review');
  });

  it('HTML shows short sections, and still keeps the technical evidence', async () => {
    const source = 'WriteFile(handle, data, 8, &written, nullptr); GetProcAddress(module, "GetWindowTextW");';
    const report = await buildReport(source, 'mod.wh.cpp');
    const html = reportHtml(report);
    expect(html).toContain('Worth a closer look');
    expect(html).toContain('Other things found');
    expect(html).toContain('Technical evidence');
    expect(html).toContain('GetProcAddress');
    expect(html).not.toContain('Why it matters');
  });
});
