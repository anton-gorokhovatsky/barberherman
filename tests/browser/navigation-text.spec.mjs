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

test('secondary enquiry rows share action axes, hierarchy and keyboard states', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await page.goto(`/?${query.replace('qa-theme=light', `qa-theme=${theme}`)}#expertise`);
    await page.evaluate(() => document.fonts.ready);
    const panel = page.locator('#practice-panel');
    const links = panel.locator('.text-block__action--secondary');
    await expect(links).toHaveCount(3);
    for (const scale of [100, 200]) {
      await page.evaluate((percent) => { document.documentElement.style.fontSize = `${percent}%`; }, scale);
      await expect.poll(() => links.first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16 * scale / 100);
      const axes = await panel.locator('.text-block__action').evaluateAll((actions) => actions.map((el) => {
        const row = el.getBoundingClientRect();
        const copy = el.querySelector('span').getBoundingClientRect();
        const icon = el.querySelector('svg').getBoundingClientRect();
        const style = getComputedStyle(el);
        return { left: copy.left, right: icon.right, width: row.width, height: row.height,
          weight: Number(style.fontWeight), decoration: style.textDecorationLine,
          iconSize: icon.width, iconCenter: icon.top + icon.height / 2,
          rowCenter: row.top + (row.height + parseFloat(style.borderTopWidth)) / 2 };
      }));
      const [booking, ...enquiries] = axes;
      for (const action of enquiries) {
        expect(Math.abs(action.left - booking.left)).toBeLessThanOrEqual(1);
        expect(Math.abs(action.right - booking.right)).toBeLessThanOrEqual(1);
        expect(Math.abs(action.width - booking.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(action.iconCenter - action.rowCenter)).toBeLessThanOrEqual(1);
        expect(action.height).toBeGreaterThanOrEqual(44);
        expect(action.weight).toBeLessThan(booking.weight);
        expect(action.decoration).toBe('none');
        expect(action.iconSize).toBe(booking.iconSize);
      }
      for (const link of await links.all()) {
        await link.scrollIntoViewIfNeeded();
        await link.focus();
        await expect(link).toBeFocused();
        await expect(link).not.toHaveCSS('box-shadow', 'none');
        await expect(link.locator('svg use')).toHaveAttribute('href', '#icon-outbound');
        await expect(link).toHaveAttribute('href', 'mailto:info@barberherman.ru');
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
  }
});

test('all contextual actions keep shared rhythm across panels, window heights and text sizes', async ({ page }) => {
  const width = page.viewportSize().width;
  for (const height of [600, 1000]) {
    await page.setViewportSize({ width, height });
    for (const scale of [100, 200]) {
      await ready(page, `&qa-text=${scale}#profile`);
      const profile = page.locator('#profile-panel');
      const forward = profile.locator('a[href="#expertise"]');
      await expect(forward).toHaveCSS('text-decoration-line', 'none');
      await expect(forward.locator('svg use')).toHaveAttribute('href', '#icon-forward');
      const factsLayout = await profile.evaluate(panel => {
        const scroll = panel.querySelector('.text-block__scroll');
        const style = getComputedStyle(scroll);
        const measure = scroll.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        return { shouldStack: measure <= 18 * rem,
          rows: [...panel.querySelectorAll('.facts div')].map(row => ({
            columns: getComputedStyle(row).gridTemplateColumns.split(' ').length,
            gap: row.querySelector('dd').getBoundingClientRect().top - row.querySelector('dt').getBoundingClientRect().bottom,
          })) };
      });
      if (factsLayout.shouldStack) for (const row of factsLayout.rows) {
        expect(row.columns).toBe(1);
        expect(row.gap).toBeGreaterThanOrEqual(8);
      }
      const geometry = await profile.evaluate((panel) => {
        const rows = [...panel.querySelectorAll('.text-block__action')];
        const rect = (el) => el.getBoundingClientRect();
        const facts = rect(panel.querySelector('.facts'));
        const group = rect(panel.querySelector('.text-block__continuation'));
        return { attachedGap: group.top - facts.bottom,
          separatorLeft: group.left - facts.left,
          separatorRight: group.right - facts.right,
          rowGap: rect(rows[1]).top - rect(rows[0]).bottom,
          rows: rows.map(el => ({
            textLeft: rect(el.querySelector('span')).left,
            iconRight: rect(el.querySelector('svg')).right,
            weight: Number(getComputedStyle(el).fontWeight),
            height: rect(el).height,
            parent: el.parentElement.className,
          })) };
      });
      for (const key of ['attachedGap', 'separatorLeft', 'separatorRight', 'rowGap']) expect(Math.abs(geometry[key]), key).toBeLessThanOrEqual(1);
      expect(geometry.rows).toHaveLength(2);
      const [secondary, booking] = geometry.rows;
      expect(secondary.weight).toBeLessThan(booking.weight);
      expect(Math.abs(secondary.textLeft - booking.textLeft)).toBeLessThanOrEqual(1);
      expect(Math.abs(secondary.iconRight - booking.iconRight)).toBeLessThanOrEqual(1);
      geometry.rows.forEach(row => {
        expect(row.height).toBeGreaterThanOrEqual(44);
        expect(row.parent).toBe('text-block__continuation');
      });
      await forward.focus();
      await expect(forward).toBeFocused();
      await expect(forward).not.toHaveCSS('box-shadow', 'none');
      await forward.press('Enter');
      await expect(page).toHaveURL(/#expertise$/);
      const practice = page.locator('#practice-panel');
      await expect(practice).toBeVisible();
      await expect.poll(() => practice.locator('.text-block__action').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(18 * scale / 100);
      const rhythm = await practice.evaluate(panel => {
        const groups = [...panel.querySelectorAll('.practice-group')];
        return { rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
          groups: groups.map((el, i) => {
            const list = el.querySelector('ul').getBoundingClientRect();
            const continuation = el.querySelector('.text-block__continuation');
            const action = continuation.querySelector('.text-block__action');
            const box = continuation.getBoundingClientRect();
            return { actionGap: box.top - list.bottom,
              nextGap: i ? el.getBoundingClientRect().top - groups[i - 1].getBoundingClientRect().bottom : null,
              textAxis: action.querySelector('span').getBoundingClientRect().left - list.left,
              parent: action.parentElement.className,
              bottomBorder: parseFloat(getComputedStyle(continuation).borderBottomWidth) };
          }) };
      });
      expect(rhythm.groups).toHaveLength(4);
      for (const group of rhythm.groups) {
        expect(Math.abs(group.actionGap - rhythm.rem * .75)).toBeLessThanOrEqual(1);
        if (group.nextGap !== null) expect(Math.abs(group.nextGap - rhythm.rem * 2)).toBeLessThanOrEqual(1);
        expect(Math.abs(group.textAxis)).toBeLessThanOrEqual(1);
        expect(group.parent).toBe('text-block__continuation');
        expect(group.bottomBorder).toBe(0);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
  }
});

test('editorial symbols keep their clearance with real text scaling', async ({ page }) => {
  await ready(page);
  for (const percent of [100, 125, 150, 200]) {
    await page.evaluate((scale) => { document.documentElement.style.fontSize = `${scale}%`; }, percent);
    await expect.poll(() => page.locator('.multitool__editorial-meta').first().evaluate(
      (element) => parseFloat(getComputedStyle(element).fontSize)
    )).toBeGreaterThanOrEqual(12 * percent / 100);
    await expect.poll(() => page.locator('.multitool__editorial-row button').evaluateAll((buttons) => (
      Math.min(...buttons.map((button) => (
        button.querySelector('.multitool__editorial-copy').getBoundingClientRect().top
        - button.querySelector('.multitool__editorial-mark').getBoundingClientRect().bottom
      )))
    ))).toBeGreaterThanOrEqual(4);
  }
});

test('live information labels and values never collide when text grows', async ({ page }) => {
  await ready(page);
  for (const percent of [100, 125, 150, 200]) {
    await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale}%`; }, percent);
    await expect.poll(() => page.locator('.multitool__live-label').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(10 * percent / 100);
    const cells = await page.locator('.multitool__presence, .multitool__weather').evaluateAll(elements => elements.map(el => {
      const box = el.getBoundingClientRect();
      const label = el.querySelector('.multitool__live-label').getBoundingClientRect();
      const value = el.querySelector('strong').getBoundingClientRect();
      const right = Math.max(...[...el.querySelector('strong').children].map(child => child.getBoundingClientRect().right));
      return { distinct: label.right <= value.left + 1 || label.bottom <= value.top + 1,
        overflow: right - box.right };
    }));
    for (const cell of cells) {
      expect(cell.distinct).toBe(true);
      expect(cell.overflow).toBeLessThanOrEqual(1);
    }
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
  // WebKit may resolve inherited rem tokens a frame later on navigation too.
  // Require the exact same final font values, without weakening the comparison.
  await expect.poll(async () => (await measure()).fonts).toEqual(actual.fonts);
  const qa = await measure();
  expect(qa.fonts).toEqual(actual.fonts);
  expect(qa.columns).toEqual(actual.columns);
  expect(qa.overflow).toBe(false);
});
