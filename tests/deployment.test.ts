import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');
const DOMAIN = 'https://windhawk-inspector.luizbizzio.com/';

describe('custom domain deployment', () => {
  it('builds GitHub Pages assets at the domain root', () => {
    const workflow = read('.github/workflows/pages.yml');
    expect(workflow).toMatch(/^\s*GITHUB_PAGES_BASE:\s*\/\s*$/m);
    expect(workflow).not.toContain('GITHUB_PAGES_BASE: /windhawk-inspector/');
    expect(read('vite.config.ts')).toContain("base: process.env.GITHUB_PAGES_BASE || '/'");
  });

  it('waits for the build artifact in a separate deployment job', () => {
    const workflow = read('.github/workflows/pages.yml');
    expect(workflow).toMatch(/\n  build:\n/);
    expect(workflow).toMatch(/\n  deploy:\n    needs: build\n/);
    expect(workflow).toContain('actions/upload-pages-artifact@v4');
    expect(workflow).toContain('actions/deploy-pages@v4');
  });

  it('uses one navy square without an outline behind the white bird', () => {
    const bird = read('public/assets/windhawk-bird.svg');
    const favicon = read('public/assets/windhawk-logo.svg');
    const css = read('src/styles.css');
    expect(bird).toContain('<path fill="#ffffff"');
    expect(bird).not.toContain('<rect');
    expect(favicon).toContain('rx="112" fill="#1E293B"');
    expect(css).toMatch(/\.brand-mark\s*\{[^}]*background:\s*#1E293B;[^}]*border:\s*0;/);
    expect(read('src/App.tsx').match(/assets\/windhawk-bird\.svg/g)).toHaveLength(2);
  });

  it('uses the new domain in canonical and social metadata', () => {
    const html = read('index.html');
    expect(html).toContain(`<link rel="canonical" href="${DOMAIN}" />`);
    expect(html).toContain(`<meta property="og:url" content="${DOMAIN}" />`);
  });

  it('reuses the catalog status below project links and in the matching footer', () => {
    const app = read('src/App.tsx');
    expect(app).toContain('formatCatalogSummary(catalog)');
    expect(app).toContain('className="catalog-summary" role="status" aria-live="polite"');
    expect(app).toContain('className="footer-updated">{catalogStatus}');
    expect(app).toContain('>Badges ↗</a>');
    expect(app).toContain('>Report an issue</a>');
    expect(app).toContain('>License</a>');
    expect(app).not.toContain('>Windhawk Badges ↗</a>');
    expect(app).not.toContain('>Windhawk Badges</a>');
  });

  it('loads the catalog, icons and parser assets relative to the Vite base', () => {
    expect(read('src/App.tsx')).toContain('${import.meta.env.BASE_URL}data/catalog.json');
    expect(read('src/App.tsx')).toContain('${import.meta.env.BASE_URL}assets/windhawk-bird.svg');
    expect(read('src/workers/analyzer.worker.ts')).toContain('import.meta.env.BASE_URL');
    expect(read('index.html')).toContain('%BASE_URL%assets/windhawk-logo.svg');
  });
});
