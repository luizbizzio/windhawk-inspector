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

describe('Taskbar Zones regression checks', () => {
  it('does not mistake std::remove on vectors for deleting files', () => {
    const code = `normalized.leftOrder.erase(std::remove(normalized.leftOrder.begin(), normalized.leftOrder.end(), id), normalized.leftOrder.end());
order.erase(std::remove(order.begin(), order.end(), id), order.end());
next.leftOrder.erase(std::remove(next.leftOrder.begin(), next.leftOrder.end(), gesture.appId), next.leftOrder.end());
next.rightOrder.erase(std::remove(next.rightOrder.begin(), next.rightOrder.end(), gesture.appId), next.rightOrder.end());
next.rightIds.erase(std::remove(next.rightIds.begin(), next.rightIds.end(), gesture.appId), next.rightIds.end());`;
    const found = findingsFromCalls(findLexicalCalls(code));
    expect(found.filter(f=>f.ruleId==='fs-delete')).toHaveLength(0);
    expect(findingsFromCalls(findLexicalCalls('std::filesystem::remove(path);')).some(f=>f.ruleId==='fs-delete')).toBe(true);
    expect(findingsFromCalls(findLexicalCalls('DeleteFileW(L"file.txt");')).some(f=>f.ruleId==='fs-delete')).toBe(true);
  });

  it('recognizes Escape checks as shortcut behavior, not sensitive data collection', () => {
    const found = findingsFromCalls(findLexicalCalls('if (GetAsyncKeyState(VK_ESCAPE) & 0x8000) CancelSectionGesture();'));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ ruleId: 'input-keys', severity: 'info', category: 'Input & Shortcuts', title: 'Specific key state check' });
  });

  it('provides context for known System32 DLL and loader resolution', () => {
    const code = `auto taskbar = LoadLibraryExW(L"taskbar.dll", nullptr, LOAD_LIBRARY_SEARCH_SYSTEM32);
GetProcAddress(kernelBase, "LoadLibraryExW");`;
    const found = findingsFromCalls(findLexicalCalls(code));
    expect(found.map(f=>f.title)).toEqual(['System32 library loading', 'Windows API resolution']);
    expect(found.every(f=>f.severity==='info')).toBe(true);
  });

  it('keeps a dangerous DLL search and filesystem deletion visible', () => {
    const code = `LoadLibraryW(L"C:\\\\Users\\\\Public\\\\unknown.dll");
DeleteFileW(L"C:\\\\Users\\\\Public\\\\temp.txt");`;
    const found = findingsFromCalls(findLexicalCalls(code));
    expect(found.map(f=>f.ruleId)).toContain('dll-load');
    expect(found.map(f=>f.ruleId)).toContain('fs-delete');
    expect(found.find(f=>f.ruleId==='dll-load')?.severity).toBe('low');
    expect(found.find(f=>f.ruleId==='fs-delete')?.severity).toBe('medium');
  });

  it('does not treat standard algorithm calls as sockets', () => {
    const found = findingsFromCalls(findLexicalCalls('std::ranges::connect(a); QObject::connect(a,b); std::send(a);'));
    expect(found.filter(f=>f.ruleId==='net-sockets')).toHaveLength(0);
  });
});
