export const MAX_SOURCE_BYTES = 50_000_000;
export const MAX_AST_SOURCE_BYTES = 8_000_000;
const VALID_FILE = /\.(?:wh\.cpp|cpp|hpp|h|txt)$/i;
const SEGMENT = /^[a-zA-Z0-9_.-]+$/;

export function resolveSourceUrl(input: string): string {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error('Enter a complete HTTPS URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error('Only standard HTTPS links without credentials or ports are supported.');
  }
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean).map((segment) => {
    try { return decodeURIComponent(segment); } catch { throw new Error('Invalid URL encoding.'); }
  });
  if (segments.some(s => s === '.' || s === '..' || s.includes('/') || s.includes('\\'))) {
    throw new Error('Invalid source path.');
  }
  if (host === 'windhawk.net' || host === 'www.windhawk.net') {
    if (segments.length !== 2 || segments[0] !== 'mods' || !SEGMENT.test(segments[1]) || segments[1].startsWith('.')) {
      throw new Error('Use a Windhawk mod URL, for example https://windhawk.net/mods/taskbar-clock-customization.');
    }
    return `https://raw.githubusercontent.com/ramensoftware/windhawk-mods/main/mods/${encodeURIComponent(segments[1])}.wh.cpp`;
  }
  if (host === 'github.com' && segments.length >= 5 && (segments[2] === 'blob' || segments[2] === 'raw')) {
    const [owner, repo, , ref, ...path] = segments;
    if (![owner, repo, ref].every(s => SEGMENT.test(s) && !s.startsWith('.')) ||
        !VALID_FILE.test(path.at(-1) ?? '') || path.some(s => !SEGMENT.test(s))) {
      throw new Error('Unsupported GitHub source path or file type.');
    }
    return `https://raw.githubusercontent.com/${[owner,repo,ref,...path].map(encodeURIComponent).join('/')}`;
  }
  if (host === 'raw.githubusercontent.com' && segments.length >= 4) {
    if (!VALID_FILE.test(segments.at(-1) ?? '') || segments.some(s => !SEGMENT.test(s) || s.startsWith('.'))) {
      throw new Error('Unsupported GitHub raw source path or file type.');
    }
    return `https://raw.githubusercontent.com/${segments.map(encodeURIComponent).join('/')}`;
  }
  throw new Error('Supported sources: Windhawk mod links, GitHub source files, and GitHub raw files.');
}

export async function loadSourceUrl(input: string, signal?: AbortSignal): Promise<{ source: string; filename: string }> {
  const raw = resolveSourceUrl(input);
  // No automatic redirects to arbitrary origins.
  const response = await fetch(raw, { signal, redirect: 'error', cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not read source (HTTP ${response.status}). Check the URL or repository visibility.`);
  const length = Number(response.headers.get('content-length') ?? '0');
  if (length > MAX_SOURCE_BYTES) throw new Error('Source exceeds the 50 MB limit.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('This browser cannot stream the source.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_SOURCE_BYTES) throw new Error('Source exceeds the 50 MB limit.');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return {
    source: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    filename: decodeURIComponent(new URL(raw).pathname.split('/').at(-1) ?? 'mod.wh.cpp'),
  };
}
