import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { Language, Parser } from 'web-tree-sitter';
import { inspectSyntaxTree, MAX_AST_NODES, MAX_AST_CALLS } from '../src/analysis/parser';
import type { Tree } from 'web-tree-sitter';

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
  it('inspects more than 500,000 syntax nodes before reaching the new limit', () => {
    expect(MAX_AST_NODES).toBe(2_000_000);
    expect(MAX_AST_CALLS).toBe(60_000);
    let index = 0;
    const count = 500_123;
    const cursor = {
      currentNode: { type: 'identifier', isMissing: false },
      gotoFirstChild: () => false,
      gotoNextSibling: () => ++index < count,
      gotoParent: () => false,
    };
    const tree = { walk: () => cursor } as unknown as Tree;
    const result = inspectSyntaxTree('int x;', tree);
    expect(result.diagnostics?.visitedNodes).toBe(count);
    expect(result.diagnostics?.truncated).toBe(false);
    expect(result.limitations.some(line => line.includes('node inspection limit'))).toBe(false);
  });

});


describe('parser error span measurement', () => {
  it('merges overlapping error spans and counts missing token lines once', () => {
    const source = '0123456789\n'.repeat(20);
    const nodes = [
      {type:'ERROR',isMissing:false,startIndex:20,endIndex:30,
        startPosition:{row:1,column:9},endPosition:{row:2,column:8}},
      {type:'ERROR',isMissing:false,startIndex:22,endIndex:25,
        startPosition:{row:2,column:0},endPosition:{row:2,column:3}},
      {type:'MISSING',isMissing:true,startIndex:120,endIndex:120,
        startPosition:{row:12,column:0},endPosition:{row:12,column:0}},
    ];
    let index=0;
    const cursor = {
      get currentNode() {return nodes[index];},
      gotoFirstChild:()=>false,
      gotoNextSibling:()=>++index < nodes.length,
      gotoParent:()=>false,
    };
    const parsed = inspectSyntaxTree(source,{walk:()=>cursor} as unknown as Tree);
    expect(parsed.diagnostics?.errorSpanCharacters).toBe(10);
    expect(parsed.diagnostics?.errorAffectedLines).toBe(3);
    expect(parsed.diagnostics?.sourceCharacters).toBe(source.length);
    expect(parsed.limitations.join(' ')).toContain('not confirmed compile errors');
  });
});
