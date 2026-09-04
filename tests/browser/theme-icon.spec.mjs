import { expect, test } from '@playwright/test';

const query = 'qa-theme=light&qa-section=footer&qa-video-load=manual&qa-analytics=denied&qa-online=1&qa-weather-temperature=20&qa-weather-code=0';
const iconPath = '.theme-toggle__icon--morph path';

async function openIcon(page, extra = '') {
  await page.goto(`/?${query}${extra}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.theme-toggle')).toHaveAttribute('data-theme-icon', 'morph');
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.theme-toggle').scrollIntoViewIfNeeded();
}

async function endpoint(page, theme) {
  return page.evaluate(async (target) => {
    const { canonicalD } = await import('/assets/vendor/morphicons-1.7.1/dom.js');
    const svg = document.querySelector(`.theme-toggle__icon--${target}`);
    return canonicalD([...svg.children].map((node) => [node.localName,
      Object.fromEntries([...node.attributes].map(({ name, value }) => [name, value])),
    ]));
  }, theme);
}

async function frames(page, count = 12) {
  return page.evaluate(async (length) => {
    const samples = [];
    for (let i = 0; i < length; i += 1) {
      await new Promise(requestAnimationFrame);
      samples.push(document.querySelector('.theme-toggle__icon--morph path').getAttribute('d'));
    }
    return samples;
  }, count);
}

test('theme morph keeps the accepted endpoints, hit area and keyboard behaviour', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openIcon(page);
  const button = page.locator('.theme-toggle');
  const path = page.locator(iconPath);
  const moon = await endpoint(page, 'dark');
  const sun = await endpoint(page, 'light');
  await expect(path).toHaveAttribute('d', moon);
  const box = await button.boundingBox();
  await expect(page.locator('.theme-toggle__icon--morph')).toHaveCSS('pointer-events', 'none');
  await button.click();
  await expect(button).toHaveAccessibleName('Включить светлую тему');
  const intermediate = await frames(page);
  expect(intermediate.some((value) => value !== moon && value !== sun)).toBeTruthy();
  await expect(path).toHaveAttribute('d', sun);
  expect(await button.boundingBox()).toEqual(box);
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(button).toBeFocused();
  await expect(button).toHaveAccessibleName('Включить тёмную тему');
  await expect(path).toHaveAttribute('d', moon);
  await expect(page.locator('.text-block:not([hidden]), .gallery-stage:not([hidden]), .catalog-panel:not([hidden])')).toHaveCount(0);
});

test('rapid reversal settles on the final theme without replacing the control', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openIcon(page);
  const sun = await endpoint(page, 'light');
  const sameButton = await page.evaluate(async () => {
    const button = document.querySelector('.theme-toggle');
    for (let i = 0; i < 5; i += 1) {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 45));
    }
    return button === document.querySelector('.theme-toggle');
  });
  expect(sameButton).toBeTruthy();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator(iconPath)).toHaveAttribute('d', sun);
  await expect(page.locator('.theme-toggle__icon--morph')).toHaveCount(1);
});

test('system reduced motion changes the icon instantly', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openIcon(page);
  const sun = await endpoint(page, 'light');
  await page.locator('.theme-toggle').click();
  expect(new Set(await frames(page))).toEqual(new Set([sun]));
});

test('site reduced motion stops an in-flight morph and subsequent animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openIcon(page);
  const sun = await endpoint(page, 'light');
  const moon = await endpoint(page, 'dark');
  await page.locator('.theme-toggle').click();
  await page.locator('.motion-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', 'true');
  expect(new Set(await frames(page))).toEqual(new Set([sun]));
  await page.locator('.theme-toggle').click();
  expect(new Set(await frames(page))).toEqual(new Set([moon]));
});

test('an unavailable enhancement keeps the original working static icons', async ({ page }) => {
  await page.route('**/assets/theme-icon.mjs', (route) => route.abort());
  await page.goto(`/?${query}`, { waitUntil: 'domcontentloaded' });
  const button = page.locator('.theme-toggle');
  await expect(button).not.toHaveAttribute('data-theme-icon', 'morph');
  await expect(page.locator('.theme-toggle__icon--dark')).toHaveCSS('opacity', '1');
  await button.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.theme-toggle__icon--light')).toHaveCSS('opacity', '1');
  await expect(button).toHaveAccessibleName('Включить светлую тему');
});
