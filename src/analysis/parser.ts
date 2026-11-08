import type { Tree } from 'web-tree-sitter';
import type { CallSite, ParseResult } from './types';

// Higher ceilings allow large Windhawk mods to finish their AST inspection.
// The browser still has a separate source-size and execution-time safeguard.
export const MAX_AST_NODES = 2_000_000;
export const MAX_AST_CALLS = 60_000;
const MAX_SAMPLES = 8;

/** Collect syntax-level call sites and concrete parser diagnostics.
 *  Syntax errors can arise from valid code using macros or incomplete context.
 */
export function inspectSyntaxTree(source: string, tree: Tree): ParseResult {
  const lines = source.split(/\r?\n/);
  const calls: CallSite[] = [];
  const problemLines = new Set<number>();
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
      if (problemLines.size < MAX_SAMPLES) problemLines.add(node.startPosition.row + 1);
    }
    if (node.isMissing) {
      missingNodes++;
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
  if (syntaxErrors || missingNodes) limitations.push(
    `The C++ parser encountered ${syntaxErrors} error region(s) and ${missingNodes} missing token(s). Macros, conditional compilation or incomplete context may explain these. Some calls may be missed; this does not prove the source is invalid.`,
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
      sampledIssueLines: [...problemLines].sort((a,b)=>a-b),
      truncated: nodeLimitReached || callLimitReached,
    },
  };
}
