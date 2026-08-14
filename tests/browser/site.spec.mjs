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
  const root = page.locator('html');
  const params = new URL(path, 'http://127.0.0.1').searchParams;
  if (await page.locator('script[src*="script.js"]').count()) {
    await expect(root).toHaveAttribute('data-reduce-motion', /^(?:true|false)$/);
    const theme = params.get('qa-theme');
    if (theme === 'light' || theme === 'dark') await expect(root).toHaveAttribute('data-theme', theme);
    if (params.get('qa-contrast') === 'more') await expect(root).toHaveAttribute('data-qa-contrast', 'more');
    if (params.get('qa-menu') === 'compact') await expect(root).toHaveAttribute('data-menu-open', 'false');
    if (Number.isFinite(Number.parseInt(params.get('qa-online') || '', 10))) {
      await expect(root).toHaveAttribute('data-presence-available', 'true');
    }
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
        y: box.y,
        right: box.right,
        bottom: box.bottom,
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
    const gallery = document.querySelector('[data-panel="gallery"]');
    const music = document.querySelector('[data-panel="music"]');
    const address = document.querySelector('.multitool__address');
    const telegram = document.querySelector('.multitool__icon-link');
    const weather = document.querySelector('.multitool__weather');
    const mainSurface = document.querySelector('.multitool__main');
    const contactSurface = document.querySelector('.multitool__contact-surface');
    const footerSurface = document.querySelector('.multitool__footer-surface');
    const liveCell = (selector) => {
      const cell = document.querySelector(selector);
      const label = cell.querySelector('.multitool__live-label');
      const value = cell.querySelector('strong');
      const cellBox = rect(cell);
      const labelBox = rect(label);
      const valueBox = rect(value);
      const contentCenter = (
        Math.min(labelBox.y, valueBox.y)
        + Math.max(labelBox.bottom, valueBox.bottom)
      ) / 2;
      return {
        height: cellBox.height,
        centerDelta: contentCenter - (cellBox.y + cellBox.height / 2),
      };
    };
    const descriptorCenter = (selector) => {
      const descriptor = document.querySelector(selector);
      const copy = descriptor.querySelector('.multitool__descriptor-track span');
      const descriptorBox = descriptor.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(copy);
      const textBox = range.getBoundingClientRect();
      return {
        height: descriptorBox.height,
        textCenterDelta: (textBox.top + textBox.bottom - descriptorBox.top - descriptorBox.bottom) / 2,
      };
    };
    return {
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      firstInteractive: document.querySelector('a[href], button, input, select, textarea')?.className,
      controls,
      contact: rect(document.querySelector('.multitool__contacts')),
      live: rect(document.querySelector('.multitool__live')),
      liveCells: [liveCell('.multitool__presence'), liveCell('.multitool__weather')],
      descriptor: descriptorCenter('.multitool__drawer .multitool__descriptor'),
      privacy: rect(document.querySelector('.multitool__privacy-link')),
      credit: rect(document.querySelector('.multitool__meta')),
      service: rect(service),
      serviceButtons: [...service.children].filter(visible).map(rect),
      socialJustification: [...document.querySelectorAll('.multitool__icon-link')]
        .map((element) => getComputedStyle(element).justifyContent),
      surfaces: {
        main: rect(mainSurface),
        contact: rect(contactSurface),
        footer: rect(footerSurface),
      },
      editorialGroup: {
        display: getComputedStyle(document.querySelector('.multitool__editorial-row')).display,
        gap: rect(music).x - rect(gallery).right,
        galleryLeft: rect(gallery).x,
        musicRight: rect(music).right,
        galleryBorderRight: Number.parseFloat(getComputedStyle(gallery).borderRightWidth),
        musicBorderLeft: Number.parseFloat(getComputedStyle(music).borderLeftWidth),
      },
      contactSplit: {
        addressRight: rect(address).right,
        telegramLeft: rect(telegram).x,
        weatherLeft: rect(weather).x,
        addressBorderRight: Number.parseFloat(getComputedStyle(address).borderRightWidth),
        telegramBorderLeft: Number.parseFloat(getComputedStyle(telegram).borderLeftWidth),
        weatherBorderLeft: Number.parseFloat(getComputedStyle(weather).borderLeftWidth),
      },
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
  expect(audit.live.height).toBeLessThanOrEqual(audit.innerWidth <= 480 ? 73 : 53);
  expect(Math.abs(audit.liveCells[0].height - audit.liveCells[1].height)).toBeLessThanOrEqual(.5);
  for (const cell of audit.liveCells) expect(Math.abs(cell.centerDelta)).toBeLessThanOrEqual(.75);
  expect(audit.descriptor.height).toBeGreaterThanOrEqual(29.5);
  expect(audit.descriptor.height).toBeLessThanOrEqual(34.1);
  expect(Math.abs(audit.descriptor.textCenterDelta)).toBeLessThanOrEqual(1);
  expect(audit.controls.filter(({ width, height }) => width < 44 || height < 44)).toEqual([]);
  expect(Math.abs(audit.primarySplit.brandRight - audit.primarySplit.bookingLeft)).toBeLessThanOrEqual(.01);
  expect(Math.abs(audit.primarySplit.brandRight - audit.primarySplit.profileRight)).toBeLessThanOrEqual(.01);
  expect(Math.abs(audit.primarySplit.brandRight - audit.primarySplit.practiceLeft)).toBeLessThanOrEqual(.01);
  expect(audit.primarySplit.brandBorderRight).toBeGreaterThan(0);
  expect(audit.primarySplit.profileBorderRight).toBe(audit.primarySplit.brandBorderRight);
  expect(audit.primarySplit.practiceBorderLeft).toBe(0);
  expect(audit.editorialGroup.display).toBe('grid');
  expect(Math.abs(audit.editorialGroup.gap)).toBeLessThanOrEqual(.01);
  expect(Math.abs(audit.editorialGroup.galleryLeft - audit.surfaces.main.x)).toBeLessThanOrEqual(1.1);
  expect(Math.abs(audit.editorialGroup.musicRight - audit.surfaces.main.right)).toBeLessThanOrEqual(1.1);
  expect(audit.editorialGroup.galleryBorderRight).toBeGreaterThan(0);
  expect(audit.editorialGroup.musicBorderLeft).toBe(0);
  expect(Math.abs(audit.contactSplit.addressRight - audit.contactSplit.telegramLeft)).toBeLessThanOrEqual(.01);
  expect(Math.abs(audit.contactSplit.telegramLeft - audit.contactSplit.weatherLeft)).toBeLessThanOrEqual(.01);
  expect(audit.contactSplit.addressBorderRight).toBe(0);
  expect(audit.contactSplit.telegramBorderLeft).toBeGreaterThan(0);
  expect(audit.contactSplit.telegramBorderLeft).toBe(audit.contactSplit.weatherBorderLeft);

  const { main, contact, footer } = audit.surfaces;
  for (const surface of [contact, footer]) {
    expect(Math.abs(surface.x - main.x)).toBeLessThanOrEqual(.01);
    expect(Math.abs(surface.width - main.width)).toBeLessThanOrEqual(.01);
  }
  expect(contact.y - main.bottom).toBeGreaterThanOrEqual(11.5);
  expect(footer.y - contact.bottom).toBeGreaterThanOrEqual(11.5);

  if (audit.innerWidth <= 900) {
    for (const floor of [audit.privacy, audit.credit, audit.service, main, contact, footer]) {
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

test('analytics compound icon keeps one quiet modifier in the shared optical slot', async ({ page }) => {
  await page.route('https://mc.yandex.ru/**', (route) => route.abort());
  for (const consent of ['prompt', 'granted', 'denied']) {
    await openReady(page, `/?${baseQuery.replace('qa-analytics=denied', `qa-analytics=${consent}`)}`);
    const audit = await page.locator('.analytics-settings svg').evaluate((icon) => {
      const visibleStates = [...icon.querySelectorAll('.analytics-settings__state')]
        .filter((state) => getComputedStyle(state).display !== 'none');
      const modifier = visibleStates[0];
      const box = modifier?.getBBox();
      const viewBox = icon.viewBox.baseVal;
      return {
        count: visibleStates.length,
        centerX: box ? box.x + box.width / 2 : 0,
        centerY: box ? box.y + box.height / 2 : 0,
        areaRatio: box ? (box.width * box.height) / (viewBox.width * viewBox.height) : 1,
        viewBox: { width: viewBox.width, height: viewBox.height },
      };
    });

    expect(audit.count).toBe(1);
    expect(audit.centerX).toBeGreaterThan(audit.viewBox.width / 2);
    expect(audit.centerY).toBeLessThan(audit.viewBox.height / 2);
    expect(audit.areaRatio).toBeLessThanOrEqual(.25);
  }
});

test('status notices reuse the expanded interface material', async ({ page }) => {
  await openReady(page);

  await page.getByRole('button', { name: 'Включить тёмную тему', exact: true }).click();
  const status = page.locator('.multitool__status');
  await expect(status).toBeVisible();
  await expect(status).toContainText('Тёмная тема включена');

  await expect.poll(() => page.evaluate(() => {
    const readMaterial = (element) => {
      const style = getComputedStyle(element);
      return JSON.stringify({
        background: style.backgroundColor,
        borderColor: style.borderTopColor,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow,
        backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
      });
    };

    return readMaterial(document.querySelector('.multitool__status'))
      === readMaterial(document.querySelector('.multitool__contact-surface'));
  })).toBe(true);
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
      clippedEditorialCopy: [...document.querySelectorAll('.multitool__editorial-copy')]
        .map((element) => ({
          widthDelta: element.scrollWidth - element.clientWidth,
          heightDelta: element.scrollHeight - element.clientHeight,
        }))
        .filter(({ widthDelta, heightDelta }) => widthDelta > 1 || heightDelta > 3),
      tickerAnimation: getComputedStyle(document.querySelector('.multitool__drawer .multitool__descriptor-track')).animationName,
      videos: [...document.querySelectorAll('.stage-video')].map((video) => ({
        display: getComputedStyle(video).display,
        src: video.getAttribute('src'),
        currentSrc: video.currentSrc,
        noSource: video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE,
        paused: video.paused,
      })),
    };
  });

  expect(audit.scrollWidth).toBeLessThanOrEqual(audit.innerWidth);
  expect(audit.badControls).toEqual([]);
  expect(audit.outsideControls).toEqual([]);
  expect(audit.clippedEditorialCopy).toEqual([]);
  const videosAreStopped = audit.videos.every(({ display, src, currentSrc, noSource, paused }) => (
    display === 'none'
    && src === null
    && currentSrc === ''
    && (paused || noSource)
  ));
  expect(audit.reducedMotion).toBe('true');
  expect(audit.tickerAnimation).toBe('none');
  expect(videosAreStopped, JSON.stringify(audit, null, 2)).toBeTruthy();
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
  await expect.poll(() => page.locator('.multitool__drawer .multitool__descriptor-track')
    .evaluate((element) => getComputedStyle(element).animationName)).toBe('descriptor-ticker');
  await page.waitForFunction((selector) => {
    const video = document.querySelector(selector);
    return video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !video.paused;
  }, activeSelector);
});

test('the editorial ticker exposes deterministic start, middle and seam phases', async ({ page }) => {
  const translations = {};
  await openReady(page, '/?qa-theme=light&qa-motion=full&qa-analytics=denied&ticker-phase=start');

  for (const phase of ['start', 'middle', 'seam']) {
    await page.evaluate((value) => {
      document.documentElement.dataset.tickerPhase = value;
    }, phase);
    translations[phase] = await page.locator('.multitool__drawer .multitool__descriptor-track').evaluate((track) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(track).transform);
      const copies = [...track.children].map((copy) => copy.textContent);
      return {
        animation: getComputedStyle(track).animationName,
        phase: document.documentElement.dataset.tickerPhase,
        tx: matrix.m41,
        width: track.getBoundingClientRect().width,
        copies,
        semanticText: document.querySelector('.multitool__drawer .multitool__descriptor > .sr-only')?.textContent,
      };
    });
  }

  for (const [phase, audit] of Object.entries(translations)) {
    expect(audit.phase).toBe(phase);
    expect(audit.animation).toBe('none');
    expect(new Set(audit.copies).size).toBe(1);
    expect(audit.copies).toHaveLength(3);
    expect(audit.semanticText).toBe('Мужской стилист, барбер, эксперт по мужскому уходу');
  }
  expect(Math.abs(translations.start.tx)).toBeLessThanOrEqual(.01);
  expect(Math.abs(translations.middle.tx + translations.middle.width / 6)).toBeLessThanOrEqual(1);
  expect(Math.abs(translations.seam.tx + translations.seam.width * .3332)).toBeLessThanOrEqual(1);
});

test('the collapsed mobile menu retains the centered editorial descriptor', async ({ page }) => {
  const viewport = await page.viewportSize();
  test.skip(viewport.width > 900, 'The collapsed menu is a mobile composition.');

  await openReady(page, '/?qa-menu=compact&qa-theme=light&qa-motion=reduce&qa-analytics=denied&ticker-phase=start');
  const compact = page.locator('.multitool__descriptor--compact');
  await expect(compact).toBeVisible();
  await expect(page.locator('.multitool__drawer')).toBeHidden();

  const audit = await compact.evaluate((descriptor) => {
    const copy = descriptor.querySelector('.multitool__descriptor-track span');
    const range = document.createRange();
    range.selectNodeContents(copy);
    const descriptorBox = descriptor.getBoundingClientRect();
    const textBox = range.getBoundingClientRect();
    return {
      height: descriptorBox.height,
      textCenterDelta: (textBox.top + textBox.bottom - descriptorBox.top - descriptorBox.bottom) / 2,
      copies: descriptor.querySelectorAll('.multitool__descriptor-track span').length,
      semanticText: descriptor.querySelector(':scope > .sr-only')?.textContent,
      trackAnimation: getComputedStyle(descriptor.querySelector('.multitool__descriptor-track')).animationName,
      mainHeight: document.querySelector('.multitool__main').getBoundingClientRect().height,
      primaryHeight: document.querySelector('.multitool__primary').getBoundingClientRect().height,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });

  expect(audit.height).toBeCloseTo(28, 1);
  expect(Math.abs(audit.textCenterDelta)).toBeLessThanOrEqual(1);
  expect(audit.copies).toBe(3);
  expect(audit.semanticText).toBe('Мужской стилист, барбер, эксперт по мужскому уходу');
  expect(audit.trackAnimation).toBe('none');
  expect(Math.abs(audit.mainHeight - audit.primaryHeight - audit.height)).toBeLessThanOrEqual(2);
  expect(audit.overflow).toBeLessThanOrEqual(0);
});

test('an overflowing track title reveals its full ending without becoming a second scroll area', async ({ page }) => {
  const viewport = await page.viewportSize();
  test.skip(viewport.width > 430, 'The title fits without movement at wider sizes.');
  await page.setViewportSize({ width: 320, height: 900 });

  await openReady(page, '/?qa-panels=music&qa-theme=light&qa-motion=full&qa-analytics=denied');
  const title = page.locator('.music-panel__track-title').filter({ hasText: 'Fatnis Island' });
  await expect(title).toHaveAttribute('data-overflow', 'true');

  await title.hover();
  const travel = await title.locator('.music-panel__track-title-text').evaluate((text) => (
    text.getAnimations().map((animation) => ({
      delay: animation.effect.getTiming().delay,
      duration: animation.effect.getTiming().duration,
      property: animation.transitionProperty,
      transforms: animation.effect.getKeyframes().map((frame) => {
        const matrix = new DOMMatrixReadOnly(frame.transform || 'none');
        return matrix.m41;
      }),
    }))
  ));
  const transformTravel = travel.find(({ property }) => property === 'transform');
  expect(transformTravel?.delay).toBe(350);
  expect(transformTravel?.duration).toBeGreaterThanOrEqual(1800);
  expect(transformTravel?.transforms.at(0)).toBeCloseTo(0, 1);
  expect(transformTravel?.transforms.at(-1)).toBeLessThan(0);

  const phases = {};
  for (const phase of ['start', 'middle', 'end']) {
    await page.evaluate((value) => {
      document.documentElement.dataset.trackPhase = value;
    }, phase);
    phases[phase] = await title.evaluate((element) => {
      const text = element.querySelector('.music-panel__track-title-text');
      const matrix = new DOMMatrixReadOnly(getComputedStyle(text).transform);
      return {
        animation: getComputedStyle(text).animationName,
        clientWidth: element.clientWidth,
        fullText: element.textContent,
        scrollWidth: text.scrollWidth,
        shift: Number.parseFloat(getComputedStyle(element).getPropertyValue('--track-title-shift')),
        middleShift: Number.parseFloat(getComputedStyle(element).getPropertyValue('--track-title-middle-shift')),
        title: element.title,
        tx: matrix.m41,
      };
    });
  }

  expect(phases.start.scrollWidth).toBeGreaterThan(phases.start.clientWidth);
  expect(phases.start.fullText).toBe('Fatnis Island (feat. Menna Hussein)');
  expect(phases.start.title).toBe(phases.start.fullText);
  expect(phases.start.animation).toBe('none');
  expect(Math.abs(phases.start.tx)).toBeLessThanOrEqual(.01);
  expect(phases.middle.tx).toBeCloseTo(phases.middle.middleShift, 1);
  expect(phases.end.tx).toBeCloseTo(phases.end.shift, 1);

  await openReady(page, '/?qa-panels=music&qa-theme=light&qa-motion=reduce&qa-analytics=denied&track-phase=end');
  const reducedTitle = page.locator('.music-panel__track-title').filter({ hasText: 'Fatnis Island' });
  await expect(reducedTitle).toHaveAttribute('data-overflow', 'true');
  const reduced = await reducedTitle.evaluate((element) => {
    const text = element.querySelector('.music-panel__track-title-text');
    const matrix = new DOMMatrixReadOnly(getComputedStyle(text).transform);
    return {
      animation: getComputedStyle(text).animationName,
      transition: getComputedStyle(text).transitionDuration,
      tx: matrix.m41,
    };
  });
  expect(reduced.animation).toBe('none');
  expect(reduced.transition).toBe('0s');
  expect(Math.abs(reduced.tx)).toBeLessThanOrEqual(.01);
});

test('editorial imagery stays secondary in increased contrast', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await openReady(page, `/?qa-theme=${theme}&qa-motion=reduce&qa-analytics=denied&qa-contrast=more`);
    await expect.poll(() => page.locator('.multitool__editorial-row button').evaluateAll((buttons) => (
      buttons.map((button) => Number.parseFloat(getComputedStyle(button, '::before').opacity))
    ))).toEqual([.12, .12]);
    const audit = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      overflow: document.documentElement.scrollWidth - innerWidth,
      previews: [...document.querySelectorAll('.multitool__editorial-row button')].map((button) => {
        const style = getComputedStyle(button, '::before');
        return {
          opacity: Number.parseFloat(style.opacity),
          filter: style.filter,
        };
      }),
    }));

    expect(audit.theme).toBe(theme);
    expect(audit.overflow).toBeLessThanOrEqual(0);
    expect(audit.previews).toHaveLength(2);
    for (const preview of audit.previews) {
      expect(preview.opacity).toBeCloseTo(.12, 2);
      expect(preview.filter).toContain('grayscale(1)');
      expect(preview.filter).toContain('contrast(0.78)');
    }
  }
});

test('dark theme uses one flat after-hours material and a slower editorial rhythm', async ({ page }) => {
  await openReady(page, '/?qa-theme=dark&qa-motion=full&qa-analytics=denied&qa-online=1&qa-weather-temperature=16&qa-weather-code=3');
  await expect.poll(() => page.locator('.multitool__editorial-row button').first().evaluate((button) => (
    Number.parseFloat(getComputedStyle(button, '::before').opacity)
  ))).toBeCloseTo(.58, 2);

  const resting = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const overlay = getComputedStyle(document.querySelector('.stage-overlay'));
    const surface = document.querySelector('.multitool__main');
    const surfaceStyle = getComputedStyle(surface);
    const surfaceTint = getComputedStyle(surface, '::before');
    const preview = getComputedStyle(document.querySelector('.multitool__editorial-row button'), '::before');
    const ticker = getComputedStyle(document.querySelector('.multitool__descriptor-track'));

    return {
      theme: document.documentElement.dataset.theme,
      grade: overlay.backdropFilter || overlay.webkitBackdropFilter,
      background: surfaceStyle.backgroundColor,
      backdrop: surfaceStyle.backdropFilter || surfaceStyle.webkitBackdropFilter,
      tintImage: surfaceTint.backgroundImage,
      previewFilter: preview.filter,
      previewOpacity: Number.parseFloat(preview.opacity),
      tickerDuration: ticker.animationDuration,
      durationToken: root.getPropertyValue('--descriptor-duration').trim(),
      baseBackdropToken: root.getPropertyValue('--tool-backdrop').trim(),
      openBackdropToken: root.getPropertyValue('--tool-backdrop-open').trim(),
    };
  });

  expect(resting.theme).toBe('dark');
  expect(resting.grade).toContain('saturate(');
  expect(resting.grade).toContain('contrast(');
  expect(resting.grade).toContain('brightness(');
  expect(resting.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(resting.baseBackdropToken).toContain('blur(34px)');
  expect(resting.openBackdropToken).toContain('blur(42px)');
  expect(resting.backdrop).toContain('blur(42px)');
  expect(resting.tintImage).toBe('none');
  expect(resting.previewFilter).toContain('grayscale(0.72)');
  expect(resting.previewFilter).toContain('saturate(0.72)');
  expect(resting.previewOpacity).toBeCloseTo(.58, 2);
  expect(resting.durationToken).toBe('58s');
  expect(resting.tickerDuration).toBe('58s');

  await page.getByRole('button', { name: 'Музыка', exact: true }).click();
  const expanded = await page.locator('#music-panel').evaluate((panel) => {
    const style = getComputedStyle(panel);
    const tint = getComputedStyle(panel, '::before');
    return {
      backdrop: style.backdropFilter || style.webkitBackdropFilter,
      tintImage: tint.backgroundImage,
    };
  });

  expect(expanded.backdrop).toContain('blur(42px)');
  expect(expanded.tintImage).toBe('none');

  await openReady(page, '/?qa-theme=dark&qa-motion=reduce&qa-analytics=denied&qa-system-transparency=reduce');
  const reducedTransparency = await page.locator('.multitool__main').evaluate((surface) => {
    const style = getComputedStyle(surface);
    const tint = getComputedStyle(surface, '::before');
    return {
      active: document.documentElement.dataset.systemReducedTransparency,
      backdrop: style.backdropFilter || style.webkitBackdropFilter,
      tintImage: tint.backgroundImage,
    };
  });

  expect(reducedTransparency.active).toBe('true');
  expect(reducedTransparency.backdrop).toBe('none');
  expect(reducedTransparency.tintImage).toBe('none');
});

test('the editorial hand settles without a horizontal jump', async ({ page }) => {
  await openReady(page, '/?qa-theme=light&qa-motion=full&qa-analytics=denied&ticker-phase=start');
  const musicButton = page.getByRole('button', { name: 'Музыка', exact: true });
  const mark = musicButton.locator('.multitool__editorial-mark');
  const readMotion = () => mark.evaluate((element) => {
    const style = getComputedStyle(element);
    const matrix = new DOMMatrixReadOnly(style.transform);
    return {
      opacity: Number.parseFloat(style.opacity),
      scaleX: matrix.a,
      scaleY: matrix.d,
      x: matrix.e,
      y: matrix.f,
      transitionDuration: style.transitionDuration,
      transitionProperty: style.transitionProperty,
    };
  });

  const start = await readMotion();
  expect(start.opacity).toBe(0);
  expect(Math.abs(start.x)).toBeLessThanOrEqual(.01);
  expect(start.y).toBeCloseTo(2, 1);
  expect(start.scaleX).toBeCloseTo(.96, 2);
  expect(start.scaleY).toBeCloseTo(.96, 2);
  expect(start.transitionProperty).toContain('opacity');
  expect(start.transitionProperty).toContain('transform');
  expect(start.transitionDuration).toBe('0.22s, 0.22s');

  const transitions = await musicButton.evaluate((button) => {
    const element = button.querySelector('.multitool__editorial-mark');
    button.focus();
    getComputedStyle(element).opacity;
    return element.getAnimations().map((animation) => ({
      property: animation.transitionProperty,
      duration: animation.effect.getTiming().duration,
      frames: animation.effect.getKeyframes().map((frame) => {
        const matrix = new DOMMatrixReadOnly(frame.transform || 'none');
        return {
          opacity: frame.opacity === undefined ? null : Number.parseFloat(frame.opacity),
          scaleX: matrix.a,
          scaleY: matrix.d,
          x: matrix.e,
          y: matrix.f,
        };
      }),
    }));
  });

  const opacityTransition = transitions.find(({ property }) => property === 'opacity');
  const transformTransition = transitions.find(({ property }) => property === 'transform');
  expect(opacityTransition?.duration).toBe(220);
  expect(opacityTransition?.frames.at(0).opacity).toBe(0);
  expect(opacityTransition?.frames.at(-1).opacity).toBe(1);
  expect(transformTransition?.duration).toBe(220);
  expect(transformTransition?.frames).toHaveLength(2);
  for (const frame of transformTransition.frames) {
    expect(Math.abs(frame.x)).toBeLessThanOrEqual(.01);
  }
  expect(transformTransition.frames[0].y).toBeCloseTo(2, 1);
  expect(transformTransition.frames[0].scaleX).toBeCloseTo(.96, 2);
  expect(transformTransition.frames[0].scaleY).toBeCloseTo(.96, 2);
  expect(Math.abs(transformTransition.frames[1].y)).toBeLessThanOrEqual(.01);
  expect(transformTransition.frames[1].scaleX).toBeCloseTo(1, 2);
  expect(transformTransition.frames[1].scaleY).toBeCloseTo(1, 2);

  await expect.poll(async () => (await readMotion()).opacity).toBe(1);
  const end = await readMotion();
  expect(end.opacity).toBe(1);
  expect(Math.abs(end.x)).toBeLessThanOrEqual(.01);
  expect(Math.abs(end.y)).toBeLessThanOrEqual(.01);
  expect(end.scaleX).toBeCloseTo(1, 2);
  expect(end.scaleY).toBeCloseTo(1, 2);
});

test('modules announce, focus and retain the intended responsive state', async ({ page }) => {
  await openReady(page);

  const profile = page.getByRole('button', { name: 'Профиль', exact: true });
  const practice = page.getByRole('button', { name: 'Экспертиза', exact: true });
  await profile.click();
  await expect(profile).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => profile.evaluate((button) => (
    getComputedStyle(button, '::after').content.replace(/^['"]|['"]$/g, '')
  ))).toBe('−');
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

test('profile and expertise end with one shared keyboard-reachable booking action', async ({ page }) => {
  await openReady(page);

  const panels = [
    ['Профиль', '#profile-panel', 'Записаться после раздела «Профиль»'],
    ['Экспертиза', '#practice-panel', 'Записаться после раздела «Экспертиза»'],
  ];

  for (const [buttonName, panelSelector, accessibleName] of panels) {
    await page.getByRole('button', { name: buttonName, exact: true }).click();
    const panel = page.locator(panelSelector);
    const booking = panel.locator('.text-block__booking');
    await booking.scrollIntoViewIfNeeded();

    await expect(booking).toBeVisible();
    await expect(booking).toHaveAccessibleName(accessibleName);
    await expect(booking).toHaveAttribute('href', 'https://b11133.yclients.com/company/30187/personal/menu?o=');
    await expect(booking).toHaveAttribute('target', '_blank');
    await expect(booking).toHaveAttribute('data-metrika-goal', 'booking_click');

    const box = await booking.boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(-.5);
    expect(box.x + box.width).toBeLessThanOrEqual((await page.viewportSize()).width + .5);

    await booking.focus();
    await expect(booking).toBeFocused();
    await panel.getByRole('button', { name: new RegExp(`Закрыть (?:панель|раздел) «${buttonName}»`) }).click();
    await expect(panel).toBeHidden();
  }
});

test('media and partnership catalogs open as peer content panels', async ({ page }) => {
  await openReady(page);

  const modules = [
    ['Медиа', '#media-panel', 'Закрыть раздел «Медиа»'],
    ['Партнёрства', '#partners-panel', 'Закрыть раздел «Партнёрства»'],
  ];

  for (const [buttonName, panelSelector, closeName] of modules) {
    const trigger = page.getByRole('button', { name: buttonName, exact: true });
    const panel = page.locator(panelSelector);
    await trigger.click();
    await expect(panel).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const audit = await page.evaluate(({ panelSelector }) => {
      const panel = document.querySelector(panelSelector);
      const panelBox = panel.getBoundingClientRect();
      const handle = panel.querySelector('.catalog-panel__drag-handle');
      return {
        isDesktop: innerWidth > 900,
        insideMultitool: Boolean(panel.closest('.multitool')),
        gridArea: getComputedStyle(panel).gridArea,
        center: panelBox.left + panelBox.width / 2,
        viewportCenter: innerWidth / 2,
        handleDisabled: handle.disabled,
        handleAriaHidden: handle.getAttribute('aria-hidden'),
      };
    }, { panelSelector });

    expect(audit.insideMultitool).toBe(false);
    if (audit.isDesktop) {
      expect(audit.gridArea).toBe('stack');
      expect(Math.abs(audit.center - audit.viewportCenter)).toBeLessThanOrEqual(.5);
      expect(audit.handleDisabled).toBe(false);
      expect(audit.handleAriaHidden).toBe('false');
    } else {
      await expect(panel).toBeFocused();
      expect(audit.handleDisabled).toBe(true);
      expect(audit.handleAriaHidden).toBe('true');
    }

    await panel.getByRole('button', { name: closeName, exact: true }).click();
    await expect(panel).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
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
  await page.getByRole('button', { name: 'Закрыть раздел «Медиа»', exact: true }).click();
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

test('main and editorial entries keep their intentional affordances and one mobile scroll flow', async ({ page }) => {
  await openReady(page);

  const viewport = await page.viewportSize();
  const isMobile = viewport.width <= 900;
  const auditBeforeOpen = await page.evaluate(() => {
    const rect = (selector) => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return {
        x: box.x,
        width: box.width,
        height: box.height,
      };
    };
    return {
      profile: rect('[data-panel="profile"]'),
      gallery: rect('[data-panel="gallery"]'),
      music: rect('[data-panel="music"]'),
      address: rect('.multitool__address'),
      live: rect('.multitool__live'),
      editorialGap: rect('[data-panel="music"]').x
        - (rect('[data-panel="gallery"]').x + rect('[data-panel="gallery"]').width),
      affordances: [...document.querySelectorAll('[data-panel]')]
        .map((button) => getComputedStyle(button, '::after').content.replace(/^['"]|['"]$/g, '')),
      editorialMarks: [...document.querySelectorAll('.multitool__editorial-mark')].map((mark) => {
        const box = mark.getBoundingClientRect();
        const buttonBox = mark.closest('button').getBoundingClientRect();
        const copyBox = mark.closest('button').querySelector('.multitool__editorial-copy').getBoundingClientRect();
        return {
          top: box.top,
          right: box.right,
          bottom: box.bottom,
          width: box.width,
          height: box.height,
          buttonTop: buttonBox.top,
          buttonRight: buttonBox.right,
          copyTop: copyBox.top,
          hidden: mark.getAttribute('aria-hidden'),
          symbol: mark.querySelector('use')?.getAttribute('href'),
          color: getComputedStyle(mark).color,
          opacity: Number.parseFloat(getComputedStyle(mark).opacity),
        };
      }),
      editorialPreviews: [...document.querySelectorAll('.multitool__editorial-row button')].map((button) => {
        const style = getComputedStyle(button, '::before');
        return {
          image: style.backgroundImage,
          filter: style.filter,
          opacity: Number.parseFloat(style.opacity),
        };
      }),
    };
  });

  expect(Math.abs(auditBeforeOpen.gallery.height - auditBeforeOpen.music.height)).toBeLessThanOrEqual(.5);
  expect(auditBeforeOpen.gallery.height).toBeGreaterThanOrEqual(95);
  expect(Math.abs(auditBeforeOpen.editorialGap)).toBeLessThanOrEqual(.01);
  expect(auditBeforeOpen.affordances).toEqual(['+', '+', '+', '+', 'none', 'none']);
  expect(auditBeforeOpen.editorialMarks).toHaveLength(2);
  for (const mark of auditBeforeOpen.editorialMarks) {
    expect(mark.hidden).toBe('true');
    expect(mark.symbol).toBe('#icon-hand-scissors');
    expect(Math.abs(mark.width - mark.height)).toBeLessThanOrEqual(.01);
    expect(mark.width).toBeGreaterThanOrEqual(20);
    expect(mark.top - mark.buttonTop).toBeGreaterThanOrEqual(12);
    expect(mark.buttonRight - mark.right).toBeGreaterThanOrEqual(12);
    expect(mark.bottom).toBeLessThanOrEqual(mark.copyTop - 4);
    expect(mark.opacity).toBe(0);
  }
  expect(auditBeforeOpen.editorialPreviews).toHaveLength(2);
  for (const preview of auditBeforeOpen.editorialPreviews) {
    expect(preview.image).toContain('assets/');
    expect(preview.filter).toContain('grayscale(1)');
    expect(preview.opacity).toBeCloseTo(.42, 2);
  }
  if (isMobile) expect(auditBeforeOpen.live.height).toBeLessThanOrEqual(auditBeforeOpen.address.height + 1);
  else expect(auditBeforeOpen.live.height).toBeLessThan(auditBeforeOpen.address.height);

  const musicButton = page.getByRole('button', { name: 'Музыка', exact: true });
  await musicButton.focus();
  await expect(musicButton).toBeFocused();
  await expect.poll(() => musicButton.evaluate((button) => (
    Number.parseFloat(getComputedStyle(button.querySelector('.multitool__editorial-mark')).opacity)
  ))).toBe(1);
  await expect.poll(() => musicButton.evaluate((button) => (
    Number.parseFloat(getComputedStyle(button, '::before').opacity)
  ))).toBeCloseTo(.68, 2);

  if (!isMobile) {
    await musicButton.hover();
    const hoverAudit = await musicButton.evaluate((button) => ({
      background: getComputedStyle(button).backgroundColor,
      decoration: getComputedStyle(button.querySelector('.multitool__section-label')).textDecorationLine,
      markColor: getComputedStyle(button.querySelector('.multitool__editorial-mark')).color,
      markOpacity: Number.parseFloat(getComputedStyle(button.querySelector('.multitool__editorial-mark')).opacity),
      previewOpacity: Number.parseFloat(getComputedStyle(button, '::before').opacity),
      textColor: getComputedStyle(button).color,
    }));
    expect(hoverAudit.background).toBe('rgba(0, 0, 0, 0)');
    expect(hoverAudit.decoration).toBe('none');
    expect(hoverAudit.markColor).toBe(auditBeforeOpen.editorialMarks[0].color);
    expect(hoverAudit.markColor).not.toBe(hoverAudit.textColor);
    expect(hoverAudit.markOpacity).toBe(1);
    expect(hoverAudit.previewOpacity).toBeCloseTo(.68, 2);
  }

  await musicButton.click();
  await expect(page.locator('#music-panel')).toBeVisible();
  await expect.poll(() => page.locator('.multitool__editorial-mark').evaluateAll((marks) => (
    marks.map((mark) => Number.parseFloat(getComputedStyle(mark).opacity))
  ))).toEqual([0, 0]);
  const activeAudit = await musicButton.evaluate((button) => ({
    background: getComputedStyle(button).backgroundColor,
    decoration: getComputedStyle(button.querySelector('.multitool__section-label')).textDecorationLine,
    markOpacity: Number.parseFloat(getComputedStyle(button.querySelector('.multitool__editorial-mark')).opacity),
    previewOpacity: Number.parseFloat(getComputedStyle(button, '::before').opacity),
    pseudo: getComputedStyle(button, '::after').content,
    rowMarkOpacities: [...button.closest('.multitool__editorial-row').querySelectorAll('.multitool__editorial-mark')]
      .map((mark) => Number.parseFloat(getComputedStyle(mark).opacity)),
  }));
  expect(activeAudit.background).toBe('rgba(0, 0, 0, 0)');
  expect(activeAudit.decoration).toBe('none');
  expect(activeAudit.markOpacity).toBe(0);
  expect(activeAudit.rowMarkOpacities).toEqual([0, 0]);
  expect(activeAudit.previewOpacity).toBeCloseTo(.68, 2);
  expect(activeAudit.pseudo).toBe('none');

  const scrollAudit = await page.evaluate(() => {
    const panelScroll = document.querySelector('.text-block--music .text-block__scroll');
    const trackLists = [...document.querySelectorAll('.music-panel__tracks')];
    const panelStyle = getComputedStyle(panelScroll);
    const trackStyles = trackLists.map((tracks) => getComputedStyle(tracks));
    return {
      panelOverflowY: panelStyle.overflowY,
      panelMaxHeight: panelStyle.maxHeight,
      panelClientHeight: panelScroll.clientHeight,
      panelScrollHeight: panelScroll.scrollHeight,
      tracksOverflowY: trackStyles.map((style) => style.overflowY),
      tracksMaxHeight: trackStyles.map((style) => style.maxHeight),
      tracksClientHeights: trackLists.map((tracks) => tracks.clientHeight),
      tracksScrollHeights: trackLists.map((tracks) => tracks.scrollHeight),
      trackTabIndices: trackLists.map((tracks) => tracks.tabIndex),
      trackCount: trackLists.reduce((count, tracks) => count + tracks.querySelectorAll('li').length, 0),
      documentCanScroll: document.documentElement.scrollHeight > window.innerHeight,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(scrollAudit.tracksOverflowY).toEqual(['visible', 'visible']);
  expect(scrollAudit.tracksMaxHeight).toEqual(['none', 'none']);
  expect(scrollAudit.tracksClientHeights).toEqual(scrollAudit.tracksScrollHeights);
  expect(scrollAudit.trackTabIndices).toEqual([-1, -1]);
  expect(scrollAudit.trackCount).toBe(28);
  expect(scrollAudit.horizontalOverflow).toBeLessThanOrEqual(0);

  if (isMobile) {
    await expect(page.locator('#music-panel')).toBeFocused();
    expect(scrollAudit.panelOverflowY).toBe('visible');
    expect(scrollAudit.panelMaxHeight).toBe('none');
    expect(scrollAudit.panelClientHeight).toBe(scrollAudit.panelScrollHeight);
    expect(scrollAudit.documentCanScroll).toBe(true);
  } else {
    expect(scrollAudit.panelOverflowY).toBe('auto');
    expect(scrollAudit.panelScrollHeight).toBeGreaterThan(scrollAudit.panelClientHeight);
  }
});

test('Vol. 2 artwork keeps the authored crop and a clean fallback', async ({ page }) => {
  await openReady(page, `/?${baseQuery}&qa-section=music`);

  const cover = page.locator('.music-release__cover--placeholder');
  const image = cover.locator('[data-music-cover]');
  await expect(cover).toBeVisible();
  await expect(cover).toHaveAttribute('data-cover-state', 'ready');
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('src', 'assets/music-vol-2.jpg?v=20260812-1');
  expect(await image.evaluate((element) => element.naturalWidth)).toBe(1080);
  expect(await image.evaluate((element) => getComputedStyle(element).objectPosition)).toMatch(/^50% (?:0%|0px)$/);

  const surface = await cover.evaluate((element) => {
    const style = getComputedStyle(element);
    const backgroundChannels = style.backgroundColor.match(/[\d.]+/g)?.map(Number) || [];
    return {
      backgroundImage: style.backgroundImage,
      backgroundColor: style.backgroundColor,
      backgroundAlpha: backgroundChannels.length === 4 ? backgroundChannels[3] : 1,
      borderStyle: style.borderStyle,
      borderWidth: Number.parseFloat(style.borderTopWidth),
    };
  });

  expect(surface.backgroundImage).toBe('none');
  expect(surface.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(surface.backgroundAlpha).toBeGreaterThanOrEqual(.95);
  expect(surface.borderStyle).toBe('solid');
  expect(surface.borderWidth).toBeGreaterThan(0);

  await image.evaluate((element) => element.dispatchEvent(new Event('error')));
  await expect(image).toBeHidden();
  await expect(cover).toHaveAttribute('data-cover-state', 'fallback');
});

test('menu and content-panel keyboard dragging match the responsive contract', async ({ page }) => {
  await openReady(page);
  const desktop = (await page.viewportSize()).width > 900;
  const menuHandle = page.locator('.multitool__drag-handle');

  if (!desktop) {
    await expect(menuHandle).toBeDisabled();
    await page.getByRole('button', { name: 'Профиль', exact: true }).click();
    await expect(page.locator('.text-block--profile .text-block__drag-handle')).toBeDisabled();
    await page.getByRole('button', { name: 'Медиа', exact: true }).click();
    await expect(page.locator('#media-panel .catalog-panel__drag-handle')).toBeDisabled();
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
  await panel.getByRole('button', { name: 'Закрыть панель «Профиль»', exact: true }).click();

  await page.getByRole('button', { name: 'Медиа', exact: true }).click();
  const catalog = page.locator('#media-panel');
  const catalogHandle = catalog.locator('.catalog-panel__drag-handle');
  await catalogHandle.focus();
  await page.keyboard.press('ArrowRight');
  await expect(catalog).toHaveAttribute('data-drag-x', /\d+/);
  await page.keyboard.press('Home');
  await expect(catalog).toHaveAttribute('data-drag-x', '0');
  await catalog.getByRole('button', { name: 'Закрыть раздел «Медиа»', exact: true }).click();

  const galleryButton = page.getByRole('button', { name: 'Галерея', exact: true });
  const galleryButtonBox = await galleryButton.boundingBox();
  expect(galleryButtonBox).not.toBeNull();
  await page.mouse.click(
    galleryButtonBox.x + galleryButtonBox.width / 2,
    galleryButtonBox.y + galleryButtonBox.height / 2,
  );
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
  const mainSurface = page.locator('.multitool__main');
  const box = await menu.boundingBox();
  expect(box).not.toBeNull();
  const restingBorder = await mainSurface.evaluate((element) => getComputedStyle(element).borderColor);

  await page.mouse.move(box.x + 48, box.y + 32);
  await page.mouse.down();
  await page.mouse.move(-80, box.y + 32, { steps: 8 });
  await expect(menu).toHaveClass(/is-dragging/);

  const active = await menu.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left };
  });
  expect(active.left).toBeLessThan(8);
  await expect.poll(async () => mainSurface.evaluate((element) => getComputedStyle(element).borderColor))
    .not.toBe(restingBorder);

  await page.mouse.up();
  await expect(menu).not.toHaveClass(/is-dragging/);
  await expect.poll(async () => (await menu.boundingBox()).x).toBeGreaterThanOrEqual(7.5);

  const movedOffset = await menu.getAttribute('data-drag-x');
  expect(movedOffset).not.toBe('0');
  const resetSurface = page.locator('.multitool__legal-copy');
  const resetSurfaceBox = await resetSurface.boundingBox();
  expect(resetSurfaceBox).not.toBeNull();
  await page.mouse.dblclick(resetSurfaceBox.x + 24, resetSurfaceBox.y + 24);
  await expect(menu).toHaveAttribute('data-drag-x', '0');
  await expect(menu).toHaveAttribute('data-drag-y', '0');
  await expect(page.locator('.multitool__status')).toContainText('Меню возвращено в центр');
  await expect.poll(async () => {
    const centered = await menu.boundingBox();
    return Math.abs(centered.x + centered.width / 2 - (await page.viewportSize()).width / 2);
  }).toBeLessThanOrEqual(.5);

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
