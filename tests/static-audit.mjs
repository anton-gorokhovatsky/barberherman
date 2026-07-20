import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (file) => readFile(path.join(root, file), 'utf8');
const [index, privacy, notFound, script, styles, robots, sitemap] = await Promise.all([
  read('index.html'),
  read('privacy.html'),
  read('404.html'),
  read('script.js'),
  read('styles.css'),
  read('robots.txt'),
  read('sitemap.xml'),
]);

function firstInteractiveMarkup(html) {
  const body = html.split(/<body[^>]*>/i)[1] || '';
  return body.match(/<(?:a|button|input|select|textarea)\b[^>]*>/i)?.[0] || '';
}

test('poster preloads use the same mobile breakpoint as CSS and JavaScript', () => {
  assert.match(index, /hero-mobile\.jpg[^>]+media="\(max-width: 900px\)"/);
  assert.match(index, /hero\.jpg[^>]+media="\(min-width: 901px\)"/);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /@media \(min-width: 901px\)/);
  assert.match(script, /matchMedia\('\(max-width: 900px\)'\)/);
});

test('analytics is absent from HTML and remains an explicit JavaScript opt-in', () => {
  for (const html of [index, privacy]) {
    assert.doesNotMatch(html, /mc\.yandex\.ru|watch\/110837561|ym\(110837561/);
  }
  assert.match(script, /window\[metrikaDisableKey\] = true/);
  assert.match(script, /if \(analyticsConsent === 'granted'\) startMetrika\(\)/);
  assert.match(index, /data-analytics-choice="denied"/);
  assert.match(index, /data-analytics-choice="granted"/);
  assert.match(index, /data-privacy-settings/);
});

test('the skip link is the first interactive control on every public HTML page', () => {
  assert.match(firstInteractiveMarkup(index), /class="skip-link"/);
  assert.match(firstInteractiveMarkup(privacy), /class="skip-link"/);
  assert.match(firstInteractiveMarkup(notFound), /class="skip-link"/);
});

test('mobile reading order and module control semantics stay aligned', () => {
  const navPosition = index.indexOf('<nav class="multitool');
  const profilePosition = index.indexOf('id="profile-panel"');
  const practicePosition = index.indexOf('id="practice-panel"');
  assert.ok(navPosition >= 0 && navPosition < profilePosition);
  assert.ok(profilePosition < practicePosition);

  const panelButtons = [...index.matchAll(/<button type="button" data-panel="[^"]+"[^>]*>/g)].map((match) => match[0]);
  assert.equal(panelButtons.length, 5);
  panelButtons.forEach((button) => {
    assert.match(button, /aria-label="[^"]+"/);
    assert.match(button, /aria-controls="[^"]+"/);
    assert.match(button, /aria-pressed="false"/);
    assert.match(button, /aria-expanded="false"/);
  });
});

test('IDs are unique and cache versions remain aligned', () => {
  for (const [name, html] of [['index.html', index], ['privacy.html', privacy], ['404.html', notFound]]) {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${name} contains duplicate IDs`);
  }

  const indexStyleVersion = index.match(/styles\.css\?v=([^"']+)/)?.[1];
  const privacyStyleVersion = privacy.match(/styles\.css\?v=([^"']+)/)?.[1];
  const notFoundStyleVersion = notFound.match(/styles\.css\?v=([^"']+)/)?.[1];
  assert.ok(indexStyleVersion);
  assert.equal(indexStyleVersion, privacyStyleVersion);
  assert.equal(indexStyleVersion, notFoundStyleVersion);
  assert.match(index, /script\.js\?v=[^"']+/);
});

test('all repository-local asset references resolve', async () => {
  const refs = new Set();
  for (const source of [index, privacy, notFound]) {
    for (const match of source.matchAll(/(?:src|href|poster|data-src)="(assets\/[^"?#]+)/g)) refs.add(match[1]);
  }
  for (const match of styles.matchAll(/url\(["']?(assets\/[^"')?#]+)/g)) refs.add(match[1]);

  assert.ok(refs.size > 0);
  await Promise.all([...refs].map((ref) => access(path.join(root, ref))));
});

test('crawler metadata exposes the canonical public pages and a useful 404', () => {
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /^Sitemap: https:\/\/barberherman\.ru\/sitemap\.xml$/m);
  assert.match(sitemap, /<loc>https:\/\/barberherman\.ru\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/barberherman\.ru\/privacy\.html<\/loc>/);
  assert.match(notFound, /<meta name="robots" content="noindex,follow">/);
  assert.match(notFound, /href="\/"/);
});

test('only the selected video variants remain and stay within their budgets', async () => {
  assert.match(index, /data-src="assets\/hero-desktop-v2\.mp4(?:\?[^"']+)?"/);
  assert.match(index, /data-src="assets\/hero-mobile\.mp4(?:\?[^"']+)?"/);
  assert.doesNotMatch(index, /assets\/hero-desktop\.mp4/);
  await assert.rejects(access(path.join(root, 'assets/hero-desktop.mp4')));

  const { stat } = await import('node:fs/promises');
  const [desktop, mobile] = await Promise.all([
    stat(path.join(root, 'assets/hero-desktop-v2.mp4')),
    stat(path.join(root, 'assets/hero-mobile.mp4')),
  ]);
  assert.ok(desktop.size <= 5_500_000, `desktop video is ${desktop.size} bytes`);
  assert.ok(mobile.size <= 2_300_000, `mobile video is ${mobile.size} bytes`);
});

test('reduced motion still removes decorative video and ticker movement', () => {
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.stage-video\s*{[\s\S]*?display: none/);
  assert.match(styles, /html\[data-reduce-motion="true"\] \.stage-video\s*{[\s\S]*?display: none/);
  assert.match(styles, /data-reduce-motion="true"\] \.multitool__descriptor-track\s*{[\s\S]*?animation: none/);
  assert.match(styles, /data-reduce-motion="true"\] \.gallery-stage__slide\.is-current \.gallery-stage__image\s*{[\s\S]*?animation: none/);
});

test('presence identity is shared across tabs rather than stored per tab', () => {
  assert.match(script, /const presenceAuthStorageKey = 'barberherman-presence-auth-v2'/);
  assert.match(script, /localStorage\.getItem\(presenceAuthStorageKey\)/);
  assert.match(script, /localStorage\.setItem\(presenceAuthStorageKey/);
  assert.doesNotMatch(script, /sessionStorage\.(?:getItem|setItem)\(presenceAuthStorageKey/);
});
