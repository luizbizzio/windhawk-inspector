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
    title: 'Uses Windows components',
    meaning: 'Looks up Windows functions and opens system components.',
    why: 'A dock or taskbar mod often needs these functions. The specific names are listed below.',
    next: 'Make sure the functions fit the mod’s features.',
  },
  'extra-libraries': {
    title: 'Loads software libraries',
    meaning: 'Can load a DLL, a file that adds features to a program.',
    why: 'Where the library comes from matters. A built-in Windows DLL is different from an unknown download.',
    next: 'Check the library name and where it is loaded from.',
  },
  'process-details': {
    title: 'Checks running apps',
    meaning: 'Requests basic details about other programs, such as their process IDs.',
    why: 'This can help show running apps and their icons. The detected access flags do not request memory changes.',
    next: 'Check which programs are being queried.',
  },
  'process-memory': {
    title: 'Can access another app’s memory',
    meaning: 'Requests access to memory belonging to another running program.',
    why: 'Some customization tools need this, but it is more sensitive than checking which apps are open.',
    next: 'Which program is targeted, and what data is read or changed?',
  },
  'permission-checks': {
    title: 'Checks Windows permissions',
    meaning: 'Reads information about the permissions a program has.',
    why: 'Checking permissions is not the same as requesting administrator access.',
    next: 'Check why those permissions are being read.',
  },
  'permission-changes': {
    title: 'Can change Windows permissions',
    meaning: 'Uses functions that can enable or adjust security privileges.',
    why: 'The source shows a capability, not whether permission changes succeeded.',
    next: 'Which privilege is requested, and is it needed for the mod?',
  },
  'shortcut-checks': {
    title: 'Checks keys and mouse buttons',
    meaning: 'Reads the state of specific keys or mouse buttons.',
    why: 'This is common for shortcuts and dragging. These checks alone do not show that typing is being recorded.',
    next: 'Check which keys the mod uses.',
  },
  'input-hooks': {
    title: 'Can listen for input events',
    meaning: 'Uses callbacks for keyboard, mouse or window events.',
    why: 'The event handler decides what data is actually used or saved.',
    next: 'What events are captured, and is any information stored or sent?',
  },
  'files-read': {
    title: 'Reads files or data',
    meaning: 'Reads from an open file, pipe or other data source.',
    why: 'Mods may do this for icons, images or settings. The code reference does not identify private files by itself.',
    next: 'Which files or handles are read?',
  },
  'files-write': {
    title: 'Can write files or data',
    meaning: 'Can save or change data through an open file or handle.',
    why: 'Saving settings can be normal. The destination determines what might be affected.',
    next: 'Which file or location receives the data?',
  },
  'files-open': {
    title: 'Opens local files',
    meaning: 'Opens files, but the detected call does not show whether they are read or changed.',
    why: 'The access mode may be stored in a variable and decided while the mod runs.',
    next: 'Check the file path and whether it is opened for reading or writing.',
  },
  'files-delete': {
    title: 'Can delete files',
    meaning: 'Contains a function that can remove files.',
    why: 'Cleaning temporary files may be expected. Deleting personal files would be different.',
    next: 'Which files could be deleted?',
  },
  'network': {
    title: 'Can connect to the internet',
    meaning: 'Uses networking functions to communicate with other computers.',
    why: 'This might be an update check. A network function does not prove anything was sent.',
    next: 'Which website or server is contacted, and what is sent?',
  },
  'downloads': {
    title: 'Can download files',
    meaning: 'Uses functions that can fetch content from the internet.',
    why: 'Downloading an icon differs from downloading a program that can run.',
    next: 'What is downloaded, from where, and does it run afterward?',
  },
  'registry': {
    title: 'Accesses Windows settings',
    meaning: 'Uses the Registry, where Windows and apps store configuration.',
    why: 'Reading a setting is different from changing it.',
    next: 'Which Registry entries are read or changed?',
  },
  'run-programs': {
    title: 'Can start other programs',
    meaning: 'Uses a function that can launch another program.',
    why: 'Opening Windows Settings may be expected. Starting an unknown file needs closer review.',
    next: 'Which program is launched and where does it come from?',
  },
  'hooks': {
    title: 'Changes how Windows works',
    meaning: 'Hooks Windows or app functions to change their behavior.',
    why: 'This is how many Windhawk mods work. The target function matters.',
    next: 'Which functions are changed?',
  },
  'sensitive-data': {
    title: 'Can handle protected data',
    meaning: 'Uses functions that can access saved credentials or protected information.',
    why: 'Whether it exposes private information depends on which data is used and where it goes.',
    next: 'What data is accessed, stored or sent?',
  },
  'startup': {
    title: 'Can add startup tasks',
    meaning: 'Contains functions that can register a service or scheduled task.',
    why: 'A task could start a program automatically.',
    next: 'What starts automatically, and when?',
  },
  'scope': {
    title: 'Can run in many programs',
    meaning: 'The mod lists a broad set of programs where it can run.',
    why: 'A wider scope affects more programs than a single-app mod.',
    next: 'Which programs are included?',
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
const INFORMATION_ONLY = new Set(['windows-components', 'process-details', 'permission-checks', 'shortcut-checks', 'files-read', 'files-open', 'hooks']);
export function buildInsights(report: Pick<ScanReport, 'findings'>): PlainInsight[] {
  const groups = new Map<string, PlainInsight>();
  for (const finding of report.findings) {
    const id = insightId(finding);
    const copy = DESCRIPTIONS[id] ?? {
      title: finding.title,
      meaning: finding.explanation,
      why: 'This is a function call in the source. It does not show what happened while the mod was running.',
      next: finding.recommendation,
    };
    let item = groups.get(id);
    if (!item) {
      item = { id, ...copy, priority: 'note', severity: 'info', findings: [] };
      groups.set(id, item);
    }
    item.findings.push(finding);
    if (order.indexOf(finding.severity) > order.indexOf(item.severity)) item.severity = finding.severity;
    if (!INFORMATION_ONLY.has(id) && (finding.severity === 'medium' || finding.severity === 'high')) item.priority = 'review';
  }
  return [...groups.values()].sort((a,b) =>
    (a.priority==='review'?0:1) - (b.priority==='review'?0:1) ||
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

/** These figures describe Tree-sitter recovery, not whether the mod compiles or is safe.
 *  Old reports without regional metrics stay conservative.
 */
export function parserIssueImpact(report: Pick<ScanReport,'diagnostics'> & Partial<Pick<ScanReport,'sourceLines'>>):
  'none' | 'minor' | 'significant' | 'unknown' {
  const d = report.diagnostics;
  if (!d || d.syntaxErrorNodes + d.missingNodes === 0) return 'none';
  if (!report.sourceLines || !d.sourceCharacters ||
      d.errorAffectedLines === undefined || d.errorSpanCharacters === undefined) return 'unknown';
  const affected = d.errorAffectedLines / report.sourceLines;
  const characters = d.errorSpanCharacters / d.sourceCharacters;
  const eventDensity = (d.syntaxErrorNodes + d.missingNodes) / report.sourceLines;
  return affected >= .02 || characters >= .02 || eventDensity >= .03 ? 'significant' : 'minor';
}

export function parserGapDetail(report: Pick<ScanReport,'diagnostics'> & Partial<Pick<ScanReport,'sourceLines'>>): string | null {
  const d = report.diagnostics;
  if (!d || d.errorAffectedLines === undefined || !report.sourceLines) return null;
  const percent = (100 * d.errorAffectedLines / report.sourceLines).toFixed(2);
  return `${d.errorAffectedLines.toLocaleString('en-US')} of ${report.sourceLines.toLocaleString('en-US')} lines (${percent}%) include parser recovery marks`;
}

export function coverageSummary(report: Pick<ScanReport,'coverage'|'diagnostics'|'limitations'> & Partial<Pick<ScanReport,'sourceLines'>>): {
  kind: 'caution' | 'normal' | 'note'; title: string; explanation: string;
} {
  if (report.coverage === 'hybrid') return {
    kind:'caution', title:'Part of the scan was limited',
    explanation:'The detailed scan stopped early. A text search checked the whole file, but it can miss or misidentify calls.',
  };
  if (report.coverage === 'lexical') return {
    kind:'caution', title:'Text scan only',
    explanation:'The scanner searched for known function names. Some actions may be missed.',
  };
  if (report.diagnostics?.truncated) return {
    kind:'caution', title:'Scan stopped early',
    explanation:'The scanner reached an inspection limit before finishing. Some findings may be missing.',
  };
  const impact = parserIssueImpact(report);
  if (impact === 'significant' || impact === 'unknown') return {
    kind:'caution', title:'Parts of the code were unclear',
    explanation: impact === 'unknown'
      ? 'The parser found uncertain code, but this report has no measurements of how much was affected. It does not mean the mod cannot compile.'
      : 'The parser could not fully interpret a noticeable part of this file. Some calls may be missed. This is not a compiler error report.',
  };
  if (impact === 'minor') return {
    kind:'note', title:'Scan finished',
    explanation:'A small part of the code was unclear to the parser. See technical details. This does not mean the mod has errors.',
  };
  return {kind:'normal', title:'Scan finished',
    explanation:'No scan limits were reached. This still cannot show everything the mod does when it runs.'};
}
