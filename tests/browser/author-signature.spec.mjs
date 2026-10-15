import { expect, test } from '@playwright/test';

const moduleUrl = 'https://gorokhovatsky.tech/signature/1.0.2/signature.js';
const projectUrl = 'https://gorokhovatsky.tech/?point=herman';
const creditName = 'Сайт сделал Антон Гороховатский';
const query = 'qa-analytics=denied&qa-online=1&qa-weather-temperature=20&qa-weather-code=0';
let sharedModule;

test.beforeAll(async ({ request }) => {
  // Exercise the exact published dependency, without a second copy of its mark.
  const response = await request.get(moduleUrl, { timeout: 20000 });
  expect(response.ok()).toBeTruthy();
  expect(response.headers()['content-type']).toContain('javascript');
  sharedModule = await response.text();
});

async function serveSignature(page) {
  await page.route(moduleUrl, route => route.fulfill({
    body: sharedModule,
    contentType: 'application/javascript',
    headers: { 'access-control-allow-origin': '*' },
  }));
}

async function openSignature(page, theme = 'light', scale = 100) {
  await page.goto(`/?${query}&qa-theme=${theme}&qa-motion=reduce&qa-text=${scale}`);
  await expect(page.locator('ag-signature [part="footer-arrow"]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return page.locator('ag-signature').getByRole('link', { name: creditName, exact: true });
}

test('author credit shares a complete cell, native navigation and site states', async ({ page, browserName }) => {
  await serveSignature(page);
  await page.route(projectUrl, route => route.fulfill({ contentType: 'text/html', body: '<title>Author project</title>' }));
  const credit = await openSignature(page);
  await expect(credit).toHaveAttribute('href', projectUrl);
  await expect(credit).toHaveAttribute('target', '_blank');
  await expect(credit).toHaveAttribute('rel', /author.*noopener/);
  await page.locator('.multitool__privacy-link').focus();
  await page.keyboard.press('Tab');
  if (browserName === 'webkit') await credit.focus();
  await expect(credit).toBeFocused();
  expect(await credit.evaluate(el => getComputedStyle(el).outlineOffset)).toBe('-3px');
  const geometry = await credit.evaluate(el => ({
    width: el.getBoundingClientRect().width,
    parentWidth: document.querySelector('.multitool__meta').getBoundingClientRect().width,
    height: el.getBoundingClientRect().height,
    nameTop: el.querySelector('.name').getBoundingClientRect().top,
    roleTop: el.querySelector('.role').getBoundingClientRect().top,
    arrow: el.querySelector('[part="footer-arrow"] path').getAttribute('d'),
    sharedArrow: document.querySelector('#icon-arrow-path').getAttribute('d'),
  }));
  expect(Math.abs(geometry.width - geometry.parentWidth)).toBeLessThan(1);
  expect(geometry.height).toBeGreaterThanOrEqual(44);
  expect(geometry.height).toBeLessThanOrEqual(46);
  if (page.viewportSize().width > 900) {
    expect(Math.abs(geometry.nameTop - geometry.roleTop)).toBeLessThan(1);
  }
  expect(geometry.arrow).toBe(geometry.sharedArrow);
  await credit.hover();
  const hovered = await credit.evaluate(el => getComputedStyle(el).backgroundColor);
  await page.locator('.multitool__privacy-link').hover();
  await expect.poll(() => page.locator('.multitool__privacy-link').evaluate(el => getComputedStyle(el).backgroundColor)).toBe(hovered);
  const opened = page.waitForEvent('popup');
  await credit.click({ position: { x: 2, y: 2 } });
  const popup = await opened;
  await popup.waitForURL(projectUrl);
  await popup.close();
});

test('author footer reflows throughout supported widths, themes and text scales', async ({ page }, testInfo) => {
  test.skip(testInfo.project.use.viewport.width !== 1060, 'One continuous sweep per browser engine.');
  test.setTimeout(120000);
  await serveSignature(page);
  const widths = [...new Set([
    ...Array.from({ length: 71 }, (_, i) => 320 + i * 32),
    360, 375, 390, 398, 414, 430, 479, 480, 481, 679, 680, 681,
    768, 820, 899, 900, 901, 960, 1024, 1060, 1280, 1440, 1920, 2560,
  ])].sort((a, b) => a - b);
  for (const theme of ['light', 'dark']) for (const scale of [100, 200]) {
    await openSignature(page, theme, scale);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      // Chromium may report a new viewport before the previous media layout settles.
      await expect(async () => {
        const result = await page.evaluate(async () => {
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const host = document.querySelector('ag-signature');
          const shadow = host.shadowRoot;
          const link = shadow.querySelector('.credit').getBoundingClientRect();
          const text = shadow.querySelector('.text').getBoundingClientRect();
          const arrow = shadow.querySelector('[part="footer-arrow"]').getBoundingClientRect();
          const footer = document.querySelector('.multitool__footer-surface').getBoundingClientRect();
          const main = document.querySelector('.multitool__main').getBoundingClientRect();
          const service = document.querySelector('.multitool__service').getBoundingClientRect();
          const family = document.createRange();
          family.selectNodeContents(shadow.querySelector('.surname'));
          const lines = [...family.getClientRects()].filter(r => r.width > 0 && r.height > 0);
          return {
            overflow: document.documentElement.scrollWidth - innerWidth,
            right: link.right,
            textArrowOverlap: text.left < arrow.right && text.right > arrow.left
              && text.top < arrow.bottom && text.bottom > arrow.top,
            footerRight: footer.right, linkBottom: link.bottom, footerBottom: footer.bottom,
            serviceTop: service.top, axes: [Math.abs(main.x - footer.x), Math.abs(main.width - footer.width)],
            splitFamily: lines.length ? Math.max(...lines.map(r => r.top)) - Math.min(...lines.map(r => r.top)) : 0,
            nameFont: getComputedStyle(shadow.querySelector('.name')).font,
            columns: getComputedStyle(shadow.querySelector('.credit')).gridTemplateColumns,
            controls: [...document.querySelectorAll('.multitool__service button')].filter(el => el.getClientRects().length).map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })),
          };
        });
        const label = `${testInfo.project.name} ${theme} ${scale}% ${width}px`;
        expect(result.overflow, label).toBeLessThanOrEqual(0);
        expect(result.textArrowOverlap, label).toBe(false);
        expect(result.right, label).toBeLessThanOrEqual(result.footerRight);
        expect(result.linkBottom, label).toBeLessThanOrEqual(result.footerBottom);
        if (width <= 900) expect(result.linkBottom, label).toBeLessThanOrEqual(result.serviceTop + 1);
        expect(Math.max(...result.axes), label).toBeLessThanOrEqual(1);
        expect(result.splitFamily, `${label}; ${result.nameFont}; columns ${result.columns}`).toBeLessThan(2);
        for (const control of result.controls) {
          expect(control.width, label).toBeGreaterThanOrEqual(44);
          expect(control.height, label).toBeGreaterThanOrEqual(44);
        }
      }).toPass({ timeout: 3000 });
    }
  }
});

test('the signature follows the site motion switch and stricter system preference', async ({ page }, testInfo) => {
  test.skip(testInfo.project.use.viewport.width !== 1060, 'One motion check per browser engine.');
  await serveSignature(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`/?${query}&qa-theme=light`);
  const mark = page.locator('ag-signature .mark');
  await mark.scrollIntoViewIfNeeded();
  await expect(mark).toHaveAttribute('data-arc-running', 'true');
  await page.locator('.motion-toggle').click();
  await expect(mark).toHaveAttribute('data-arc-running', 'false');
  await page.locator('.motion-toggle').click();
  await expect(mark).toHaveAttribute('data-arc-running', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(mark).toHaveAttribute('data-arc-running', 'false');
  await expect(page.locator('ag-signature .motion')).toBeHidden();
});

test('a slow or unavailable signature never blocks the menu or its fallback link', async ({ page }) => {
  let release;
  const delayed = new Promise(resolve => { release = resolve; });
  await page.route(moduleUrl, async route => {
    await delayed;
    await route.fulfill({ body: sharedModule, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto(`/?${query}&qa-motion=reduce`, { waitUntil: 'domcontentloaded' });
  const credit = page.locator('ag-signature').getByRole('link', { name: creditName, exact: true });
  await expect(credit).toBeVisible();
  await expect(credit).toHaveAttribute('href', projectUrl);
  await page.getByRole('button', { name: 'Профиль', exact: true }).click();
  await expect(page.locator('#profile-panel')).toBeVisible();
  release();
  await expect(page.locator('ag-signature [part="footer-arrow"]')).toBeAttached();
  await expect(credit).toHaveAttribute('href', projectUrl);
  await page.unroute(moduleUrl);
  await page.route(moduleUrl, route => route.abort());
  await page.goto(`/?${query}&qa-motion=reduce`);
  await expect(credit).toBeVisible();
  await expect(credit).toHaveAttribute('href', projectUrl);
  expect((await credit.boundingBox()).height).toBeGreaterThanOrEqual(44);
});
