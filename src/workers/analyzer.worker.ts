/// <reference lib="webworker" />
import { Parser, Language } from 'web-tree-sitter';
import { buildReport } from '../analysis/report';
import { findLexicalCalls } from '../analysis/lexical';
import type { ParseResult } from '../analysis/types';
import { inspectSyntaxTree } from '../analysis/parser';
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
    try {
      return inspectSyntaxTree(source, tree);
    } finally {
      tree.delete();
    }
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
