/// <reference lib="webworker" />
import { Parser, Language } from 'web-tree-sitter';
import { buildReport } from '../analysis/report';
import { findLexicalCalls, MAX_LEXICAL_CALLS } from '../analysis/lexical';
import { isTrackedCall } from '../analysis/rules';
import type { ParseResult } from '../analysis/types';
import { inspectSyntaxTree } from '../analysis/parser';
import { MAX_AST_SOURCE_BYTES, MAX_SOURCE_BYTES } from '../analysis/url';

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

function limitedScan(source: string, reason: string): ParseResult {
  const calls = findLexicalCalls(source, isTrackedCall);
  const limitations = [
    reason,
    'Lexical analysis can miss macros, indirect calls and wrappers, and may misidentify matching names.',
  ];
  if (calls.length >= MAX_LEXICAL_CALLS) limitations.push(
    `The ${MAX_LEXICAL_CALLS.toLocaleString('en-US')}-call lexical limit was reached. Later API calls may not have been inspected.`,
  );
  return { calls, coverage: 'lexical', limitations };
}

async function parseSource(source: string, bytes: number): Promise<ParseResult> {
  if (bytes > MAX_AST_SOURCE_BYTES) {
    return limitedScan(source,
      'Source exceeds 8 MB. To avoid excessive browser memory use, a limited lexical scan was used instead of the C++ AST parser.');
  }
  try {
    const parser = await getParser();
    const tree = parser.parse(source);
    if (!tree) throw new Error('C++ parser returned no syntax tree');
    try {
      return inspectSyntaxTree(source, tree);
    } finally {
      tree.delete();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 160) : 'unknown error';
    return limitedScan(source, `C++ AST parser unavailable (${message}). A limited lexical scan was used.`);
  }
}

self.onmessage = async (event: MessageEvent<{ id: number; source: string; filename: string }>) => {
  const { id, source, filename } = event.data;
  try {
    const bytes = new TextEncoder().encode(source).byteLength;
    if (bytes > MAX_SOURCE_BYTES) throw new Error('The source exceeds the 50 MB limit.');
    const parsed = await parseSource(source, bytes);
    const report = await buildReport(source, filename, parsed);
    self.postMessage({ id, report });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'Unexpected analysis error' });
  }
};
