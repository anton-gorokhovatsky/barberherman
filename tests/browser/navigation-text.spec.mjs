import { expect, test } from '@playwright/test';

const query = 'qa-theme=light&qa-motion=reduce&qa-analytics=denied&qa-online=1&qa-weather-temperature=20&qa-weather-code=0';
async function ready(page, suffix = '') {
  await page.goto(`/?${query}${suffix}`);
  await expect(page.locator('html')).toHaveAttribute('data-menu-open', 'true');
  await page.evaluate(() => document.fonts.ready);
}

test('direct section addresses, reload and browser history preserve panel state', async ({ page }) => {
  await ready(page);
  await page.locator('[data-panel="profile"]').click();
  await expect(page).toHaveURL(/#profile$/);
  await page.locator('[data-panel="practice"]').click();
  await expect(page).toHaveURL(/#expertise$/);
  await page.reload();
  await expect(page.locator('#practice-panel')).toBeVisible();
  if (page.viewportSize().width > 900) await expect(page.locator('#profile-panel')).toBeVisible();
  else await expect(page.locator('#profile-panel')).toBeHidden();
  await page.goBack();
  await expect(page).toHaveURL(/#profile$/);
  await expect(page.locator('#profile-panel')).toBeVisible();
  await expect(page.locator('#practice-panel')).toBeHidden();
  await page.goForward();
  await expect(page.locator('#practice-panel')).toBeVisible();
  await page.locator('[data-close-panel="practice"]').click();
  await expect(page.locator('#practice-panel')).toBeHidden();
  await page.goBack();
  await expect(page.locator('#practice-panel')).toBeVisible();
});

test('every panel and playlist can be reached directly and unknown anchors are safe', async ({ page }) => {
  for (const [slug, panel] of Object.entries({ profile: 'profile', expertise: 'practice', media: 'media', partners: 'partners', archive: 'gallery', music: 'music' })) {
    await ready(page, `#${slug}`);
    await expect(page.locator(`#${panel}-panel`)).toBeVisible();
  }
  await ready(page, '#music-panel');
  await expect(page.locator('#music-panel')).toBeVisible();
  for (const playlist of ['vol-4', 'vol-3', 'vol-2', 'august-2026']) {
    await ready(page, `#music/${playlist}`);
    await expect(page.locator(`#music-${playlist} h2`)).toBeInViewport();
    await page.reload();
    await expect(page.locator(`#music-${playlist} h2`)).toBeInViewport();
  }
  for (const hash of ['#unknown', '#__proto__', '#music/missing', '#%E0%A4%A']) {
    await ready(page, hash);
    await page.reload();
    await expect(page.locator('#music-panel')).toBeHidden();
    await page.locator('[data-panel="music"]').click();
    await expect(page.locator('#music-panel')).toBeVisible();
  }
});

test('profile and expertise offer distinct contextual next steps', async ({ page }) => {
  await ready(page, '#profile');
  await page.locator('#profile-panel a[href="#expertise"]').click();
  await expect(page).toHaveURL(/#expertise$/);
  const expertise = page.locator('#practice-panel');
  await expect(expertise.getByRole('link', { name: 'Записаться на стрижку', exact: true })).toHaveAttribute('data-metrika-goal', 'booking_click');
  for (const booking of await page.locator('[data-metrika-goal="booking_click"]').all()) {
    await expect(booking).toHaveAttribute('href', 'https://b11133.yclients.com/company/30187/personal/menu?o=');
  }
  for (const label of ['Обучение', 'Съёмки и показы', 'Консалтинг']) {
    const link = expertise.locator(`[data-metrika-label="${label}"]`);
    await link.scrollIntoViewIfNeeded();
    await expect(link).toHaveAttribute('href', 'mailto:info@barberherman.ru');
    await expect(link).toHaveAttribute('data-metrika-goal', 'email_click');
    await expect(link).not.toHaveAttribute('target', '_blank');
    await link.focus();
    await expect(link).toBeFocused();
    expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
});

test('real 200% base text grows and matches QA layout without special selectors', async ({ page }) => {
  await ready(page, '#profile');
  const measure = () => page.evaluate(() => {
    const selectors = ['#profile-panel h2', '#profile-panel .text-block__lead', '#profile-panel p:not(.text-block__lead)', '.site-legal', '[data-panel="profile"] .multitool__section-label'];
    return {
      fonts: selectors.map((selector) => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize)),
      columns: getComputedStyle(document.querySelector('.multitool__editorial-row')).gridTemplateColumns,
      overflow: document.documentElement.scrollWidth > innerWidth,
      controls: [...document.querySelectorAll('.multitool a, .multitool button')].filter((el) => el.getClientRects().length).map((el) => {
        const { width, height, left, right } = el.getBoundingClientRect();
        return { width, height, left, right };
      }),
    };
  });
  const normal = await measure();
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  // Wait for font/container invalidation, not an arbitrary number of frames.
  // The growth itself remains the required condition, including under load.
  await expect.poll(async () => Math.min(...(await measure()).fonts.map(
    (size, index) => size / normal.fonts[index]
  ))).toBeGreaterThanOrEqual(1.75);
  const actual = await measure();
  actual.fonts.forEach((size, index) => expect(size / normal.fonts[index], `font role ${index}: ${normal.fonts[index]} → ${size}`).toBeGreaterThanOrEqual(1.75));
  expect(actual.overflow).toBe(false);
  expect(actual.controls.filter(({ width, height, left, right }) => width < 44 || height < 44 || left < -.5 || right > page.viewportSize().width + .5)).toEqual([]);
  await ready(page, '&qa-text=200#profile');
  const qa = await measure();
  expect(qa.fonts).toEqual(actual.fonts);
  expect(qa.columns).toEqual(actual.columns);
  expect(qa.overflow).toBe(false);
});
