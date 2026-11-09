import type { Tree } from 'web-tree-sitter';
import type { CallSite, ParseResult } from './types';

// Higher ceilings allow large Windhawk mods to finish their AST inspection.
// The browser still has a separate source-size and execution-time safeguard.
export const MAX_AST_NODES = 2_000_000;
export const MAX_AST_CALLS = 60_000;
const MAX_SAMPLES = 8;

/** Union of half-open spans. Avoid double counting nested parser error nodes. */
function totalSpanLength(spans: Array<[number, number]>): number {
  if (!spans.length) return 0;
  spans.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let [start, end] = spans[0];
  let total = 0;
  for (let i = 1; i < spans.length; i++) {
    const [nextStart, nextEnd] = spans[i];
    if (nextStart <= end) end = Math.max(end, nextEnd);
    else { total += end - start; start = nextStart; end = nextEnd; }
  }
  return total + end - start;
}

/** Collect syntax-level call sites and concrete parser diagnostics.
 *  Syntax errors can arise from valid code using macros or incomplete context.
 */
export function inspectSyntaxTree(source: string, tree: Tree): ParseResult {
  const lines = source.split(/\r?\n/);
  const calls: CallSite[] = [];
  const problemLines = new Set<number>();
  const errorSpans: Array<[number,number]> = [];
  const affectedLineSpans: Array<[number,number]> = [];
  const cursor = tree.walk();
  let syntaxErrors = 0;
  let missingNodes = 0;
  let visitedNodes = 0;
  let callSites = 0;
  let nodeLimitReached = false;
  let callLimitReached = false;
  while (true) {
    const node = cursor.currentNode;
    visitedNodes++;
    if (node.type === 'ERROR') {
      syntaxErrors++;
      const start = Math.max(0, Math.min(source.length, node.startIndex));
      const end = Math.max(start, Math.min(source.length, node.endIndex));
      if (end > start) errorSpans.push([start, end]);
      const firstLine = node.startPosition.row;
      const lastLine = Math.max(firstLine, node.endPosition.row -
        (node.endPosition.row > firstLine && node.endPosition.column === 0 ? 1 : 0));
      affectedLineSpans.push([firstLine, lastLine + 1]);
      if (problemLines.size < MAX_SAMPLES) problemLines.add(firstLine + 1);
    }
    if (node.isMissing) {
      missingNodes++;
      affectedLineSpans.push([node.startPosition.row, node.startPosition.row + 1]);
      if (problemLines.size < MAX_SAMPLES) problemLines.add(node.startPosition.row + 1);
    }
    if (node.type === 'call_expression') {
      callSites++;
      if (calls.length < MAX_AST_CALLS) {
        const fn = node.childForFieldName('function');
        const args = node.childForFieldName('arguments');
        if (fn && args) {
          calls.push({
            name: source.slice(fn.startIndex, fn.endIndex),
            line: node.startPosition.row + 1,
            column: node.startPosition.column + 1,
            args: source.slice(args.startIndex + 1, Math.max(args.startIndex + 1, args.endIndex - 1)),
            excerpt: lines[node.startPosition.row] ?? '',
          });
        }
      } else callLimitReached = true;
    }
    if (visitedNodes >= MAX_AST_NODES) { nodeLimitReached = true; break; }
    if (cursor.gotoFirstChild()) continue;
    let next = cursor.gotoNextSibling();
    while (!next) {
      if (!cursor.gotoParent()) break;
      next = cursor.gotoNextSibling();
    }
    if (!next) break;
  }
  const limitations: string[] = [];
  const errorSpanCharacters = totalSpanLength(errorSpans);
  const errorAffectedLines = totalSpanLength(affectedLineSpans);
  if (syntaxErrors || missingNodes) limitations.push(
    `The C++ parser reported ${syntaxErrors} recovery region(s) and ${missingNodes} missing token(s), affecting ${errorAffectedLines} source line(s). These are parser diagnostics, not confirmed compile errors. Macros and conditional code may be involved; a real build is needed to check syntax. Calls inside affected regions may be missed.`,
  );
  if (callLimitReached) limitations.push(`The ${MAX_AST_CALLS.toLocaleString('en-US')}-call inspection limit was reached; some calls were not analyzed.`);
  if (nodeLimitReached) limitations.push(`The ${MAX_AST_NODES.toLocaleString('en-US')}-node inspection limit was reached; the syntax tree was not fully inspected.`);
  return {
    calls,
    coverage: 'ast',
    limitations,
    diagnostics: {
      visitedNodes,
      callExpressions: callSites,
      analyzedCalls: calls.length,
      syntaxErrorNodes: syntaxErrors,
      missingNodes,
      errorSpanCharacters,
      errorAffectedLines,
      sourceCharacters: source.length,
      sampledIssueLines: [...problemLines].sort((a,b)=>a-b),
      truncated: nodeLimitReached || callLimitReached,
    },
  };
}
