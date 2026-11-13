export const CATEGORIES = [
  'Network', 'Downloads', 'Camera', 'Microphone', 'File System', 'Shell Integration', 'Registry', 'Process Execution',
  'Memory', 'Hooks & Injection', 'Persistence', 'Privileges',
  'Dynamic Loading', 'Input & Shortcuts', 'Sensitive Data', 'Metadata',
] as const;
export type Category = typeof CATEGORIES[number];
export type Severity = 'info' | 'low' | 'medium' | 'high';
export type Certainty = 'detected' | 'potential';
export type Coverage = 'ast' | 'hybrid' | 'lexical';
export interface Finding {
  id: string;
  ruleId: string;
  category: Category;
  severity: Severity;
  certainty: Certainty;
  title: string;
  explanation: string;
  recommendation: string;
  line: number;
  column: number;
  symbol: string;
  excerpt: string;
  arguments?: string;
}
export interface ModMetadata {
  id?: string;
  name?: string;
  version?: string;
  author?: string;
  includes: string[];
  excludes: string[];
  architectures: string[];
  compilerOptions: string[];
}
export interface ParserDiagnostics {
  visitedNodes: number;
  callExpressions: number;
  analyzedCalls: number;
  syntaxErrorNodes: number;
  missingNodes: number;
  /** Characters covered by Tree-sitter ERROR nodes, with overlapping spans merged. */
  errorSpanCharacters?: number;
  /** Distinct lines touched by ERROR nodes or missing tokens. */
  errorAffectedLines?: number;
  /** Source length in JavaScript characters, matching the parser's node offsets. */
  sourceCharacters?: number;
  sampledIssueLines: number[];
  truncated: boolean;
  lexicalSupplementCalls?: number;
}
export interface FindingGroup {
  id: string;
  finding: Finding;
  occurrences: Finding[];
}
export interface ScanReport {
  schemaVersion: 1;
  engineVersion: string;
  filename: string;
  analyzedAt: string;
  sha256: string;
  sourceLines: number;
  coverage: Coverage;
  diagnostics?: ParserDiagnostics;
  limitations: string[];
  metadata: ModMetadata;
  findings: Finding[];
}
export interface CallSite { name: string; line: number; column: number; args: string; excerpt: string; }
export interface ParseResult { calls: CallSite[]; coverage: Coverage; limitations: string[]; diagnostics?: ParserDiagnostics; }
