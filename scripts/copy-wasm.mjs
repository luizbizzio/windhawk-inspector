import { mkdir, copyFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const destination = resolve('public/wasm');
await mkdir(destination, { recursive: true });
const choices = [
  [
    ['node_modules/web-tree-sitter/tree-sitter.wasm', 'node_modules/web-tree-sitter/web-tree-sitter.wasm'],
    'web-tree-sitter.wasm',
  ],
  [
    ['node_modules/tree-sitter-wasms/out/tree-sitter-cpp.wasm', 'node_modules/tree-sitter-wasms/tree-sitter-cpp.wasm'],
    'tree-sitter-cpp.wasm',
  ],
];
for (const [candidates, filename] of choices) {
  let source;
  for (const path of candidates) {
    try { await access(resolve(path)); source = resolve(path); break; } catch { /* try next */ }
  }
  if (!source) throw new Error(`Missing ${filename} in dependencies`);
  await copyFile(source, resolve(destination, filename));
  process.stdout.write(`Copied ${filename}\n`);
}
