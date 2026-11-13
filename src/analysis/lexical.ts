import type { CallSite } from './types';

export const MAX_LEXICAL_CALLS = 10_000;

/** Masks comments and string/character literals, preserving offsets and line breaks.
 *  This is a limited fallback, not an alternative C++ semantic parser.
 */
export function maskNonCode(source: string): string {
  // Emit entire code spans, not one-character string concatenations. The latter
  // can exhaust browser memory when scanning multi-megabyte C++ files.
  const parts: string[] = [];
  const blank = (span: string) => span.replace(/[^\r\n]/g, ' ');
  let i = 0;
  let codeStart = 0;
  const hide = (end: number) => {
    if (i > codeStart) parts.push(source.slice(codeStart, i));
    parts.push(blank(source.slice(i, end)));
    i = end;
    codeStart = end;
  };
  while (i < source.length) {
    if (source.startsWith('//', i)) {
      let end = source.indexOf('\n', i);
      if (end === -1) end = source.length;
      hide(end);
      continue;
    }
    if (source.startsWith('/*', i)) {
      let end = source.indexOf('*/', i + 2);
      end = end < 0 ? source.length : end + 2;
      hide(end);
      continue;
    }
    // C++ raw string: R"delimiter(content)delimiter" (also supports encoding prefixes).
    if (source[i] === 'R' && source[i + 1] === '"') {
      const opening = source.slice(i, i + 20).match(/^R"([^()\\\s]{0,16})\(/);
      if (opening) {
        const closing = ')' + opening[1] + '"';
        let end = source.indexOf(closing, i + opening[0].length);
        end = end < 0 ? source.length : end + closing.length;
        hide(end);
        continue;
      }
    }
    if (source[i] === '"' || source[i] === "'") {
      const quote = source[i];
      let end = i + 1;
      while (end < source.length) {
        if (source[end] === '\\') { end += 2; continue; }
        if (source[end++] === quote) break;
      }
      hide(Math.min(end, source.length));
      continue;
    }
    i++;
  }
  if (codeStart < source.length) parts.push(source.slice(codeStart));
  return parts.join('');
}

export function findLexicalCalls(source: string, onlyTracked?: (name: string) => boolean): CallSite[] {
  const masked = maskNonCode(source);
  const lines = source.split(/\r?\n/);
  const calls: CallSite[] = [];
  const pattern = /\b(?:[A-Za-z_]\w*\s*(?:::|->|\.)\s*)*[A-Za-z_]\w*\s*\(/g;
  const offsets = [0];
  for (let i=0; i<source.length; i++) if (source[i] === '\n') offsets.push(i+1);
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(masked)) && calls.length < MAX_LEXICAL_CALLS) {
    const name = match[0].slice(0, -1).trim();
    // On large files inspect every call position, not just the first 10,000
    // unrelated C++ functions. Count only relevant APIs toward the cap.
    if (onlyTracked && !onlyTracked(name)) continue;
    const position = match.index;
    let lo = 0, hi = offsets.length - 1;
    while (lo <= hi) { const mid = (lo + hi) >>> 1; if (offsets[mid] <= position) lo = mid + 1; else hi = mid - 1; }
    const row = hi;
    const start = position + match[0].length;
    let end = start;
    let depth = 1;
    while (end < masked.length && depth > 0 && end - start < 5000) {
      if (masked[end] === '(') depth++;
      else if (masked[end] === ')') depth--;
      end++;
    }
    calls.push({
      name, line: row+1,
      column: position - offsets[row] + 1,
      args: source.slice(start, depth === 0 ? end-1 : end),
      excerpt: lines[row] ?? '',
    });
  }
  return calls;
}
