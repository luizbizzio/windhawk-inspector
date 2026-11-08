import type { CallSite, ParseResult } from './types';
import { findLexicalCalls, MAX_LEXICAL_CALLS } from './lexical';
import { isTrackedCall, normalizeSymbol } from './rules';

/** Supplement a truncated syntax scan using an explicitly less precise text scan.
 *  Preserve the diagnostic that the AST did not finish; never claim full coverage.
 */
export function supplementTruncatedAst(source: string, parsed: ParseResult): ParseResult {
  if (!parsed.diagnostics?.truncated) return parsed;
  const extra = findLexicalCalls(source, isTrackedCall);
  // Match each AST occurrence to at most one lexical occurrence. This avoids
  // dropping two distinct calls with the same name on one source line.
  const signature = (c: CallSite) => `${c.line}:${normalizeSymbol(c.name)}:${c.args.replace(/\s+/g, ' ').trim()}`;
  const counts = new Map<string,number>();
  for (const call of parsed.calls) {
    const sig = signature(call);
    counts.set(sig,(counts.get(sig) ?? 0)+1);
  }
  let added = 0;
  for (const call of extra) {
    const sig = signature(call);
    const existing = counts.get(sig) ?? 0;
    if (existing) {counts.set(sig,existing-1);continue;}
    parsed.calls.push(call);
    added++;
  }
  parsed.calls.sort((a,b) => a.line-b.line || a.column-b.column);
  parsed.coverage = 'hybrid';
  parsed.diagnostics.lexicalSupplementCalls = added;
  parsed.limitations.push('The syntax parser stopped at an inspection limit. A less precise text scan supplemented the entire source, including later lines. This is not a complete C++ analysis.');
  if (extra.length >= MAX_LEXICAL_CALLS) parsed.limitations.push('The text scan reached its 10,000-call limit, so later matching APIs may still be missed.');
  return parsed;
}
