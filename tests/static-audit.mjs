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
  assert.match(script, /metrika\/tag\.js\?id=\$\{metrikaCounterId\}/);
  assert.match(script, /ssr: true/);
  assert.match(index, /data-analytics-choice="denied"/);
  assert.match(index, /data-analytics-choice="granted"/);
  assert.match(index, /data-privacy-settings/);
});

test('profile and expertise share the final booking continuation', () => {
  const bookingHref = 'https://b11133.yclients.com/company/30187/personal/menu?o=';
  const panels = [
    ['profile-panel', 'Профиль', 'Записаться после раздела «Профиль»'],
    ['practice-panel', 'Экспертиза', 'Записаться после раздела «Экспертиза»'],
  ];

  for (const [panelId, label, accessibleName] of panels) {
    const panel = index.split(`id="${panelId}"`)[1]?.split('</article>')[0] || '';
    assert.match(panel, /class="text-block__continuation"/);
    assert.match(panel, /class="text-block__booking"/);
    assert.match(panel, new RegExp(`href="${bookingHref.replace(/[?]/g, '\\?')}"`));
    assert.match(panel, /target="_blank" rel="noopener"/);
    assert.match(panel, new RegExp(`aria-label="${accessibleName}"`));
    assert.match(panel, /data-metrika-goal="booking_click"/);
    assert.match(panel, new RegExp(`data-metrika-label="${label}"`));
  }
});

test('expertise uses one public name in the menu and panel chrome', () => {
  const panel = index.split('id="practice-panel"')[1]?.split('</article>')[0] || '';
  assert.match(index, /data-panel="practice" aria-label="Экспертиза"/);
  assert.match(panel, />02 \/ Экспертиза<\/button>/);
  assert.match(panel, /<h2 id="practice-title">Экспертиза<\/h2>/);
  assert.doesNotMatch(panel, />02 \/ Практика<\/button>/);
});

test('the skip link is the first interactive control on every public HTML page', () => {
  assert.match(firstInteractiveMarkup(index), /class="skip-link"/);
  assert.match(firstInteractiveMarkup(privacy), /class="skip-link"/);
  assert.match(firstInteractiveMarkup(notFound), /class="skip-link"/);
});

test('mobile reading order and module control semantics stay aligned', () => {
  const multitoolPosition = index.indexOf('class="multitool is-open"');
  const navPosition = index.indexOf('<nav class="multitool__main');
  const mediaPosition = index.indexOf('id="media-panel"');
  const partnersPosition = index.indexOf('id="partners-panel"');
  const sectionsPosition = index.indexOf('class="multitool__sections"');
  const descriptorPosition = index.indexOf('class="multitool__descriptor"');
  const editorialPosition = index.indexOf('class="multitool__editorial-row"');
  const contactsPosition = index.indexOf('class="multitool__contacts"');
  const footerPosition = index.indexOf('class="multitool__footer-surface ');
  const galleryPosition = index.indexOf('id="gallery-panel"');
  const profilePosition = index.indexOf('id="profile-panel"');
  const practicePosition = index.indexOf('id="practice-panel"');
  assert.ok(multitoolPosition >= 0 && multitoolPosition < navPosition);
  assert.ok(navPosition < sectionsPosition);
  assert.ok(sectionsPosition < descriptorPosition);
  assert.ok(descriptorPosition < editorialPosition);
  assert.ok(editorialPosition < contactsPosition);
  assert.ok(contactsPosition < footerPosition);
  assert.ok(footerPosition < mediaPosition);
  assert.ok(mediaPosition < partnersPosition);
  assert.ok(partnersPosition < galleryPosition);
  assert.ok(galleryPosition < profilePosition);
  assert.ok(profilePosition < practicePosition);

  const drawerMarkup = index.slice(index.indexOf('id="multitool-drawer"'), index.indexOf('</nav>', navPosition));
  assert.doesNotMatch(drawerMarkup, /id="(?:media|partners)-panel"/);
  assert.match(index, /class="catalog-panel glass-surface glass-surface--expanded" id="media-panel"/);
  assert.match(index, /class="catalog-panel glass-surface glass-surface--expanded" id="partners-panel"/);

  const panelButtons = [...index.matchAll(/<button type="button" data-panel="[^"]+"[^>]*>/g)].map((match) => match[0]);
  assert.equal(panelButtons.length, 6);
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
    for (const match of source.matchAll(/(?:src|href|poster|data-src|data-featured-src)="(assets\/[^"?#]+)/g)) {
      refs.add(match[1]);
    }
    for (const match of source.matchAll(/(?:srcset|data-srcset)="([^"]+)"/g)) {
      match[1].split(',').forEach((candidate) => {
        const ref = candidate.trim().split(/\s+/)[0].split(/[?#]/)[0];
        if (ref.startsWith('assets/')) refs.add(ref);
      });
    }
  }
  for (const match of styles.matchAll(/url\(["']?(assets\/[^"')?#]+)/g)) refs.add(match[1]);

  assert.ok(refs.size > 0);
  await Promise.all([...refs].map((ref) => access(path.join(root, ref))));
});

test('retired experiments and duplicate production assets stay removed', async () => {
  const retiredFiles = [
    'glass.js',
    'assets/brand-logo.png',
    'assets/herman-childhood-original.jpeg',
    'assets/herman-childhood-squircle.png',
    'assets/portrait-mobile.jpg',
    'assets/logos-transparent/allure.png',
    'assets/logos-transparent/keune.png',
    'assets/logos-transparent/rutv.png',
    'assets/media-logos-desktop.png',
    'assets/media-logos-mobile.png',
    'assets/partner-logos-desktop.png',
    'assets/partner-logos-mobile.png',
    'assets/fonts/bebas-neue-pro-400.woff2',
    'assets/fonts/bebas-neue-pro-600.woff2',
  ];

  await Promise.all(retiredFiles.map((file) => assert.rejects(access(path.join(root, file)))));
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
  assert.ok(desktop.size <= 2_100_000, `desktop video is ${desktop.size} bytes`);
  assert.ok(mobile.size <= 1_250_000, `mobile video is ${mobile.size} bytes`);
  assert.match(script, /window\.requestIdleCallback\(activateStageVideoLoad, \{ timeout: 4000 \}\)/);
  assert.match(script, /\['slow-2g', '2g', '3g'\]\.includes\(effectiveType\)/);
  assert.match(script, /visualQAVideoLoad === 'manual'/);
});

test('closed panels hydrate their images only when opened', () => {
  const catalogMarkup = index.slice(index.indexOf('id="media-panel"'), index.indexOf('id="gallery-panel"'));
  const galleryMarkup = index.slice(index.indexOf('id="gallery-panel"'), index.indexOf('id="profile-panel"'));
  const musicMarkup = index.slice(index.indexOf('id="music-panel"'), index.indexOf('</main>'));

  assert.equal([...catalogMarkup.matchAll(/<img data-src="assets\/logos-transparent\//g)].length, 16);
  assert.doesNotMatch(catalogMarkup, /<img[^>]+\ssrc="/);
  assert.equal([...galleryMarkup.matchAll(/class="gallery-stage__image" data-src=/g)].length, 2);
  assert.doesNotMatch(galleryMarkup, /class="gallery-stage__image" src=/);
  assert.equal([...musicMarkup.matchAll(/data-featured-src="assets\/music-/g)].length, 3);
  assert.equal([...musicMarkup.matchAll(/data-srcset="assets\/music-/g)].length, 3);
  assert.doesNotMatch(musicMarkup, /<img src="assets\/music-/);
  assert.match(script, /function prepareDeferredImages\(panel = document\)/);
  assert.match(script, /panel\.querySelectorAll\('img\[data-src\]'\)\.forEach\(hydrateDeferredImage\)/);
});

test('retired Maxim destination is rendered as a static catalog mark', () => {
  const mediaMarkup = index.slice(index.indexOf('id="media-panel"'), index.indexOf('id="partners-panel"'));

  assert.match(mediaMarkup, /<span class="logo logo-maxim">/);
  assert.doesNotMatch(mediaMarkup, /<a class="logo logo-maxim"/);
  assert.doesNotMatch(mediaMarkup, /maximonline\.ru/);
});

test('reduced motion still removes decorative video and gallery movement', () => {
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.stage-video\s*{[\s\S]*?display: none/);
  assert.match(styles, /html\[data-reduce-motion="true"\] \.stage-video\s*{[\s\S]*?display: none/);
  assert.match(styles, /data-reduce-motion="true"\] \.multitool__descriptor-track\s*{[\s\S]*?animation: none/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.multitool__descriptor-track\s*{[\s\S]*?animation: none/);
  assert.match(styles, /data-reduce-motion="true"\] \.music-panel__track-title-text\s*{[\s\S]*?animation: none !important/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.music-panel__track-title-text\s*{[\s\S]*?animation: none !important/);
  assert.match(styles, /data-reduce-motion="true"\] \.gallery-stage__slide\.is-current \.gallery-stage__image\s*{[\s\S]*?animation: none/);
});

test('playlist title motion and the compact descriptor keep one shared structure', () => {
  assert.equal([...index.matchAll(/class="music-panel__track-title"/g)].length, 40);
  assert.equal([...index.matchAll(/class="music-panel__track-title-text"/g)].length, 40);
  assert.match(index, /href="https:\/\/music\.apple\.com\/ru\/playlist\/www-hermanco-ru-vol-3\/pl\.u-zPyL10Pu8ppgpZ"/);
  assert.match(index, /data-src="assets\/music-vol-3-960\.jpg\?v=20260815-perf1"/);
  assert.match(index, /data-featured-src="assets\/music-vol-3-480\.jpg\?v=20260815-perf1"/);
  assert.match(index, /class="multitool__editorial-meta" aria-hidden="true">3&nbsp;подборки<\/span>/);
  assert.match(index, /data-panel="music" data-featured-playlist="vol-3"/);
  assert.match(index, /data-playlist-cover="august-2026"/);
  assert.match(styles, /\[data-panel="music"\]\s*{[\s\S]*?--editorial-image:\s*url\("assets\/music-vol-3-480\.jpg\?v=20260815-perf1"\)/);
  assert.match(script, /const playlistCoverImages = \[\.\.\.document\.querySelectorAll\('\[data-playlist-cover\] img\[data-featured-src\]'\)\]/);
  assert.match(script, /function syncFeaturedMusicCover\(index = 0\)/);
  assert.match(script, /probe\.addEventListener\('error', \(\) => syncFeaturedMusicCover\(index \+ 1\)/);
  assert.equal([...index.matchAll(/class="multitool__descriptor multitool__descriptor--compact"/g)].length, 1);
  assert.match(script, /const visualQATrackPhase = queryParams\.get\('track-phase'\)/);
  assert.match(script, /title\.dataset\.overflow = 'true'/);
  assert.match(styles, /@keyframes music-track-title-cycle/);
  assert.match(styles, /html\[data-menu-open="false"\] \.multitool__descriptor--compact\s*{[\s\S]*?display: block/);
});

test('the wordmark uses three container-responsive typographic masters', () => {
  assert.match(index, /class="brand-lockup__name">Herman<\/span>/);
  assert.match(index, /class="brand-lockup__company">&amp;Co<\/span>/);
  assert.match(styles, /--brand-master:\s*canonical/);
  assert.match(styles, /@container \(max-width: 359px\)\s*{[\s\S]*?--brand-master:\s*compact/);
  assert.match(styles, /@container \(min-width: 700px\)\s*{[\s\S]*?--brand-master:\s*wide/);
  assert.match(styles, /\.brand-lockup__word\s*{[\s\S]*?font-size:\s*min\(2\.8rem, 7cqi\)/);
  assert.doesNotMatch(styles, /\.brand-lockup(?:__word)?\s*{[^}]*scaleX\(/);
});

test('presence identity is shared across tabs rather than stored per tab', () => {
  assert.match(script, /const presenceAuthStorageKey = 'barberherman-presence-auth-v2'/);
  assert.match(script, /localStorage\.getItem\(presenceAuthStorageKey\)/);
  assert.match(script, /localStorage\.setItem\(presenceAuthStorageKey/);
  assert.doesNotMatch(script, /sessionStorage\.(?:getItem|setItem)\(presenceAuthStorageKey/);
});
