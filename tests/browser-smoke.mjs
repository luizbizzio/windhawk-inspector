import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// The workflow installs Playwright in /tmp, separate from project dependencies.
const modulePath = process.env.PLAYWRIGHT_ENTRY ?? '/tmp/windhawk-browser-test/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(modulePath).href);

const fixtures = '/tmp/windhawk-smoke-fixtures';
const recycle = readFileSync(`${fixtures}/recycle-bin-file-preview.wh.cpp`, 'utf8');
const thumbnails = readFileSync(`${fixtures}/taskbar-thumbnail-reorder.wh.cpp`, 'utf8');
const clockUrl = 'https://windhawk.net/mods/taskbar-clock-customization';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const problems = [];
try {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', error => problems.push(error.message));
  page.setDefaultTimeout(20000);
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.locator('.catalog-summary').getByText(/mods/i).waitFor({timeout:45000});
  assert.match(await page.title(), /Windhawk Inspector/);

  async function waitForReport(name) {
    await page.locator('#results .results').waitFor({ state: 'visible', timeout: 120000 });
    await page.locator('#results h2').first().getByText(name, { exact: false }).waitFor();
    assert.equal(await page.locator('.error').count(), 0);
  }
  async function run() {
    await page.getByRole('button', {name: 'Analyze source'}).click();
  }

  // 1. Real Recycle Bin File Preview, using the browser's file-upload control.
  await page.getByRole('tab', {name: 'Upload'}).click();
  await page.locator('.source-panel input[type=file]').first().setInputFiles({
    name: 'recycle-bin-file-preview.wh.cpp', mimeType: 'text/plain',
    buffer: Buffer.from(recycle, 'utf8'),
  });
  await run();
  await waitForReport('Recycle Bin File Preview');
  const jsonWait = page.waitForEvent('download');
  await page.getByRole('button', {name: 'JSON', exact: true}).click();
  const jsonDownload = await jsonWait;
  const uploadReport = JSON.parse(readFileSync(await jsonDownload.path(), 'utf8'));
  assert.equal(uploadReport.metadata.id, 'recycle-bin-file-preview');
  const detected = new Set(uploadReport.findings.map(f=>f.ruleId));
  for (const rule of ['fs-attributes','shell-assoc-query','shell-assoc-create','hook-windhawk']) {
    assert.ok(detected.has(rule), `Missing detection: ${rule}`);
  }
  assert.equal(uploadReport.coverage, 'ast');
  assert.equal(uploadReport.sha256.length, 64);
  await page.getByRole('button', {name: 'Show full source'}).click();
  const lastLine = recycle.split(/\r?\n/).length;
  await page.locator('.source-lines').evaluate(element=>{ element.scrollTop=element.scrollHeight; });
  await page.locator(`#source-line-${lastLine}`).waitFor({timeout:10000});
  await page.getByRole('button', {name: 'Show nearby lines'}).click();
  assert.ok((await page.locator('.source-line').count())<=301);
  const htmlWait=page.waitForEvent('download');
  await page.getByRole('button', {name: 'HTML', exact: true}).click();
  const htmlDownload=await htmlWait;
  const html=readFileSync(await htmlDownload.path(), 'utf8');
  assert.ok(html.includes('File association lookup') || html.includes('Uses Windows file associations'));
  console.log('PASS upload: four expected API rules, JSON/HTML reports, full/nearby viewer.');

  // 2. Real Taskbar Thumbnail Reorder, using pasted C++ code.
  await page.getByRole('tab', {name: 'Paste code'}).click();
  await page.locator('.source-panel textarea').first().fill(thumbnails);
  await run();
  await waitForReport('Taskbar Thumbnail Reorder');
  await page.locator('.compare-toggle input[type=checkbox]').check();
  await page.getByRole('tab', {name: 'Paste code'}).last().click();
  // Same ID, different source: comparison must be accepted.
  await page.locator('.source-panel textarea').last().fill(thumbnails+'\n// Previous revision smoke-test marker\n');
  await run();
  await page.locator('.diff').waitFor({timeout:120000});
  assert.equal(await page.locator('.error').count(), 0);

  // Different ID: the app must block comparison before analysis.
  await page.locator('.source-panel textarea').last().fill(thumbnails.replace(
    /(@id\s+)taskbar-thumbnail-reorder/, '$1different-mod-id'
  ));
  await run();
  await page.getByRole('alert').getByText(/different mods/i).waitFor({timeout:15000});
  await page.locator('.compare-toggle input[type=checkbox]').uncheck();
  console.log('PASS paste: same-mod comparison works; different mod IDs are blocked.');

  // 3. Real Taskbar Clock Customization via a Windhawk source URL.
  await page.getByRole('tab', {name: 'URL'}).first().click();
  await page.getByLabel('Windhawk or GitHub source URL').first().fill(clockUrl);
  await run();
  await waitForReport('Taskbar Clock Customization');
  assert.ok((await page.locator('.source-line').count()) > 0);
  console.log('PASS URL: official Windhawk source fetched and analyzed.');

  // Version dropdown must be able to reach GitHub's commit-history API.
  await page.locator('.compare-toggle input[type=checkbox]').check();
  await page.locator('#previous-version').waitFor({ state:'visible' });
  await page.waitForFunction(() => {
    const select=document.querySelector('#previous-version');
    const error=document.querySelector('.version-error');
    return Boolean(error || (select && !select.disabled && select.options.length>1));
  },null,{timeout:40000});
  const versionError=await page.locator('.version-error').textContent().catch(()=>null);
  if (versionError) throw new Error('GitHub version picker failed: '+versionError);
  const versionSelect=page.locator('#previous-version');
  const older=await versionSelect.locator('option').nth(1).getAttribute('value');
  assert.ok(older);
  await versionSelect.selectOption(older);
  await page.getByRole('link',{name:/View changelog on GitHub/}).waitFor();
  console.log('PASS GitHub version history: dropdown and changelog available.');
  assert.deepEqual(problems, [], 'Browser had uncaught JavaScript errors.');
  console.log('PASS browser smoke: three real mods and main workflows.');
} finally {
  await browser.close();
}
