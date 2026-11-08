import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { Language, Parser } from 'web-tree-sitter';

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
    tree?.delete();
    parser.delete();
  });
});
