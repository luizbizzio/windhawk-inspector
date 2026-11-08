import type { Finding, ScanReport, Severity } from './types';

export interface PlainInsight {
  id: string;
  title: string;
  meaning: string;
  why: string;
  next: string;
  priority: 'review' | 'note';
  severity: Severity;
  findings: Finding[];
}

interface Description { title: string; meaning: string; why: string; next: string; }

// Explain what a call allows, not what the mod actually does at runtime.
// Fixed, reviewed language is intentionally used instead of speculative AI summaries.
const DESCRIPTIONS: Record<string, Description> = {
  'windows-components': {
    title: 'Uses Windows features and components',
    meaning: 'The mod looks up Windows functions or opens built-in system components.',
    why: 'Mods often do this to work with the taskbar, images and other Windows features. It does not mean the mod downloaded another program.',
    next: 'Check whether these Windows features fit what the mod says it does.',
  },
  'extra-libraries': {
    title: 'May load extra software libraries',
    meaning: 'The source contains a call that may open a DLL library.',
    why: 'The DLL file and its location matter. A Windows library and an unknown file from the internet are not the same.',
    next: 'Check which DLL is loaded and where it comes from.',
  },
  'process-details': {
    title: 'Checks other running programs',
    meaning: 'The mod requests basic information or wait access for another process.',
    why: 'This can help show running apps or their icons. The shown access flags do not request permission to change another program’s memory.',
    next: 'Check whether the mod needs to identify or monitor other running apps.',
  },
  'process-memory': {
    title: 'May read or change another program’s memory',
    meaning: 'The code includes operations or permissions that can access another program’s memory.',
    why: 'This is more sensitive than simply checking which apps are running. It may be needed for customization, but deserves review.',
    next: 'Check the target program and what data the code reads or changes.',
  },
  'permission-checks': {
    title: 'Checks Windows permissions',
    meaning: 'The mod reads security permission information.',
    why: 'Reading permission information is not the same as requesting administrator access.',
    next: 'Check why the mod needs to know a process’s permissions.',
  },
  'permission-changes': {
    title: 'May adjust Windows permissions',
    meaning: 'The code requests access or uses functions that can change security privileges.',
    why: 'Changes to permissions deserve attention. Finding the function does not prove that a permission was changed or that the call succeeded.',
    next: 'Check which permission could change and why the mod needs it.',
  },
  'shortcut-checks': {
    title: 'Checks keyboard shortcuts or mouse buttons',
    meaning: 'The code checks whether a particular key or mouse button is pressed.',
    why: 'This is common for shortcuts and drag gestures. These calls alone are not evidence of recording everything you type.',
    next: 'Check whether the keys match the controls described by the mod.',
  },
  'input-hooks': {
    title: 'May monitor keyboard or window events',
    meaning: 'The source includes functions that can receive input or Windows events.',
    why: 'Event hooks can be normal, but their callbacks determine what information is collected.',
    next: 'Check which events are handled and whether input is saved or sent anywhere.',
  },
  'files-read': {
    title: 'May read files or stored data',
    meaning: 'The code reads from a file or another open data handle.',
    why: 'Reading a file may be needed for settings, icons or images. A read handle is not proof of access to private files.',
    next: 'Check which file path or handle is used and why.',
  },
  'files-write': {
    title: 'May create or change files',
    meaning: 'The code includes functions that can write data to a file or handle.',
    why: 'Saving settings and temporary images is common. The destination matters, especially for system or personal files.',
    next: 'Check which files are created or changed and whether that is expected.',
  },
  'files-open': {
    title: 'May open local files',
    meaning: 'The mod contains a file-open operation, but its access mode is not clear from this match.',
    why: 'The file may be opened for reading, writing or both. The name and mode need checking.',
    next: 'Check the file name and access mode in the source.',
  },
  'files-delete': {
    title: 'May delete files',
    meaning: 'The source contains a file deletion operation.',
    why: 'Deleting temporary files may be normal, but deleting user files would be important.',
    next: 'Check which files could be deleted and why.',
  },
  'network': {
    title: 'May connect to the internet',
    meaning: 'The source includes networking functions that can communicate with other computers.',
    why: 'An update check or online service could explain this. A network API alone does not prove data was sent.',
    next: 'Look for the website or server address and the type of data exchanged.',
  },
  'downloads': {
    title: 'May download content',
    meaning: 'The mod contains functions used to receive data or files from the internet.',
    why: 'Downloading icons or updates can be useful. Downloading and running executable files would need more care.',
    next: 'Check the download address, destination and whether downloaded files are executed.',
  },
  'registry': {
    title: 'May read or change Windows settings',
    meaning: 'The code accesses the Windows Registry, where many apps store settings.',
    why: 'Reading an app setting is different from changing the system configuration.',
    next: 'Check which Registry keys are used and whether they are only read or also changed.',
  },
  'run-programs': {
    title: 'May start other programs',
    meaning: 'The code includes calls used to open or run another process.',
    why: 'Some mods open Settings or helper tools. The name and source of the program matter.',
    next: 'Check which program starts and whether the user expects it.',
  },
  'hooks': {
    title: 'Changes how Windows functions work',
    meaning: 'The mod contains Windows or Windhawk function hooks.',
    why: 'Function hooks are a normal part of Windhawk mods. The affected function determines what changes.',
    next: 'Check that the functions being changed match the mod description.',
  },
  'sensitive-data': {
    title: 'May access protected information',
    meaning: 'The code includes Windows functions that can handle credentials or protected data.',
    why: 'This could expose sensitive information depending on the target and how the data is handled.',
    next: 'Check which data is accessed and whether it is stored or transmitted.',
  },
  'startup': {
    title: 'May change automatic startup',
    meaning: 'The source includes ways to register a service or a scheduled task.',
    why: 'This can make a program start automatically. That should match the mod’s purpose.',
    next: 'Check the program, startup trigger and account that would be used.',
  },
  'scope': {
    title: 'May run inside many programs',
    meaning: 'The Windhawk metadata allows this mod to run in a broad set of processes.',
    why: 'A broad scope can have more impact than changing one selected app.',
    next: 'Check the list of programs the mod targets.',
  },
};

/** Place related APIs into one user-facing capability. Raw findings are never removed. */
export function insightId(f: Finding): string {
  if (f.ruleId === 'mem-other') {
    const flags = (f.arguments ?? '').split(',')[0];
    const queryOnly = f.symbol === 'OpenProcess' && /\b(?:PROCESS_QUERY_LIMITED_INFORMATION|PROCESS_QUERY_INFORMATION|SYNCHRONIZE)\b/.test(flags) && !/\b(?:PROCESS_VM_READ|PROCESS_VM_WRITE|PROCESS_VM_OPERATION|PROCESS_ALL_ACCESS|PROCESS_TERMINATE|PROCESS_CREATE_THREAD)\b/.test(flags);
    return f.title === 'Process information access' || queryOnly ? 'process-details' : 'process-memory';
  }
  if (f.ruleId === 'priv-token') {
    const access = (f.arguments ?? '').split(',')[1] ?? '';
    const queryOnly = f.symbol === 'OpenProcessToken' && /\bTOKEN_QUERY\b/.test(access) && !/\b(?:TOKEN_DUPLICATE|TOKEN_ADJUST_PRIVILEGES|TOKEN_ADJUST_DEFAULT|TOKEN_ALL_ACCESS)\b/.test(access);
    return f.title === 'Windows permission check' || queryOnly ? 'permission-checks' : 'permission-changes';
  }
  if (f.ruleId === 'dll-load') return f.symbol === 'GetProcAddress' || f.title === 'Windows API resolution' || f.title === 'System32 library loading'
    ? 'windows-components' : 'extra-libraries';
  if (f.ruleId === 'exec-com') return 'windows-components';
  if (f.ruleId === 'input-keys') return f.title === 'Specific key state check' ? 'shortcut-checks' : 'input-hooks';
  if (f.ruleId === 'fs-create') {
    if (/write/i.test(f.title)) return 'files-write';
    if (/read/i.test(f.title) || /^(?:L|u8|u|U)?"r[a-z]*[,"]/.test((f.arguments ?? '').split(',').slice(1).join(',').trim())) return 'files-read';
    return 'files-open';
  }
  if (f.ruleId === 'fs-read') return 'files-read';
  if (f.ruleId === 'fs-write') return 'files-write';
  if (f.ruleId === 'fs-delete') return 'files-delete';
  if (f.ruleId.startsWith('net-')) return 'network';
  if (f.ruleId.startsWith('dl-')) return 'downloads';
  if (f.ruleId.startsWith('reg-')) return 'registry';
  if (f.ruleId.startsWith('exec-')) return 'run-programs';
  if (f.ruleId.startsWith('hook-') || f.ruleId.startsWith('mem-inject')) return 'hooks';
  if (f.ruleId.startsWith('cred-')) return 'sensitive-data';
  if (f.ruleId.startsWith('persist-')) return 'startup';
  if (f.ruleId.startsWith('meta-')) return 'scope';
  if (f.ruleId === 'priv-elevate') return 'permission-changes';
  return `other:${f.ruleId}`;
}

const order: Severity[] = ['info', 'low', 'medium', 'high'];
export function buildInsights(report: Pick<ScanReport, 'findings'>): PlainInsight[] {
  const groups = new Map<string, PlainInsight>();
  for (const finding of report.findings) {
    const id = insightId(finding);
    const copy = DESCRIPTIONS[id] ?? {
      title: finding.title,
      meaning: finding.explanation,
      why: 'The source contains this function, but that does not prove what happens when the mod runs.',
      next: finding.recommendation,
    };
    let item = groups.get(id);
    if (!item) {
      item = { id, ...copy, priority: 'note', severity: 'info', findings: [] };
      groups.set(id, item);
    }
    item.findings.push(finding);
    if (order.indexOf(finding.severity) > order.indexOf(item.severity)) item.severity = finding.severity;
    if (finding.severity === 'medium' || finding.severity === 'high') item.priority = 'review';
  }
  return [...groups.values()].sort((a,b) =>
    order.indexOf(b.severity) - order.indexOf(a.severity) || a.title.localeCompare(b.title));
}

const KEY_LABELS: Record<string,string> = {
  VK_LBUTTON:'Left mouse button', VK_RBUTTON:'Right mouse button', VK_SHIFT:'Shift',
  VK_CONTROL:'Ctrl', VK_MENU:'Alt', VK_ESCAPE:'Escape', VK_LWIN:'Left Windows key',
  VK_RWIN:'Right Windows key', VK_RETURN:'Enter', VK_TAB:'Tab', VK_SPACE:'Space',
};

/** Human-readable clue extracted from source arguments, never a claim of runtime behavior. */
export function evidenceLabel(f: Finding): string {
  if (f.symbol === 'GetProcAddress') {
    const all = [...(f.arguments ?? '').matchAll(/"([\w@.\-]{2,100})"/g)];
    if (all.length) return `Looks up ${all.at(-1)![1]}`;
  }
  if (f.symbol === 'CoCreateInstance' || f.symbol === 'CoGetClassObject') {
    const name = (f.arguments ?? '').match(/(?:k?CLSID_|__uuidof\()([\w]+)/)?.[1];
    if (name) return `Opens the ${name} component`;
  }
  if (f.ruleId === 'input-keys' && f.title === 'Specific key state check') {
    const k = (f.arguments ?? '').trim();
    return `Checks ${KEY_LABELS[k] ?? k}`;
  }
  if (f.symbol === 'OpenProcess') {
    const flags = (f.arguments ?? '').split(',')[0].trim();
    return flags ? `Requests ${flags}` : 'Opens a process handle';
  }
  if (f.symbol === 'OpenProcessToken') {
    const access = (f.arguments ?? '').split(',')[1]?.trim();
    return access ? `Requests ${access}` : 'Opens a security token';
  }
  if (f.symbol === 'AdjustTokenPrivileges') return 'Adjusts a security privilege';
  if (f.symbol === '_wfopen' || f.symbol === 'fopen') return 'Opens a file with a specified access mode';
  if (f.ruleId === 'fs-write') return 'Writes to an open file or data handle';
  if (f.ruleId === 'fs-read') return 'Reads from an open file or data handle';
  return f.symbol;
}

export interface EvidenceRow { label: string; locations: Finding[]; }
export function groupEvidence(findings: Finding[]): EvidenceRow[] {
  const seen = new Map<string, EvidenceRow>();
  for (const finding of findings) {
    const label = evidenceLabel(finding);
    const key = `${finding.symbol}|${label}|${finding.title}`;
    let row = seen.get(key);
    if (!row) {
      row = {label, locations: []};
      seen.set(key,row);
    }
    row.locations.push(finding);
  }
  return [...seen.values()].sort((a,b) => b.locations.length - a.locations.length || a.label.localeCompare(b.label));
}

export function coverageSummary(report: Pick<ScanReport,'coverage'|'diagnostics'|'limitations'>): {
  kind: 'caution' | 'normal'; title: string; explanation: string;
} {
  if (report.coverage === 'hybrid') return {
    kind:'caution', title:'Some code could not be fully checked',
    explanation:'The detailed C++ scan reached a limit. A basic text scan also searched the full file, but it can miss behavior or report extra matches.',
  };
  if (report.coverage === 'lexical') return {
    kind:'caution', title:'Basic check only',
    explanation:'The tool looked for known function names, not the full meaning of the C++ code. Some actions may be missed.',
  };
  if (report.diagnostics?.truncated) return {
    kind:'caution', title:'Part of the code was not checked',
    explanation:'The analyzer reached its inspection limit before finishing. The findings below are incomplete.',
  };
  if ((report.diagnostics?.syntaxErrorNodes ?? 0) + (report.diagnostics?.missingNodes ?? 0) > 0) return {
    kind:'caution', title:'Checked with some parsing gaps',
    explanation:'Parts of the C++ code were hard to interpret. Some actions may be missed.',
  };
  return {kind:'normal', title:'Source check finished',
    explanation:'The source scan finished without hitting its limits. This still cannot prove that the mod is safe.'};
}
