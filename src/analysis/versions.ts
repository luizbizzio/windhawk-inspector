/** Published versions of a Windhawk catalog mod, backed by GitHub source commits. */
export interface ModVersion {
  version: string;
  sha: string;
  date: string;
  changelog: string;
  commitUrl: string;
  sourceUrl: string;
}

const MOD_ID = /^[a-z0-9][a-z0-9-]{0,95}$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;
const API_ROOT = 'https://api.github.com/repos/ramensoftware/windhawk-mods';

/** Version labels must be present in the commit title. GitHub commit SHAs are not version numbers. */
export function versionFromCommitTitle(message: string): string | null {
  const title = message.split(/\r?\n/)[0].trim().replace(/\s*\(#\d+\)\s*$/, '');
  // Windhawk submissions use e.g. "Mod Name v1.8", "Update Mod to 2.1.0", "Add Mod 0.41.3".
  const matched = title.match(/(?:^|[\s:])v?(\d+\.\d+(?:\.\d+){0,3}(?:-[0-9a-z.-]+)?)$/i);
  return matched ? matched[1] : null;
}

export function versionSourceUrl(modId: string, sha: string): string {
  if (!MOD_ID.test(modId) || !COMMIT_SHA.test(sha)) throw new Error('Invalid mod ID or GitHub revision.');
  return `https://raw.githubusercontent.com/ramensoftware/windhawk-mods/${sha}/mods/${modId}.wh.cpp`;
}

export function catalogModId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !['windhawk.net','www.windhawk.net'].includes(parsed.hostname) ||
      parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    const found = /^\/mods\/([a-z0-9][a-z0-9-]{0,95})\/?$/.exec(parsed.pathname);
    return found?.[1] ?? null;
  } catch { return null; }
}

export interface GitHubCommit {
  sha: string;
  commit: { message: string; committer?: { date?: string } };
  html_url?: string;
}

/** Extract only versions explicitly named in the Git history, deduplicated by version. */
export function versionsFromCommits(modId: string, payload: unknown): ModVersion[] {
  if (!MOD_ID.test(modId) || !Array.isArray(payload)) throw new Error('Invalid GitHub commit history.');
  const seen = new Set<string>();
  const versions: ModVersion[] = [];
  for (const item of payload as GitHubCommit[]) {
    if (!item || typeof item.sha !== 'string' || !COMMIT_SHA.test(item.sha) ||
        !item.commit || typeof item.commit.message !== 'string') continue;
    const version = versionFromCommitTitle(item.commit.message);
    if (!version || seen.has(version)) continue;
    seen.add(version);
    const date = item.commit.committer?.date;
    versions.push({
      version,
      sha: item.sha,
      date: typeof date === 'string' && !Number.isNaN(Date.parse(date)) ? date.slice(0,10) : '',
      changelog: item.commit.message.slice(0,4000),
      commitUrl: `${API_ROOT.replace('api.github.com/repos/','github.com/')}/commit/${item.sha}`,
      sourceUrl: versionSourceUrl(modId,item.sha),
    });
  }
  return versions;
}

export async function loadModVersions(modId: string, signal?: AbortSignal): Promise<ModVersion[]> {
  if (!MOD_ID.test(modId)) throw new Error('Invalid Windhawk mod ID.');
  const path = encodeURIComponent(`mods/${modId}.wh.cpp`);
  const response = await fetch(`${API_ROOT}/commits?path=${path}&per_page=100`, {
    signal, headers: { Accept:'application/vnd.github+json' }, cache: 'no-store',
  });
  if (!response.ok) {
    if (response.status === 403 || response.status === 429) throw new Error('GitHub history is temporarily unavailable or rate-limited. Use a file, URL or pasted source.');
    throw new Error(`Could not load version history from GitHub (HTTP ${response.status}).`);
  }
  const versions = versionsFromCommits(modId, await response.json());
  if (versions.length < 2) throw new Error('GitHub did not list two identifiable versions for this mod. Use a file, URL or pasted source.');
  return versions;
}
