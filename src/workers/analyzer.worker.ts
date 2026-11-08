/// <reference lib="webworker" />
import { Parser, Language } from 'web-tree-sitter';
import { buildReport } from '../analysis/report';
import { findLexicalCalls } from '../analysis/lexical';
import type { CallSite, ParseResult } from '../analysis/types';
import { MAX_SOURCE_BYTES } from '../analysis/url';

let parserPromise: Promise<Parser> | undefined;
async function getParser(): Promise<Parser> {
  parserPromise ??= (async () => {
    const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
    await Parser.init({ locateFile: () => `${base}wasm/web-tree-sitter.wasm` });
    const language = await Language.load(`${base}wasm/tree-sitter-cpp.wasm`);
    const parser = new Parser();
    parser.setLanguage(language);
    return parser;
  })();
  return parserPromise;
}

async function parseSource(source: string): Promise<ParseResult> {
  try {
    const parser = await getParser();
    const tree = parser.parse(source);
    if (!tree) throw new Error('C++ parser returned no syntax tree');
    const cursor = tree.walk();
    const lines = source.split(/\r?\n/);
    const calls: CallSite[] = [];
    let traversed = 0;
    while (true) {
      traversed++;
      if (traversed > 500_000) throw new Error('Syntax tree too large for this scan');
      if (cursor.nodeType === 'call_expression' && calls.length < 15_000) {
        const node = cursor.currentNode;
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
      }
      if (cursor.gotoFirstChild()) continue;
      let next = cursor.gotoNextSibling();
      while (!next) {
        if (!cursor.gotoParent()) break;
        next = cursor.gotoNextSibling();
      }
      if (!next) break;
    }
    const limitations: string[] = [];
    if (tree.rootNode.hasError()) limitations.push('C++ syntax contains parser errors; some calls may be missed or misinterpreted.');
    if (calls.length === 15_000) limitations.push('Call site limit reached; findings may be incomplete.');
    tree.delete();
    return { calls, coverage: 'ast', limitations };
  } catch (error) {
    return {
      calls: findLexicalCalls(source), coverage: 'lexical',
      limitations: [`C++ AST parser unavailable (${error instanceof Error ? error.message.slice(0, 160) : 'unknown error'}). A limited lexical fallback was used.`,
        'Lexical fallback can miss macros, indirect calls and declarations, and may misidentify matching names.'],
    };
  }
}

self.onmessage = async (event: MessageEvent<{ id: number; source: string; filename: string }>) => {
  const { id, source, filename } = event.data;
  try {
    if (new TextEncoder().encode(source).byteLength > MAX_SOURCE_BYTES) throw new Error('The source exceeds the 2 MB limit.');
    const parsed = await parseSource(source);
    const report = await buildReport(source, filename, parsed);
    self.postMessage({ id, report });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'Unexpected analysis error' });
  }
};
