import { describe, expect, it } from 'vitest';
import { MAX_AST_SOURCE_BYTES, MAX_SOURCE_BYTES } from '../src/analysis/url';
import { readLocalFile } from '../src/analysis/client';
import { findLexicalCalls, MAX_LEXICAL_CALLS } from '../src/analysis/lexical';
import { isTrackedCall } from '../src/analysis/rules';

describe('50 MB source inputs', () => {
  it('accepts up to 50,000,000 bytes and uses a smaller AST threshold', () => {
    expect(MAX_SOURCE_BYTES).toBe(50_000_000);
    expect(MAX_AST_SOURCE_BYTES).toBe(8_000_000);
    expect(MAX_SOURCE_BYTES).toBeGreaterThan(MAX_AST_SOURCE_BYTES);
  });

  it('allows a local file larger than the previous 2 MB limit', async () => {
    const file = new File(['x'.repeat(2_100_000)], 'large.wh.cpp', { type: 'text/plain' });
    const input = await readLocalFile(file);
    expect(input.source).toHaveLength(2_100_000);
  });

  it('rejects a local file above the 50 MB limit before reading its contents', async () => {
    // Verify rejection before reading without allocating a 50 MB test fixture.
    const oversize = { name: 'too-large.cpp', size: MAX_SOURCE_BYTES + 1,
      text: () => { throw new Error('File must not be read'); } } as unknown as File;
    await expect(readLocalFile(oversize)).rejects.toThrow('50 MB limit');
  });

  it('does not skip tracked API calls after thousands of unrelated calls', () => {
    const source = 'harmless();\n'.repeat(MAX_LEXICAL_CALLS + 2) + 'DeleteFileW(L"temp.txt");';
    const hits = findLexicalCalls(source, isTrackedCall);
    expect(hits.map(hit => hit.name)).toEqual(['DeleteFileW']);
    expect(hits[0].line).toBe(MAX_LEXICAL_CALLS + 3);
  });
});
