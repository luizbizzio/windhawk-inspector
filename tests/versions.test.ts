import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { catalogModId, versionFromCommitTitle, versionsFromCommits, versionSourceUrl } from '../src/analysis/versions';
import { verifyComparableSources } from '../src/analysis/comparison';

const sha1='a'.repeat(40);
const sha2='b'.repeat(40);
const sha3='c'.repeat(40);
const fakeSource = (id:string, version:string) => `// ==WindhawkMod==\n// @id ${id}\n// @version ${version}\n// ==/WindhawkMod==\nvoid foo() {}`;

describe('Content Security Policy for version history', () => {
  it('allows only the GitHub API and raw.githubusercontent.com for external connections', () => {
    const html = readFileSync('index.html', 'utf8');
    const csp = html.match(/Content-Security-Policy" content="([^"]+)/)?.[1];
    expect(csp).toBeDefined();
    expect(csp).toContain("connect-src 'self' https://raw.githubusercontent.com https://api.github.com;");
    expect(csp).not.toContain('connect-src *');
  });
});

describe('GitHub version selection', () => {
  it('reads version labels from real Windhawk commit-title formats', () => {
    expect(versionFromCommitTitle('Windows 11 Start Menu Styler v1.8 (#6796)')).toBe('1.8');
    expect(versionFromCommitTitle('Update Mac Island & Dock to 3.0.0 (#6903)')).toBe('3.0.0');
    expect(versionFromCommitTitle('Add Mac Island & Dock 0.41.3 (#5901)')).toBe('0.41.3');
    expect(versionFromCommitTitle('Fix a search bug (#1010)')).toBe(null);
  });
  it('ignores unidentified commits and deduplicates versions', () => {
    const list = versionsFromCommits('mac-island-dock', [
      {sha:sha1,commit:{message:'Update Mac Island & Dock to 3.0.0 (#6903)',committer:{date:'2026-11-05T03:03:20Z'}}},
      {sha:'f'.repeat(40),commit:{message:'Fix typo'}},
      {sha:sha2,commit:{message:'Mac Island & Dock v3.0.0 (#6931)'}},
      {sha:sha3,commit:{message:'Update Mac Island & Dock to 2.1.0 (#6560)'}},
    ]);
    expect(list.map(v=>v.version)).toEqual(['3.0.0','2.1.0']);
    expect(list[1].sourceUrl).toBe(versionSourceUrl('mac-island-dock',sha3));
    expect(list[0].commitUrl).toBe(`https://github.com/ramensoftware/windhawk-mods/commit/${sha1}`);
  });
  it('rejects untrusted GitHub ref or mod name', () => {
    expect(()=>versionSourceUrl('../bad','f'.repeat(40))).toThrow();
    expect(()=>versionSourceUrl('test','main')).toThrow();
  });
  it('recognizes only official catalog links for automatic version comparison', () => {
    expect(catalogModId('https://windhawk.net/mods/mac-island-dock')).toBe('mac-island-dock');
    expect(catalogModId('https://github.com/ramensoftware/windhawk-mods')).toBe(null);
  });
});

describe('Comparison identity', () => {
  it('accepts different versions of the same mod', () => {
    expect(()=>verifyComparableSources({source:fakeSource('alpha', '2.0')},{source:fakeSource('alpha','1.0')})).not.toThrow();
  });
  it('blocks different mods, even when file names are the same', () => {
    expect(()=>verifyComparableSources({source:fakeSource('alpha','2.0')},{source:fakeSource('beta','1.0')})).toThrow('different mods');
  });
  it('blocks missing IDs and identical sources', () => {
    expect(()=>verifyComparableSources({source:'int x;'},{source:fakeSource('alpha','1.0')})).toThrow('@id');
    const source=fakeSource('alpha','1.0');
    expect(()=>verifyComparableSources({source},{source})).toThrow('identical');
  });
  it('also verifies the selected catalog ID', () => {
    expect(()=>verifyComparableSources({source:fakeSource('alpha','2.0')},{source:fakeSource('alpha','1.0')},'beta')).toThrow('selected mod');
  });
});
