import type { CallSite } from './types';

/** Masks comments and string/character literals, preserving offsets and line breaks.
 *  This is a limited fallback, not an alternative C++ semantic parser.
 */
export function maskNonCode(source: string): string {
  let result = '';
  let i = 0;
  const blank = (s: string) => s.replace(/[^\r\n]/g, ' ');
  while (i < source.length) {
    if (source.startsWith('//', i)) {
      let j = source.indexOf('\n', i); if (j === -1) j = source.length;
      result += blank(source.slice(i, j)); i = j; continue;
    }
    if (source.startsWith('/*', i)) {
      let j = source.indexOf('*/', i + 2); j = j < 0 ? source.length : j + 2;
      result += blank(source.slice(i, j)); i = j; continue;
    }
    // C++ raw string: R"delimiter(content)delimiter" with optional encoding prefix.
    if (source[i] === 'R' && source[i+1] === '"') {
      const match = source.slice(i).match(/^R"([^()\\\s]{0,16})\(/);
      if (match) {
        const close = ')' + match[1] + '"';
        let j = source.indexOf(close, i + match[0].length);
        j = j < 0 ? source.length : j + close.length;
        result += blank(source.slice(i, j)); i = j; continue;
      }
    }
    if (source[i] === '"' || source[i] === "'") {
      const quote = source[i]; let j = i + 1;
      while (j < source.length) {
        if (source[j] === '\\') { j += 2; continue; }
        if (source[j++] === quote) break;
      }
      result += blank(source.slice(i, j)); i = j; continue;
    }
    result += source[i++];
  }
  return result;
}

export function findLexicalCalls(source: string): CallSite[] {
  const masked = maskNonCode(source);
  const lines = source.split(/\r?\n/);
  const calls: CallSite[] = [];
  const pattern = /\b(?:[A-Za-z_]\w*\s*(?:::|->|\.)\s*)*[A-Za-z_]\w*\s*\(/g;
  const offsets = [0];
  for (let i=0; i<source.length; i++) if (source[i] === '\n') offsets.push(i+1);
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(masked)) && calls.length < 10000) {
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
      name: match[0].slice(0, -1).trim(), line: row+1,
      column: position - offsets[row] + 1,
      args: source.slice(start, depth === 0 ? end-1 : end),
      excerpt: lines[row] ?? '',
    });
  }
  return calls;
}
