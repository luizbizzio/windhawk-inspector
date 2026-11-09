import type { CallSite, Category, Certainty, Finding, ModMetadata, Severity } from './types';

export interface Rule {
  id: string;
  symbols: string[];
  category: Category;
  severity: Severity;
  title: string;
  explanation: string;
  recommendation: string;
  certainty?: Certainty;
}

// Findings describe *capabilities in source*, not proof of runtime behavior.
export const RULES: Rule[] = [
  // Narrow, explicit capture APIs. Generic Media Foundation or COM calls do NOT
  // prove camera/mic usage and are intentionally excluded.
  { id: 'media-video-capture', symbols: ['capCreateCaptureWindow','capCreateCaptureWindowA','capCreateCaptureWindowW'], category: 'Camera', severity: 'medium', title: 'Video capture interface', explanation: 'The code creates a Windows video-capture window. This may be used with a camera or another video-capture device, but does not prove a camera was switched on.', recommendation: 'Check whether video capture belongs to the mod’s purpose.', certainty: 'potential' },
  { id: 'media-audio-input', symbols: ['waveInOpen','waveInStart'], category: 'Microphone', severity: 'medium', title: 'Audio input capability', explanation: 'The source uses a Windows audio-input API. It may work with a microphone or another audio input, but does not prove recording happened.', recommendation: 'Check why this mod needs audio-input access.', certainty: 'potential' },
  { id: 'net-winhttp', symbols: ['WinHttpOpen','WinHttpConnect','WinHttpOpenRequest','WinHttpSendRequest','WinHttpReceiveResponse'], category: 'Network', severity: 'medium', title: 'Windows HTTP client', explanation: 'This code uses Windows HTTP APIs that can communicate with remote services.', recommendation: 'Review the destination, transmitted data and reason for networking.' },
  { id: 'net-wininet', symbols: ['InternetOpenA','InternetOpenW','InternetConnectA','InternetConnectW','HttpOpenRequestA','HttpOpenRequestW','HttpSendRequestA','HttpSendRequestW','InternetOpenUrlA','InternetOpenUrlW'], category: 'Network', severity: 'medium', title: 'WinINet network access', explanation: 'This mod contains calls to the WinINet networking APIs.', recommendation: 'Check the connection target and what the mod sends or receives.' },
  { id: 'net-sockets', symbols: ['connect','WSAConnect','send','sendto','recv','recvfrom','WSASend','WSARecv'], category: 'Network', severity: 'medium', title: 'Socket communication', explanation: 'The source uses a socket networking operation. For common function names, confirm that the call actually resolves to a socket API.', recommendation: 'Verify the endpoint and what information is exchanged.', certainty: 'potential' },
  { id: 'net-curl', symbols: ['curl_easy_perform','curl_multi_perform'], category: 'Network', severity: 'medium', title: 'libcurl transfer', explanation: 'The source invokes a libcurl transfer operation.', recommendation: 'Check URL configuration and transfer payloads.' },
  { id: 'dl-url', symbols: ['URLDownloadToFileA','URLDownloadToFileW','URLDownloadToCacheFileA','URLDownloadToCacheFileW'], category: 'Downloads', severity: 'medium', title: 'File download API', explanation: 'The source contains an API for downloading a remote resource to a local file or cache.', recommendation: 'Verify the URL, output path and how downloaded content is subsequently handled.' },
  { id: 'dl-stream', symbols: ['WinHttpReadData','InternetReadFile','InternetReadFileExA','InternetReadFileExW'], category: 'Downloads', severity: 'low', title: 'Remote data read', explanation: 'The mod can read data from a previously opened HTTP or internet handle. It may download content, but the destination cannot be inferred from this call.', recommendation: 'Follow the data flow to determine whether content is stored or executed.', certainty: 'potential' },
  { id: 'fs-create', symbols: ['CreateFileA','CreateFileW','CreateFile2','_wfopen','fopen','_fsopen'], category: 'File System', severity: 'low', title: 'File open or creation', explanation: 'The mod opens a file handle. Read/write intent depends on flags or mode arguments and may be determined at runtime.', recommendation: 'Check access flags, target paths and whether files are modified.', certainty: 'potential' },
  { id: 'fs-read', symbols: ['ReadFile','ReadFileEx','fread','_read'], category: 'File System', severity: 'low', title: 'File or handle read', explanation: 'The code reads from a handle or stream, which might refer to a file, pipe or device.', recommendation: 'Trace the origin of the handle before assuming which data is accessed.', certainty: 'potential' },
  { id: 'fs-write', symbols: ['WriteFile','WriteFileEx','fwrite','_write'], category: 'File System', severity: 'medium', title: 'File or handle write', explanation: 'The source writes to a handle or stream, potentially modifying local files.', recommendation: 'Identify the actual destination handle and expected output.', certainty: 'potential' },
  { id: 'fs-delete', symbols: ['DeleteFileA','DeleteFileW','RemoveDirectoryA','RemoveDirectoryW','remove','_wremove','DeleteFile2'], category: 'File System', severity: 'medium', title: 'Delete operation', explanation: 'The source includes an operation that can delete a file or directory.', recommendation: 'Check the path and conditions that trigger deletion.', certainty: 'potential' },
  { id: 'fs-move', symbols: ['MoveFileA','MoveFileW','MoveFileExA','MoveFileExW','CopyFileA','CopyFileW','CopyFile2','ReplaceFileA','ReplaceFileW'], category: 'File System', severity: 'low', title: 'File copy or move', explanation: 'The code can copy, rename or replace files.', recommendation: 'Check source and destination paths.' },
  { id: 'reg-read', symbols: ['RegQueryValueExA','RegQueryValueExW','RegGetValueA','RegGetValueW','RegEnumKeyExA','RegEnumKeyExW','RegOpenKeyExA','RegOpenKeyExW'], category: 'Registry', severity: 'low', title: 'Registry read or key open', explanation: 'The code opens a Registry key for access, reads a value or enumerates keys. Opening a key alone does not prove data was read.', recommendation: 'Check the accessed keys and whether they contain sensitive settings.' },
  { id: 'reg-write', symbols: ['RegSetValueExA','RegSetValueExW','RegCreateKeyExA','RegCreateKeyExW','RegDeleteValueA','RegDeleteValueW','RegDeleteKeyA','RegDeleteKeyW','RegDeleteTreeA','RegDeleteTreeW'], category: 'Registry', severity: 'medium', title: 'Registry modification', explanation: 'The source can create, edit or remove Registry data.', recommendation: 'Check target keys and persistence or system configuration implications.' },
  { id: 'exec-process', symbols: ['CreateProcessA','CreateProcessW','CreateProcessAsUserA','CreateProcessAsUserW','WinExec','ShellExecuteA','ShellExecuteW','ShellExecuteExA','ShellExecuteExW','system','_wsystem','_popen','_wpopen'], category: 'Process Execution', severity: 'high', title: 'External process execution', explanation: 'The mod includes a way to start another program or execute a shell command.', recommendation: 'Inspect the executable, arguments, user input and execution conditions.' },
  { id: 'exec-com', symbols: ['CoCreateInstance','CoGetClassObject'], category: 'Dynamic Loading', severity: 'info', title: 'COM object activation', explanation: 'COM activation may create an in-process or out-of-process component. It is not necessarily process execution.', recommendation: 'Identify the COM class and expected role.', certainty: 'potential' },
  { id: 'mem-other', symbols: ['OpenProcess','ReadProcessMemory','WriteProcessMemory','VirtualProtectEx','VirtualAllocEx','VirtualFreeEx'], category: 'Memory', severity: 'medium', title: 'Cross-process memory operation', explanation: 'The code requests a process handle or performs a memory operation that may affect another process.', recommendation: 'Check targeted PIDs, access rights and memory operations.', certainty: 'potential' },
  { id: 'mem-inject', symbols: ['CreateRemoteThread','CreateRemoteThreadEx','NtCreateThreadEx','QueueUserAPC','NtQueueApcThread'], category: 'Hooks & Injection', severity: 'high', title: 'Remote execution primitive', explanation: 'The code contains an API frequently used for executing code in another process.', recommendation: 'Verify the intended target and why remote execution is needed.' },
  { id: 'hook-windhawk', symbols: ['Wh_SetFunctionHook','Wh_SetFunctionHookT','Wh_RemoveFunctionHook'], category: 'Hooks & Injection', severity: 'info', title: 'Windhawk hook', explanation: 'This is a normal Windhawk modding capability. A hook alone is not evidence of malicious behavior.', recommendation: 'Review which function is hooked and whether the modification matches the mod description.' },
  { id: 'hook-other', symbols: ['SetWindowsHookExA','SetWindowsHookExW','DetourAttach','MH_CreateHook','MinHook'], category: 'Hooks & Injection', severity: 'low', title: 'Function or Windows hook', explanation: 'This code can install a hook that changes or observes function/event behavior.', recommendation: 'Review the hooked target and data handled by the callback.' },
  { id: 'persist-service', symbols: ['CreateServiceA','CreateServiceW','ChangeServiceConfigA','ChangeServiceConfigW'], category: 'Persistence', severity: 'high', title: 'Windows service configuration', explanation: 'The source can create or change a Windows service, which can enable persistence.', recommendation: 'Check the service name, executable and start mode.' },
  { id: 'persist-task', symbols: ['SchRpcRegisterTask','RegisterTask','RegisterTaskDefinition'], category: 'Persistence', severity: 'high', title: 'Scheduled task registration', explanation: 'The code may register a task that runs automatically.', recommendation: 'Review the task trigger, action and account.', certainty: 'potential' },
  { id: 'priv-token', symbols: ['AdjustTokenPrivileges','OpenProcessToken','SetTokenInformation','DuplicateTokenEx'], category: 'Privileges', severity: 'medium', title: 'Access token operation', explanation: 'The code manipulates or inspects security access tokens.', recommendation: 'Check which privileges are requested and whether elevation is necessary.', certainty: 'potential' },
  { id: 'priv-elevate', symbols: ['ShellExecuteA','ShellExecuteW','ShellExecuteExA','ShellExecuteExW'], category: 'Privileges', severity: 'medium', title: 'Potential elevation request', explanation: 'ShellExecute can request elevation when passed the runas verb; the call itself does not prove elevation.', recommendation: 'Check whether the verb is runas and whether an elevation prompt is expected.', certainty: 'potential' },
  { id: 'dll-load', symbols: ['LoadLibraryA','LoadLibraryW','LoadLibraryExA','LoadLibraryExW','GetProcAddress','LdrLoadDll','LdrGetProcedureAddress'], category: 'Dynamic Loading', severity: 'low', title: 'Dynamic code or API loading', explanation: 'The code loads a library or obtains an API address dynamically. Indirect calls may not be fully traceable.', recommendation: 'Verify the library path and resolved export names.', certainty: 'potential' },
  { id: 'cred-win', symbols: ['CredReadA','CredReadW','CredEnumerateA','CredEnumerateW','LsaRetrievePrivateData','CryptUnprotectData','PFXImportCertStore'], category: 'Sensitive Data', severity: 'high', title: 'Sensitive data or credential API', explanation: 'The source uses APIs that can access protected data, credentials or certificate material.', recommendation: 'Review exactly what data is accessed and whether it leaves the device.', certainty: 'potential' },
  { id: 'input-keys', symbols: ['GetAsyncKeyState','GetKeyState','GetKeyboardState','SetWindowsHookExA','SetWindowsHookExW'], category: 'Input & Shortcuts', severity: 'low', title: 'Keyboard state or event access', explanation: 'The code can inspect keyboard state or install a Windows event hook. This is common for shortcuts and does not prove keylogging.', recommendation: 'Inspect callbacks and any storage or transmission of input.', certainty: 'potential' },
];

const lookup = new Map<string, Rule[]>();
for (const rule of RULES) for (const symbol of rule.symbols) {
  const list = lookup.get(symbol) ?? [];
  list.push(rule);
  lookup.set(symbol, list);
}

export function normalizeSymbol(name: string): string {
  return name.replace(/<[^<>]*>/g, '').split(/::|->|\./).at(-1)?.trim().replace(/^\*+/, '') ?? '';
}

/** Restrict large-file lexical scanning to known API candidates. */
export function isTrackedCall(name: string): boolean {
  return lookup.has(normalizeSymbol(name));
}

/** Best-effort split of top-level C++ call arguments, respecting basic nested expressions and literals. */
function splitCallArguments(raw: string): string[] {
  const out: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if ('([{'.includes(c)) { depth++; continue; }
    if (')]}'.includes(c)) { depth = Math.max(0, depth - 1); continue; }
    if (c === ',' && depth === 0) { out.push(raw.slice(start,i).trim()); start = i+1; }
  }
  out.push(raw.slice(start).trim());
  return out;
}

// Rule-specific context checks prevent generic C++ names from being treated as Win32 APIs.
// These checks are conservative heuristics, not full type/data-flow analysis.
function shouldSuppress(call: CallSite, rule: Rule, symbol: string): boolean {
  const qualified = call.name.replace(/\s+/g, '');
  if (rule.id === 'fs-delete' && symbol === 'remove') {
    if (/\bstd::(?:ranges::)?remove$/.test(qualified) || /\bboost::range::remove$/.test(qualified)) return true;
    if (!qualified.includes('filesystem::') && (call.args.match(/,/g) ?? []).length >= 2) return true;
  }
  if (rule.id === 'net-sockets' && /\b(?:std::|ranges::|QObject::|boost::signals2::)/.test(qualified)) return true;
  if (rule.id === 'priv-elevate' && /^ShellExecute[AW]$/.test(symbol)) {
    const verb = splitCallArguments(call.args)[1] ?? '';
    // A literal open/edit/print verb is not an elevation request.
    if (/^(?:L|u8|u|U)?"(?:open|edit|print|explore|find|properties)"$/i.test(verb)) return true;
  }
  return false;
}

function refineCall(call: CallSite, rule: Rule, symbol: string): Pick<Finding, 'severity' | 'category' | 'certainty' | 'title' | 'explanation' | 'recommendation'> | null {
  const args = call.args;
  if (rule.id === 'mem-other' && symbol === 'OpenProcess') {
    const flags = splitCallArguments(args)[0] ?? '';
    const readOnly = /\b(?:PROCESS_QUERY_LIMITED_INFORMATION|PROCESS_QUERY_INFORMATION|SYNCHRONIZE|PROCESS_VM_READ)\b/.test(flags);
    const modifying = /\b(?:PROCESS_ALL_ACCESS|PROCESS_VM_WRITE|PROCESS_VM_OPERATION|PROCESS_CREATE_THREAD|PROCESS_TERMINATE|PROCESS_SET_INFORMATION|PROCESS_SUSPEND_RESUME|WRITE_DAC|WRITE_OWNER|GENERIC_ALL)\b/.test(flags);
    if (readOnly && !modifying) return {
      severity: /\bPROCESS_VM_READ\b/.test(flags) ? 'medium' : 'info', category: 'Memory', certainty: 'detected',
      title: /\bPROCESS_VM_READ\b/.test(flags) ? 'Process memory read permission' : 'Process information access',
      explanation: /\bPROCESS_VM_READ\b/.test(flags)
        ? 'The mod requests permission to read another process memory. This call alone does not read it.'
        : 'The mod requests information or wait access to a running process. These flags do not request memory modification.',
      recommendation: 'Check which process is targeted and why the mod needs its status or details.',
    };
  }
  if (rule.id === 'priv-token') {
    if (symbol === 'OpenProcessToken') {
      const access = splitCallArguments(args)[1] ?? '';
      const change = /\b(?:TOKEN_ADJUST_PRIVILEGES|TOKEN_ADJUST_DEFAULT|TOKEN_ADJUST_SESSIONID|TOKEN_DUPLICATE|TOKEN_ALL_ACCESS|GENERIC_ALL)\b/.test(access);
      const query = /\bTOKEN_QUERY\b/.test(access);
      if (query && !change) return {
        severity: 'info', category: 'Privileges', certainty: 'detected',
        title: 'Windows permission check',
        explanation: 'The mod requests access to check Windows security permissions. This is not a request for administrator rights.',
        recommendation: 'Check why the mod reads the security settings of a process.',
      };
      if (change) return {
        severity: 'medium', category: 'Privileges', certainty: 'detected',
        title: 'Sensitive token access requested',
        explanation: 'The code requests permission to adjust or copy a security token. This alone does not change any privilege or prove that it succeeded.',
        recommendation: 'Check which permissions can be changed and why.',
      };
    }
    if (symbol === 'AdjustTokenPrivileges') return {
      severity: 'medium', category: 'Privileges', certainty: 'detected',
      title: 'Windows permission adjustment',
      explanation: 'The code contains a call that can enable or disable privileges in a security token. It does not prove that it succeeded.',
      recommendation: 'Check which privilege is changed and why the mod needs it.',
    };
  }
  if (rule.id === 'fs-create') {
    const parts = splitCallArguments(args);
    let access = '';
    if (/^(?:CreateFile[AW]|CreateFile2)$/.test(symbol)) access = parts[1] ?? '';
    else if (['fopen','_wfopen','_fsopen'].includes(symbol)) access = parts[1] ?? '';
    let read = /\b(?:GENERIC_READ|FILE_GENERIC_READ|FILE_READ_DATA|FILE_READ_ATTRIBUTES)\b/.test(access);
    let write = /\b(?:GENERIC_WRITE|FILE_GENERIC_WRITE|FILE_WRITE_DATA|FILE_APPEND_DATA|FILE_ALL_ACCESS|GENERIC_ALL)\b/.test(access);
    const mode = access.match(/^(?:L|u8|u|U)?"\s*([rwaxtbe+]+)(?:\s*,[^"]*)?"$/i)?.[1];
    if (mode) { read ||= mode.includes('r') || mode.includes('+'); write ||= /[wax+]/.test(mode); }
    if (read || write) return {
      severity: write ? 'medium' : 'low', category: 'File System', certainty: 'detected',
      title: read && write ? 'File/handle read and write access' : write ? 'File/handle write access' : 'File/handle read access',
      explanation: `The source requests ${read && write ? 'read and write' : write ? 'write' : 'read'} access to a file or handle. The call may not succeed; its target can also be a device or pipe.`,
      recommendation: 'Review the target path or device and how the opened handle is used.',
    };
  }
  if (rule.id === 'priv-elevate' && /^ShellExecute[AW]$/.test(symbol)) {
    const verb = splitCallArguments(args)[1] ?? '';
    if (/^(?:L|u8|u|U)?"runas"$/i.test(verb)) return {
      severity: 'medium', category: 'Privileges', certainty: 'detected',
      title: 'Explicit elevation verb',
      explanation: 'The call explicitly requests the runas verb, which can trigger a Windows elevation prompt.',
      recommendation: 'Verify the executable being elevated and why administrative access is requested.',
    };
  }
  if (rule.id === 'input-keys' && ['GetAsyncKeyState', 'GetKeyState'].includes(symbol)) {
    const m = args.trim().match(/^(VK_[A-Z0-9_]+|0x[0-9a-fA-F]+|\d+)$/);
    if (m) return {
      severity: 'info', category: 'Input & Shortcuts', certainty: 'detected',
      title: 'Specific key state check',
      explanation: `The mod checks the state of ${m[1]}. This can support a shortcut, cancellation or modifier check; it is not evidence of keylogging.`,
      recommendation: 'Confirm how the result is used. Look for collection or transmission of multiple keystrokes before calling it keylogging.',
    };
  }
  if (rule.id === 'dll-load') {
    if (/^LoadLibrary(?:Ex)?[AW]$/.test(symbol) && /LOAD_LIBRARY_SEARCH_SYSTEM32/.test(args) && /^\s*L?"[^"\\/:]+\.dll"\s*,/i.test(args)) {
      return {
        severity: 'info', category: 'Dynamic Loading', certainty: 'detected',
        title: 'System32 library loading',
        explanation: 'This call loads a named DLL using the System32-only search flag. It is common for Windows integration and is not an external download.',
        recommendation: 'Confirm the DLL is expected for the feature. The analysis does not verify the library contents at runtime.',
      };
    }
    if (symbol === 'GetProcAddress' && /(?:kernelBase|kernel32|hKernelBase|hKernel32)/i.test(args) && /"(?:LoadLibraryExW|LoadLibraryExA|GetProcAddress)"/.test(args)) {
      return {
        severity: 'info', category: 'Dynamic Loading', certainty: 'detected',
        title: 'Windows API resolution',
        explanation: 'The mod resolves a Windows loader function from a system module. This is a common compatibility or hooking technique.',
        recommendation: 'Review the use of the resolved function and the hook target, not the lookup alone.',
      };
    }
  }
  return null;
}

export function findingsFromCalls(calls: CallSite[]): Finding[] {
  const output: Finding[] = [];
  const seen = new Set<string>();
  for (const call of calls) {
    const symbol = normalizeSymbol(call.name);
    for (const rule of lookup.get(symbol) ?? []) {
      const key = `${rule.id}:${call.line}:${call.column}`;
      if (seen.has(key)) continue;
      if (shouldSuppress(call, rule, symbol)) continue;
      const refined = refineCall(call, rule, symbol);
      seen.add(key);
      output.push({
        id: key, ruleId: rule.id, category: refined?.category ?? rule.category, severity: refined?.severity ?? rule.severity,
        certainty: refined?.certainty ?? rule.certainty ?? 'detected', title: refined?.title ?? rule.title,
        explanation: refined?.explanation ?? rule.explanation, recommendation: refined?.recommendation ?? rule.recommendation,
        line: call.line, column: call.column, symbol,
        excerpt: call.excerpt.trim().slice(0, 350), arguments: call.args.slice(0, 500),
      });
    }
  }
  return output;
}

export function findingsFromMetadata(meta: ModMetadata): Finding[] {
  const findings: Finding[] = [];
  if (meta.includes.some(s => s === '*' || s === '*.exe' || s === '*.*')) {
    findings.push({
      id: 'meta:all-processes', ruleId: 'meta-all-processes', category: 'Metadata',
      severity: 'medium', certainty: 'detected', title: 'Broad process targeting',
      explanation: 'The mod declares a wildcard process scope. This can cause the mod to run in many processes, subject to exclusions and Windhawk settings.',
      recommendation: 'Review @include and @exclude entries and whether such broad targeting is required.',
      line: 0, column: 0, symbol: '@include', excerpt: meta.includes.join(', '),
    });
  }
  if (!meta.includes.length) {
    findings.push({
      id: 'meta:no-includes', ruleId: 'meta-no-includes', category: 'Metadata',
      severity: 'info', certainty: 'potential', title: 'No process scope declared',
      explanation: 'No @include entry was found in the Windhawk metadata block. The effective target scope cannot be determined here.',
      recommendation: 'Inspect mod metadata and the target process configuration.',
      line: 0, column: 0, symbol: '@include', excerpt: 'No @include lines found',
    });
  }
  return findings;
}
