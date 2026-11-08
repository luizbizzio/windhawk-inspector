import { describe, expect, it } from 'vitest';
import { findLexicalCalls, maskNonCode } from '../src/analysis/lexical';
import { parseMetadata } from '../src/analysis/metadata';
import { findingsFromCalls, findingsFromMetadata } from '../src/analysis/rules';
import { buildReport, compareReports, reportHtml } from '../src/analysis/report';
import { resolveSourceUrl } from '../src/analysis/url';

describe('Windhawk metadata', () => {
  it('reads repeated include/exclude entries and metadata only from the proper block', () => {
    const meta = parseMetadata(`// ==WindhawkMod==\n// @id test-mod\n// @name Test\n// @include explorer.exe\n// @include *.exe\n// @exclude notepad.exe\n// @compilerOptions -lwinhttp\n// ==/WindhawkMod==\n// @include other.exe`);
    expect(meta.id).toBe('test-mod');
    expect(meta.includes).toEqual(['explorer.exe','*.exe']);
    expect(meta.excludes).toEqual(['notepad.exe']);
    expect(meta.compilerOptions).toEqual(['-lwinhttp']);
    expect(findingsFromMetadata(meta).some(f=>f.ruleId==='meta-all-processes')).toBe(true);
  });
});

describe('C++ lexical fallback', () => {
  it('does not report API names solely in comments or ordinary strings', () => {
    const source = `// CreateProcessW();\n/* RegSetValueExW(); */\nconst char* x = "DeleteFileW()";\nURLDownloadToFileW(nullptr, L"https://example.org", L"file", 0, nullptr);`;
    const found = findingsFromCalls(findLexicalCalls(source));
    expect(found.map(f=>f.symbol)).toEqual(['URLDownloadToFileW']);
    expect(found[0].line).toBe(4);
  });
  it('ignores raw C++ string literal matches', () => {
    expect(maskNonCode('auto s=R"tag(CreateProcessW())tag";').includes('CreateProcessW')).toBe(false);
  });
  it('recognizes namespaced API calls and relevant risk categories', () => {
    const found = findingsFromCalls(findLexicalCalls('::CreateProcessW(nullptr);\nRegSetValueExW(nullptr);\nWh_SetFunctionHook(nullptr);'));
    expect(found.some(f=>f.category==='Process Execution' && f.severity==='high')).toBe(true);
    expect(found.some(f=>f.category==='Registry')).toBe(true);
    expect(found.some(f=>f.ruleId==='hook-windhawk' && f.severity==='info')).toBe(true);
  });
});

describe('URLs', () => {
  it('converts catalog links to the official raw source', () => {
    expect(resolveSourceUrl('https://windhawk.net/mods/taskbar-clock-customization')).toBe('https://raw.githubusercontent.com/ramensoftware/windhawk-mods/main/mods/taskbar-clock-customization.wh.cpp');
  });
  it('converts GitHub file links', () => {
    expect(resolveSourceUrl('https://github.com/luizbizzio/recycle-bin-file-preview/blob/main/mod.wh.cpp')).toBe('https://raw.githubusercontent.com/luizbizzio/recycle-bin-file-preview/main/mod.wh.cpp');
  });
  it.each(['http://windhawk.net/mods/test','https://example.com/file.cpp','https://github.com/owner/repo/blob/main/../../secret.cpp','https://windhawk.net/mods/%2e%2e','https://evil.com@windhawk.net:8443/mods/test'])(`rejects unsafe or unsupported URL %s`,(url) => {
    expect(()=>resolveSourceUrl(url)).toThrow();
  });
});

describe('reports', () => {
  it('compares added and removed capabilities', async () => {
    const before = await buildReport('void f(){ ReadFile(a,b,c,d,e); }','a.wh.cpp');
    const after = await buildReport('void f(){ ReadFile(a,b,c,d,e); CreateProcessW(nullptr); }','b.wh.cpp');
    const diff = compareReports(before,after);
    expect(diff.added.some(f=>f.category==='Process Execution')).toBe(true);
  });
  it('escapes C++ and user-supplied filename in exported HTML', async () => {
    const report = await buildReport('void f(){ CreateProcessW("<script>alert(1)</script>"); }','<script>.cpp');
    const html = reportHtml(report);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
  it('includes hash, coverage and limitations', async () => {
    const report= await buildReport('void f() {}','safe.cpp');
    expect(report.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.coverage).toBe('lexical');
    expect(report.limitations.length).toBeGreaterThan(0);
  });
});
