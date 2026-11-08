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
  { id: 'reg-read', symbols: ['RegQueryValueExA','RegQueryValueExW','RegGetValueA','RegGetValueW','RegEnumKeyExA','RegEnumKeyExW'], category: 'Registry', severity: 'low', title: 'Registry read', explanation: 'The code reads Windows Registry values or enumerates keys.', recommendation: 'Check the accessed keys and whether they contain sensitive settings.' },
  { id: 'reg-write', symbols: ['RegSetValueExA','RegSetValueExW','RegCreateKeyExA','RegCreateKeyExW','RegDeleteValueA','RegDeleteValueW','RegDeleteKeyA','RegDeleteKeyW','RegDeleteTreeA','RegDeleteTreeW'], category: 'Registry', severity: 'medium', title: 'Registry modification', explanation: 'The source can create, edit or remove Registry data.', recommendation: 'Check target keys and persistence or system configuration implications.' },
  { id: 'exec-process', symbols: ['CreateProcessA','CreateProcessW','CreateProcessAsUserA','CreateProcessAsUserW','WinExec','ShellExecuteA','ShellExecuteW','ShellExecuteExA','ShellExecuteExW','system','_wsystem','_popen','_wpopen'], category: 'Process Execution', severity: 'high', title: 'External process execution', explanation: 'The mod includes a way to start another program or execute a shell command.', recommendation: 'Inspect the executable, arguments, user input and execution conditions.' },
  { id: 'exec-com', symbols: ['CoCreateInstance','CoGetClassObject'], category: 'Process Execution', severity: 'low', title: 'COM object activation', explanation: 'COM activation may create an in-process or out-of-process component. It is not necessarily process execution.', recommendation: 'Identify the COM class and expected role.', certainty: 'potential' },
  { id: 'mem-other', symbols: ['OpenProcess','ReadProcessMemory','WriteProcessMemory','VirtualProtectEx','VirtualAllocEx','VirtualFreeEx'], category: 'Memory', severity: 'medium', title: 'Cross-process memory operation', explanation: 'The code requests a process handle or performs a memory operation that may affect another process.', recommendation: 'Check targeted PIDs, access rights and memory operations.', certainty: 'potential' },
  { id: 'mem-inject', symbols: ['CreateRemoteThread','CreateRemoteThreadEx','NtCreateThreadEx','QueueUserAPC','NtQueueApcThread'], category: 'Hooks & Injection', severity: 'high', title: 'Remote execution primitive', explanation: 'The code contains an API frequently used for executing code in another process.', recommendation: 'Verify the intended target and why remote execution is needed.' },
  { id: 'hook-windhawk', symbols: ['Wh_SetFunctionHook','Wh_SetFunctionHookT','Wh_RemoveFunctionHook'], category: 'Hooks & Injection', severity: 'info', title: 'Windhawk hook', explanation: 'This is a normal Windhawk modding capability. A hook alone is not evidence of malicious behavior.', recommendation: 'Review which function is hooked and whether the modification matches the mod description.' },
  { id: 'hook-other', symbols: ['SetWindowsHookExA','SetWindowsHookExW','DetourAttach','MH_CreateHook','MinHook'], category: 'Hooks & Injection', severity: 'low', title: 'Function or Windows hook', explanation: 'This code can install a hook that changes or observes function/event behavior.', recommendation: 'Review the hooked target and data handled by the callback.' },
  { id: 'persist-service', symbols: ['CreateServiceA','CreateServiceW','ChangeServiceConfigA','ChangeServiceConfigW'], category: 'Persistence', severity: 'high', title: 'Windows service configuration', explanation: 'The source can create or change a Windows service, which can enable persistence.', recommendation: 'Check the service name, executable and start mode.' },
  { id: 'persist-task', symbols: ['SchRpcRegisterTask','RegisterTask','RegisterTaskDefinition'], category: 'Persistence', severity: 'high', title: 'Scheduled task registration', explanation: 'The code may register a task that runs automatically.', recommendation: 'Review the task trigger, action and account.', certainty: 'potential' },
  { id: 'priv-token', symbols: ['AdjustTokenPrivileges','OpenProcessToken','SetTokenInformation','DuplicateTokenEx'], category: 'Privileges', severity: 'medium', title: 'Access token operation', explanation: 'The code manipulates or inspects security access tokens.', recommendation: 'Check which privileges are requested and whether elevation is necessary.', certainty: 'potential' },
  { id: 'priv-elevate', symbols: ['ShellExecuteA','ShellExecuteW','ShellExecuteExA','ShellExecuteExW'], category: 'Privileges', severity: 'medium', title: 'Potential elevation request', explanation: 'ShellExecute can request elevation when passed the runas verb; the call itself does not prove elevation.', recommendation: 'Check whether the verb is runas and whether an elevation prompt is expected.', certainty: 'potential' },
  { id: 'dll-load', symbols: ['LoadLibraryA','LoadLibraryW','LoadLibraryExA','LoadLibraryExW','GetProcAddress','LdrLoadDll','LdrGetProcedureAddress'], category: 'Dynamic Loading', severity: 'medium', title: 'Dynamic code or API loading', explanation: 'The code loads a library or obtains an API address dynamically. Indirect calls may not be fully traceable.', recommendation: 'Verify the library path and resolved export names.', certainty: 'potential' },
  { id: 'cred-win', symbols: ['CredReadA','CredReadW','CredEnumerateA','CredEnumerateW','LsaRetrievePrivateData','CryptUnprotectData','PFXImportCertStore'], category: 'Sensitive Data', severity: 'high', title: 'Sensitive data or credential API', explanation: 'The source uses APIs that can access protected data, credentials or certificate material.', recommendation: 'Review exactly what data is accessed and whether it leaves the device.', certainty: 'potential' },
  { id: 'input-keys', symbols: ['GetAsyncKeyState','GetKeyState','GetKeyboardState','SetWindowsHookExA','SetWindowsHookExW'], category: 'Sensitive Data', severity: 'low', title: 'Keyboard state or event access', explanation: 'The code can inspect keyboard state or install a Windows event hook. This is common for shortcuts and does not prove keylogging.', recommendation: 'Inspect callbacks and any storage or transmission of input.', certainty: 'potential' },
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

export function findingsFromCalls(calls: CallSite[]): Finding[] {
  const output: Finding[] = [];
  const seen = new Set<string>();
  for (const call of calls) {
    const symbol = normalizeSymbol(call.name);
    for (const rule of lookup.get(symbol) ?? []) {
      const key = `${rule.id}:${call.line}:${call.column}`;
      if (seen.has(key)) continue;
      seen.add(key);
      output.push({
        id: key, ruleId: rule.id, category: rule.category, severity: rule.severity,
        certainty: rule.certainty ?? 'detected', title: rule.title,
        explanation: rule.explanation, recommendation: rule.recommendation,
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
