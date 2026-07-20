import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const baseQuery = [
  'qa-theme=light',
  'qa-motion=reduce',
  'qa-analytics=denied',
  'qa-online=1',
  'qa-weather-temperature=20',
  'qa-weather-code=0',
].join('&');

async function openReady(page, path = `/?${baseQuery}`) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBeTruthy();
  if (await page.locator('script[src*="script.js"]').count()) {
    await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', /^(?:true|false)$/);
  }
  await page.evaluate(() => document.fonts.ready);
}

async function focusSkipLink(page, browserName) {
  const skipLink = page.locator('.skip-link');
  if (browserName === 'webkit') {
    // Safari follows the macOS keyboard-navigation preference for links.
    // Direct focus verifies the shared component without making CI depend on
    // the host's "Press Tab to highlight each item" setting.
    await skipLink.focus();
  } else {
    await page.keyboard.press('Tab');
  }
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
}

async function expectNoSeriousAxeViolations(page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const violations = result.violations.filter(({ impact }) => ['serious', 'critical'].includes(impact));
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

test('reflow, common axes, focus and accessibility remain intact', async ({ page, browserName }) => {
  await openReady(page);

  const audit = await page.evaluate(() => {
    const rect = (element) => {
      const box = element.getBoundingClientRect();
      return {
        x: box.x,
        right: box.right,
        width: box.width,
        height: box.height,
        center: box.x + box.width / 2,
      };
    };
    const visible = (element) => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    };
    const controls = [...document.querySelectorAll('.multitool a, .multitool button')]
      .filter(visible)
      .map((element) => ({ label: element.getAttribute('aria-label') || element.textContent.trim(), ...rect(element) }));
    const service = document.querySelector('.multitool__service');
    const brand = document.querySelector('.multitool__brand');
    const booking = document.querySelector('.multitool__booking');
    const profile = document.querySelector('[data-panel="profile"]');
    const practice = document.querySelector('[data-panel="practice"]');
    return {
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      firstInteractive: document.querySelector('a[href], button, input, select, textarea')?.className,
      controls,
      contact: rect(document.querySelector('.multitool__contacts')),
      privacy: rect(document.querySelector('.multitool__privacy-link')),
      credit: rect(document.querySelector('.multitool__meta')),
      service: rect(service),
      serviceButtons: [...service.children].filter(visible).map(rect),
      socialJustification: [...document.querySelectorAll('.multitool__icon-link')]
        .map((element) => getComputedStyle(element).justifyContent),
      primarySplit: {
        brandRight: rect(brand).right,
        bookingLeft: rect(booking).x,
        profileRight: rect(profile).right,
        practiceLeft: rect(practice).x,
        brandBorderRight: Number.parseFloat(getComputedStyle(brand).borderRightWidth),
        profileBorderRight: Number.parseFloat(getComputedStyle(profile).borderRightWidth),
        practiceBorderLeft: Number.parseFloat(getComputedStyle(practice).borderLeftWidth),
      },
    };
  });

  expect(audit.scrollWidth).toBeLessThanOrEqual(audit.innerWidth);
  expect(audit.firstInteractive).toContain('skip-link');
  expect(audit.contact.height).toBeLessThanOrEqual(73);
  expect(audit.controls.filter(({ width, height }) => width < 44 || height < 44)).toEqual([]);
  expect(Math.abs(audit.primarySplit.brandRight - audit.primarySplit.bookingLeft)).toBeLessThanOrEqual(.01);
  expect(Math.abs(audit.primarySplit.brandRight - audit.primarySplit.profileRight)).toBeLessThanOrEqual(.01);
  expect(Math.abs(audit.primarySplit.brandRight - audit.primarySplit.practiceLeft)).toBeLessThanOrEqual(.01);
  expect(audit.primarySplit.brandBorderRight).toBeGreaterThan(0);
  expect(audit.primarySplit.profileBorderRight).toBe(audit.primarySplit.brandBorderRight);
  expect(audit.primarySplit.practiceBorderLeft).toBe(0);

  if (audit.innerWidth <= 900) {
    for (const floor of [audit.privacy, audit.credit, audit.service]) {
      expect(Math.abs(floor.center - audit.innerWidth / 2)).toBeLessThanOrEqual(.5);
    }
    const widths = audit.serviceButtons.map(({ width }) => width);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(.5);
  } else {
    expect(Math.abs(audit.privacy.x - audit.service.x)).toBeLessThanOrEqual(.5);
    expect(audit.socialJustification).toEqual(['flex-start', 'flex-start']);
  }

  await focusSkipLink(page, browserName);
  await expectNoSeriousAxeViolations(page);
});

test('200% text and reduced motion preserve content and controls', async ({ page }) => {
  await openReady(page, `/?${baseQuery}&qa-text=200&qa-safe-area=iphone`);

  const audit = await page.evaluate(() => {
    const visibleControls = [...document.querySelectorAll('.multitool a, .multitool button')]
      .filter((element) => getComputedStyle(element).display !== 'none' && element.getClientRects().length > 0)
      .map((element) => {
        const box = element.getBoundingClientRect();
        return { width: box.width, height: box.height, left: box.left, right: box.right };
      });
    return {
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      reducedMotion: document.documentElement.dataset.reduceMotion,
      badControls: visibleControls.filter(({ width, height }) => width < 44 || height < 44),
      outsideControls: visibleControls.filter(({ left, right }) => left < -.5 || right > innerWidth + .5),
      videos: [...document.querySelectorAll('.stage-video')].map((video) => ({
        display: getComputedStyle(video).display,
        src: video.getAttribute('src'),
        currentSrc: video.currentSrc,
        noSource: video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE,
        paused: video.paused,
      })),
      tickerAnimation: getComputedStyle(document.querySelector('.multitool__descriptor-track')).animationName,
    };
  });

  expect(audit.scrollWidth).toBeLessThanOrEqual(audit.innerWidth);
  expect(audit.badControls).toEqual([]);
  expect(audit.outsideControls).toEqual([]);
  const videosAreStopped = audit.videos.every(({ display, src, currentSrc, noSource, paused }) => (
    display === 'none'
    && src === null
    && currentSrc === ''
    && (paused || noSource)
  ));
  expect(audit.reducedMotion).toBe('true');
  expect(videosAreStopped, JSON.stringify(audit, null, 2)).toBeTruthy();
  expect(audit.tickerAnimation).toBe('none');
});

test('full motion selects one inline muted video and autoplay remains available', async ({ page }) => {
  await openReady(page, `/?qa-theme=light&qa-motion=full&qa-analytics=denied&qa-online=1&qa-weather-temperature=20&qa-weather-code=0`);

  const isMobile = (await page.viewportSize()).width <= 900;
  const activeSelector = isMobile ? '.stage-video--mobile' : '.stage-video--desktop';
  const inactiveSelector = isMobile ? '.stage-video--desktop' : '.stage-video--mobile';
  const activeVideo = page.locator(activeSelector);

  await expect(activeVideo).toHaveAttribute('muted', '');
  await expect(activeVideo).toHaveAttribute('playsinline', '');
  await expect(activeVideo).toHaveAttribute('poster', /assets\/hero(?:-mobile)?\.jpg/);
  await expect(activeVideo).toHaveAttribute('src', isMobile ? /hero-mobile\.mp4/ : /hero-desktop-v2\.mp4/);
  await expect(page.locator(inactiveSelector)).not.toHaveAttribute('src', /.+/);
  await page.waitForFunction((selector) => {
    const video = document.querySelector(selector);
    return video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !video.paused;
  }, activeSelector);
});

test('modules announce, focus and retain the intended responsive state', async ({ page }) => {
  await openReady(page);

  const profile = page.getByRole('button', { name: 'Профиль', exact: true });
  const practice = page.getByRole('button', { name: 'Экспертиза', exact: true });
  await profile.click();
  await expect(profile).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#profile-panel')).toBeVisible();

  const isMobile = (await page.viewportSize()).width <= 900;
  if (isMobile) await expect(page.locator('#profile-panel')).toBeFocused();

  await practice.click();
  await expect(practice).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#practice-panel')).toBeVisible();

  if (isMobile) {
    await expect(profile).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#profile-panel')).toBeHidden();
    await expect(page.locator('#practice-panel')).toBeFocused();
  } else {
    await expect(profile).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#profile-panel')).toBeVisible();
  }
});

test('list-view logos share one row rhythm and one visible left axis', async ({ page }) => {
  await openReady(page, `/?${baseQuery}&qa-logo-view=list&qa-section=media`);

  const auditPanel = async (selector) => page.locator(selector).evaluate((panel) => (
    [...panel.querySelectorAll('.logo')].map((cell) => {
      const cellBox = cell.getBoundingClientRect();
      const imageBox = cell.querySelector('img').getBoundingClientRect();
      return {
        rowHeight: cellBox.height,
        imageLeft: imageBox.left - cellBox.left,
        imageWidth: imageBox.width,
        imageHeight: imageBox.height,
      };
    })
  ));

  const assertSharedSystem = (metrics) => {
    expect(new Set(metrics.map(({ rowHeight }) => Math.round(rowHeight))).size).toBe(1);
    expect(Math.max(...metrics.map(({ imageLeft }) => imageLeft)) - Math.min(...metrics.map(({ imageLeft }) => imageLeft))).toBeLessThanOrEqual(.5);
    expect(Math.max(...metrics.map(({ imageWidth }) => imageWidth))).toBeLessThanOrEqual(164.5);
    expect(Math.max(...metrics.map(({ imageHeight }) => imageHeight))).toBeLessThanOrEqual(52.5);
  };

  assertSharedSystem(await auditPanel('#media-panel'));
  await page.getByRole('button', { name: 'Партнёрства', exact: true }).click();
  assertSharedSystem(await auditPanel('#partners-panel'));
});

test('gallery is a peer content panel with edge-to-edge imagery and keyboard navigation', async ({ page }) => {
  await openReady(page);

  const galleryButton = page.locator('[data-panel="gallery"]');
  const gallery = page.locator('#gallery-panel');
  const track = gallery.getByRole('region', { name: 'Фотографии из личного архива', exact: true });
  const count = gallery.locator('[data-gallery-count]');
  const isMobile = (await page.viewportSize()).width <= 900;

  if (!isMobile) {
    await page.getByRole('button', { name: 'Профиль', exact: true }).click();
    await page.getByRole('button', { name: 'Экспертиза', exact: true }).click();
  }

  await galleryButton.click();
  await expect(galleryButton).toHaveAttribute('aria-expanded', 'true');
  await expect(gallery).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-gallery-open', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-menu-open', 'true');
  await expect(page.locator('#multitool-drawer')).toBeVisible();
  await expect(count).toHaveText('01 / 02');
  await expect(gallery.getByRole('button', { name: 'Предыдущая фотография', exact: true })).toBeDisabled();

  if (isMobile) await expect(gallery).toBeFocused();

  const geometry = await gallery.evaluate((element) => {
    const track = element.querySelector('.gallery-stage__track');
    const photo = element.querySelector('.gallery-stage__slide.is-current .gallery-stage__image-wrap');
    const panelBox = element.getBoundingClientRect();
    const trackBox = track.getBoundingClientRect();
    const photoBox = photo.getBoundingClientRect();
    return {
      panelLeft: panelBox.left,
      panelRight: panelBox.right,
      trackLeft: trackBox.left,
      trackRight: trackBox.right,
      photoLeft: photoBox.left,
      photoRight: photoBox.right,
      radius: getComputedStyle(photo).borderRadius,
    };
  });
  expect(Math.abs(geometry.photoLeft - geometry.trackLeft)).toBeLessThanOrEqual(.5);
  expect(Math.abs(geometry.photoRight - geometry.trackRight)).toBeLessThanOrEqual(.5);
  expect(geometry.trackLeft - geometry.panelLeft).toBeLessThanOrEqual(2);
  expect(geometry.panelRight - geometry.trackRight).toBeLessThanOrEqual(2);
  expect(geometry.radius).toBe('0px');

  await track.focus();
  await page.keyboard.press('ArrowRight');
  await expect(count).toHaveText('02 / 02');
  await expect(gallery.getByRole('button', { name: 'Следующая фотография', exact: true })).toBeDisabled();
  await page.keyboard.press('Home');
  await expect(count).toHaveText('01 / 02');

  const imageMotion = await gallery.locator('.gallery-stage__slide.is-current .gallery-stage__image')
    .evaluate((element) => getComputedStyle(element).animationName);
  expect(imageMotion).toBe('none');

  if (!isMobile) {
    await expect(page.locator('#profile-panel')).toBeVisible();
    await expect(page.locator('#practice-panel')).toBeVisible();
    await expect(gallery).toBeVisible();
  }

  await gallery.getByRole('button', { name: 'Закрыть раздел «Галерея»', exact: true }).click();
  await expect(gallery).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-gallery-open', 'false');
  await expect(page.locator('html')).toHaveAttribute('data-menu-open', 'true');
  await expect(galleryButton).toBeFocused();
});

test('menu and content-panel keyboard dragging match the responsive contract', async ({ page }) => {
  await openReady(page);
  const desktop = (await page.viewportSize()).width > 900;
  const menuHandle = page.locator('.multitool__drag-handle');

  if (!desktop) {
    await expect(menuHandle).toBeDisabled();
    await page.getByRole('button', { name: 'Профиль', exact: true }).click();
    await expect(page.locator('.text-block--profile .text-block__drag-handle')).toBeDisabled();
    await page.getByRole('button', { name: 'Галерея', exact: true }).click();
    await expect(page.locator('.gallery-stage__drag-handle')).toBeDisabled();
    return;
  }

  await menuHandle.focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('.multitool')).toHaveAttribute('data-drag-y', /-\d+/);
  await page.keyboard.press('Home');
  await expect(page.locator('.multitool')).toHaveAttribute('data-drag-y', '0');

  await page.getByRole('button', { name: 'Профиль', exact: true }).click();
  const panel = page.locator('#profile-panel');
  const panelHandle = panel.locator('.text-block__drag-handle');
  await panelHandle.focus();
  await page.keyboard.press('ArrowUp');
  await expect(panel).toHaveAttribute('data-drag-y', /-\d+/);
  await page.keyboard.press('Home');
  await expect(panel).toHaveAttribute('data-drag-y', '0');

  await page.getByRole('button', { name: 'Галерея', exact: true }).click();
  const gallery = page.locator('#gallery-panel');
  const galleryHandle = gallery.locator('.gallery-stage__drag-handle');
  await galleryHandle.focus();
  await page.keyboard.press('ArrowDown');
  await expect(gallery).toHaveAttribute('data-drag-y', /\d+/);
  await page.keyboard.press('Home');
  await expect(gallery).toHaveAttribute('data-drag-y', '0');
});

test('pointer dragging has elastic boundary feedback and settles inside the safe area', async ({ page }) => {
  await openReady(page, '/?qa-theme=light&qa-motion=full&qa-analytics=denied&qa-online=1&qa-weather-temperature=20&qa-weather-code=0');
  if ((await page.viewportSize()).width <= 900) return;

  const menu = page.locator('.multitool');
  const box = await menu.boundingBox();
  expect(box).not.toBeNull();
  const restingBorder = await menu.evaluate((element) => getComputedStyle(element).borderColor);

  await page.mouse.move(box.x + 48, box.y + 32);
  await page.mouse.down();
  await page.mouse.move(-80, box.y + 32, { steps: 8 });
  await expect(menu).toHaveClass(/is-dragging/);

  const active = await menu.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left };
  });
  expect(active.left).toBeLessThan(8);
  await expect.poll(async () => menu.evaluate((element) => getComputedStyle(element).borderColor))
    .not.toBe(restingBorder);

  await page.mouse.up();
  await expect(menu).not.toHaveClass(/is-dragging/);
  await expect.poll(async () => (await menu.boundingBox()).x).toBeGreaterThanOrEqual(7.5);

  await page.getByRole('button', { name: 'Профиль', exact: true }).click();
  const panel = page.locator('#profile-panel');
  const panelBox = await panel.boundingBox();
  expect(panelBox).not.toBeNull();

  await page.mouse.move(panelBox.x + 90, panelBox.y + 120);
  await page.mouse.down();
  await page.mouse.move((await page.viewportSize()).width + 80, panelBox.y + 120, { steps: 8 });
  await expect(panel).toHaveClass(/is-dragging/);
  expect((await panel.boundingBox()).x + panelBox.width).toBeGreaterThan((await page.viewportSize()).width - 8);

  await page.mouse.up();
  await expect(panel).not.toHaveClass(/is-dragging/);
  await expect.poll(async () => {
    const settled = await panel.boundingBox();
    return settled.x + settled.width;
  }).toBeLessThanOrEqual((await page.viewportSize()).width - 7.5);

  await page.getByRole('button', { name: 'Галерея', exact: true }).click();
  const gallery = page.locator('#gallery-panel');
  const galleryHandleBox = await gallery.locator('.gallery-stage__drag-handle').boundingBox();
  expect(galleryHandleBox).not.toBeNull();

  await page.mouse.move(galleryHandleBox.x + 80, galleryHandleBox.y + galleryHandleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(galleryHandleBox.x + 128, galleryHandleBox.y + 48, { steps: 6 });
  await expect(gallery).toHaveClass(/is-dragging/);
  await page.mouse.up();
  await expect(gallery).not.toHaveClass(/is-dragging/);
  await expect(gallery).toHaveAttribute('data-drag-x', /\d+/);
  await expect(gallery).toHaveAttribute('data-drag-y', /\d+/);
});

test('privacy page keeps the same accessibility baseline', async ({ page, browserName }) => {
  await openReady(page, '/privacy.html?qa-theme=dark&qa-motion=reduce');
  await expect(page.locator('h1')).toHaveText('Конфиденциальность');
  await focusSkipLink(page, browserName);
  await expectNoSeriousAxeViolations(page);
});

test('404 page remains useful, focused and excluded from indexing', async ({ page, browserName }) => {
  await openReady(page, '/404.html');
  await expect(page.locator('h1')).toHaveText('Страница не найдена');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
  const documentCenter = await page.locator('.privacy-document').evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { card: box.left + box.width / 2, viewport: innerWidth / 2 };
  });
  expect(Math.abs(documentCenter.card - documentCenter.viewport)).toBeLessThanOrEqual(.5);
  await focusSkipLink(page, browserName);
  await expect(page.getByRole('link', { name: 'Вернуться на главную' })).toHaveAttribute('href', '/');
  await expectNoSeriousAxeViolations(page);
});
