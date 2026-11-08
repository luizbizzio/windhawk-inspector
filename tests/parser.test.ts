import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { Language, Parser } from 'web-tree-sitter';
import { inspectSyntaxTree } from '../src/analysis/parser';

describe('C++ Tree-sitter WASM integration', () => {
  it('loads grammar and finds a C++ call expression', async () => {
    await Parser.init({ locateFile: () => resolve('public/wasm/web-tree-sitter.wasm') });
    const language = await Language.load(resolve('public/wasm/tree-sitter-cpp.wasm'));
    const parser = new Parser();
    parser.setLanguage(language);
    const tree = parser.parse('void test() { CreateProcessW(nullptr); }');
    expect(tree).not.toBeNull();
    const nodes: string[] = [];
    const cursor = tree!.walk();
    while (true) {
      if (cursor.nodeType === 'call_expression') nodes.push(cursor.currentNode.childForFieldName('function')?.text ?? '');
      if (cursor.gotoFirstChild()) continue;
      let next = cursor.gotoNextSibling();
      while (!next) { if (!cursor.gotoParent()) break; next = cursor.gotoNextSibling(); }
      if (!next) break;
    }
    expect(nodes).toContain('CreateProcessW');
    const parsed = inspectSyntaxTree('void test() { CreateProcessW(nullptr); }', tree!);
    expect(parsed.calls.some(c=>c.name==='CreateProcessW')).toBe(true);
    expect(parsed.diagnostics).toMatchObject({syntaxErrorNodes:0,missingNodes:0,truncated:false});
    expect(parsed.diagnostics?.analyzedCalls).toBeGreaterThanOrEqual(1);
    tree?.delete();
    parser.delete();
  });
  it('records actual syntax recovery counts and example lines without claiming invalid source', async () => {
    await Parser.init({ locateFile: () => resolve('public/wasm/web-tree-sitter.wasm') });
    const language = await Language.load(resolve('public/wasm/tree-sitter-cpp.wasm'));
    const parser = new Parser();
    parser.setLanguage(language);
    const bad = `void broken( {
  CreateProcessW(nullptr);
`;
    const tree = parser.parse(bad);
    expect(tree).not.toBeNull();
    const result = inspectSyntaxTree(bad,tree!);
    expect((result.diagnostics?.syntaxErrorNodes ?? 0) + (result.diagnostics?.missingNodes ?? 0)).toBeGreaterThan(0);
    expect(result.diagnostics?.sampledIssueLines.length).toBeGreaterThan(0);
    tree?.delete();
    parser.delete();
  });
});
