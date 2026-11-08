import type { ModMetadata } from './types';

export function parseMetadata(source: string): ModMetadata {
  const result: ModMetadata = {
    includes: [], excludes: [], architectures: [], compilerOptions: [],
  };
  const block = source.match(/\/\/\s*==WindhawkMod==([\s\S]*?)\/\/\s*==\/WindhawkMod==/i);
  if (!block) return result;
  for (const line of block[1].split(/\r?\n/)) {
    const match = line.match(/^\s*\/\/\s*@([\w-]+)\s+(.+?)\s*$/);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === 'id') result.id = value;
    if (key === 'name') result.name = value;
    if (key === 'version') result.version = value;
    if (key === 'author') result.author = value;
    if (key === 'include') result.includes.push(value);
    if (key === 'exclude') result.excludes.push(value);
    if (key === 'architecture') result.architectures.push(value);
    if (key === 'compileroptions') result.compilerOptions.push(value);
  }
  return result;
}
