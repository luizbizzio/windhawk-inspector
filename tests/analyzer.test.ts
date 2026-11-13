import { describe, expect, it } from 'vitest';
import { findLexicalCalls, maskNonCode } from '../src/analysis/lexical';
import { parseMetadata } from '../src/analysis/metadata';
import { findingsFromCalls, findingsFromMetadata, normalizeSymbol, isTrackedCall } from '../src/analysis/rules';
import { buildReport, compareReports, groupFindings, reportHtml } from '../src/analysis/report';
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

describe('C++ API symbol normalization', () => {
  it('recognizes plain, namespaced, pointer and templated API names', () => {
    expect(normalizeSymbol('CreateProcessW')).toBe('CreateProcessW');
    expect(normalizeSymbol('Windows::CreateProcessW')).toBe('CreateProcessW');
    expect(normalizeSymbol('api->CreateProcessW')).toBe('CreateProcessW');
    expect(normalizeSymbol('api.CreateProcessW')).toBe('CreateProcessW');
    expect(normalizeSymbol('  **CreateProcessW ')).toBe('CreateProcessW');
    expect(normalizeSymbol('ns::Handler<Other::Pair<int, std::vector<char>>>::CreateProcessW')).toBe('CreateProcessW');
    expect(normalizeSymbol('LoadLibraryW<std::vector<std::pair<int, long>>>')).toBe('LoadLibraryW');
  });
  it('rejects unbalanced template syntax and handles angle brackets as C++, not HTML', () => {
    expect(normalizeSymbol('ns::Handler<int>::CreateProcessW<bad')).toBe('');
    expect(normalizeSymbol('ns::Handler<script>::CreateProcessW')).toBe('CreateProcessW');
    expect(isTrackedCall('ns::Handler<int>::CreateProcessW')).toBe(true);
    expect(isTrackedCall('ns::Handler<int>::NotTracked')).toBe(false);
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

describe('Recycle Bin File Preview capability regression', () => {
  // These calls and API names are present in the 1.0.0 source.
  const previewCalls = `DWORD attr = GetFileAttributesW(path);
HRESULT hr = AssocQueryStringW(ASSOCF_NONE, ASSOCSTR_SHELLEXTENSION, extension, kPreviewHandlerType, value, &length);
HRESULT createHr = AssocCreate(kClsidQueryAssociations, kIidQueryAssociations, reinterpret_cast<void**>(&qa));
installed = WindhawkUtils::SetFunctionHook(reinterpret_cast<BindToHandler_t>(vtable[3]), BindToHandler_Hook, &g_originalBind);`;

  it('identifies all four relevant API calls without inventing file access or Registry changes', () => {
    const findings = findingsFromCalls(findLexicalCalls(previewCalls));
    expect(findings.map(f=>f.ruleId)).toEqual([
      'fs-attributes', 'shell-assoc-query', 'shell-assoc-create', 'hook-windhawk',
    ]);
    expect(findings.map(f=>f.line)).toEqual([1,2,3,4]);
    expect(findings.every(f=>f.severity==='info')).toBe(true);
    expect(findings.some(f=>['fs-read','fs-write','reg-write','mem-inject'].includes(f.ruleId))).toBe(false);
  });

  it('only treats explicitly namespaced Windhawk helper hooks as Windhawk hooks', () => {
    const findings = findingsFromCalls(findLexicalCalls(
      'WindhawkUtils::SetFunctionHook(a,b,c);\nWindhawkUtils::SetFunctionHookT(a,b,c);\nOtherUtils::SetFunctionHook(a,b,c);\nSetFunctionHook(a,b,c);'
    ));
    expect(findings.map(f=>f.ruleId)).toEqual(['hook-windhawk','hook-windhawk']);
    expect(isTrackedCall('WindhawkUtils::SetFunctionHook')).toBe(true);
  });

  it('does not mistake file metadata checks or association queries for content reads or Registry writes', () => {
    const findings = findingsFromCalls(findLexicalCalls('GetFileAttributesExW(path, info, &data);\nAssocQueryStringA(flags, value, ext, extra, output, len);'));
    expect(findings.map(f=>f.ruleId)).toEqual(['fs-attributes', 'shell-assoc-query']);
    expect(findings.every(f=>f.severity==='info')).toBe(true);
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

describe('Capability groups and evidence retention', () => {
  it('groups repeated VK_ESCAPE checks while preserving both source lines and raw JSON', async () => {
    const code = `void f() {
  GetAsyncKeyState(VK_ESCAPE);
  GetAsyncKeyState(VK_ESCAPE);
  GetAsyncKeyState(VK_SHIFT);
}`;
    const report = await buildReport(code, 'keys.wh.cpp');
    const groups = groupFindings(report.findings);
    expect(report.findings).toHaveLength(4);
    expect(groups).toHaveLength(3);
    expect(groups.find(g=>g.finding.explanation.includes('VK_ESCAPE'))?.occurrences.map(f=>f.line)).toEqual([2,3]);
    expect(JSON.parse(JSON.stringify(report)).findings).toHaveLength(4);
    const html = reportHtml(report);
    expect(html).toContain('2 occurrences');
    expect(html).toContain('Line 2');
    expect(html).toContain('Line 3');
  });

  it('keeps different source evidence for the same API in a single inspectable group', async () => {
    const report = await buildReport('void f(){RegSetValueExW(a,b,c,d,e,f);RegSetValueExW(a,x,c,d,e,f);}', 'reg.wh.cpp');
    const groups = groupFindings(report.findings).filter(g=>g.finding.ruleId==='reg-write');
    expect(groups).toHaveLength(1);
    expect(groups[0].occurrences).toHaveLength(2);
    expect(groups[0].occurrences[0].arguments).not.toEqual(groups[0].occurrences[1].arguments);
  });
});

describe('Sensitive capability scenario tests', () => {
  it('detects representative network, download, Registry, process and credential operations', () => {
    const code = `void scan() {
      WinHttpSendRequest(handle, headers, 0, nullptr, 0, 0, 0);
      URLDownloadToFileW(nullptr, L"https://example.test/file", L"C:\\\\Temp\\\\file", 0, nullptr);
      RegOpenKeyExW(HKEY_CURRENT_USER, L"Software", 0, KEY_READ, &key);
      RegSetValueExW(key, L"Name", 0, REG_SZ, data, sizeof(data));
      CreateProcessW(nullptr, command, nullptr, nullptr, FALSE, 0, nullptr, nullptr, &startup, &process);
      CredReadW(L"Name", CRED_TYPE_GENERIC, 0, &result);
    }`;
    const rules = new Set(findingsFromCalls(findLexicalCalls(code)).map(f=>f.ruleId));
    for (const id of ['net-winhttp','dl-url','reg-read','reg-write','exec-process','cred-win']) expect(rules.has(id),id).toBe(true);
  });

  it('distinguishes file read and write access requests', () => {
    const code = `CreateFileW(L"C:\\\\Temp\\\\a,b.txt", GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, 0, nullptr);
CreateFileW(L"output.txt", GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, 0, nullptr);
fopen("notes.txt", "rb");`;
    const findings = findingsFromCalls(findLexicalCalls(code)).filter(f=>f.ruleId==='fs-create');
    expect(findings.map(f=>f.title)).toEqual(['File/handle read access','File/handle write access','File/handle read access']);
    expect(findings[1].severity).toBe('medium');
  });

  it('does not label ShellExecute open as an elevation request, but detects runas', () => {
    const code = `ShellExecuteW(nullptr, L"open", L"notepad.exe", nullptr, nullptr, SW_SHOW);
ShellExecuteW(nullptr, L"runas", L"tool.exe", nullptr, nullptr, SW_SHOW);`;
    const findings = findingsFromCalls(findLexicalCalls(code));
    expect(findings.filter(f=>f.ruleId==='exec-process')).toHaveLength(2);
    const elevate = findings.filter(f=>f.ruleId==='priv-elevate');
    expect(elevate).toHaveLength(1);
    expect(elevate[0].title).toBe('Explicit elevation verb');
    expect(elevate[0].line).toBe(2);
  });

  it('preserves file deletion signals and avoids C++ algorithm false positives', () => {
    const code = `std::remove(items.begin(), items.end(), value);
std::filesystem::remove(path);
DeleteFileW(L"a.txt");`;
    const fileDeletes = findingsFromCalls(findLexicalCalls(code)).filter(f=>f.ruleId==='fs-delete');
    expect(fileDeletes).toHaveLength(2);
    expect(fileDeletes.map(f=>f.line)).toEqual([2,3]);
  });
});
