const root = document.documentElement;
const themeToggle = document.querySelector('.theme-toggle');
const motionToggle = document.querySelector('.motion-toggle');
const logoViewButtons = [...document.querySelectorAll('button[data-logo-view]')];
const themeColor = document.getElementById('theme-color');
const multitool = document.querySelector('.multitool');
const multitoolPrimary = document.querySelector('.multitool__primary');
const multitoolBooking = document.querySelector('.multitool__booking');
const multitoolDragHandle = document.querySelector('.multitool__drag-handle');
const multitoolMenuToggle = document.querySelector('.multitool__menu-toggle');
const multitoolMenuLabel = document.querySelector('.multitool__menu-label');
const multitoolStatus = document.querySelector('.multitool__status');
const multitoolDrawer = document.getElementById('multitool-drawer');
const multitoolService = document.querySelector('.multitool__service');
const moduleStatus = document.getElementById('module-status');
const sectionButtons = [...document.querySelectorAll('[data-panel]')];
const panelCloseButtons = [...document.querySelectorAll('[data-close-panel]')];
const showcase = document.querySelector('.showcase');
const glassSurfaces = [...document.querySelectorAll('.glass-surface')];
const draggablePanels = [...document.querySelectorAll('.text-block')];
const textScrollSurfaces = [...document.querySelectorAll('.text-block__scroll')];
const logoImages = [...document.querySelectorAll('.logo img')];
const onlineCountLabel = document.querySelector('[data-online-count]');
const onlineUnitLabel = document.querySelector('[data-online-unit]');
const weatherTemperatureLabel = document.querySelector('[data-weather-temperature]');
const weatherStatusLabel = document.querySelector('[data-weather-status]');
const weatherLink = document.querySelector('.multitool__weather');
const privacyConsent = document.getElementById('privacy-consent');
const privacySettingsButtons = [...document.querySelectorAll('[data-privacy-settings]')];
const privacySettingsLabel = document.querySelector('[data-privacy-settings-label]');
const analyticsChoiceButtons = [...document.querySelectorAll('[data-analytics-choice]')];
const contentPanels = {
  profile: document.getElementById('profile-panel'),
  practice: document.getElementById('practice-panel'),
  media: document.getElementById('media-panel'),
  partners: document.getElementById('partners-panel'),
  gallery: document.getElementById('gallery-panel'),
};
const stageVideos = [...document.querySelectorAll('.stage-video')];
const mobileQuery = window.matchMedia('(max-width: 900px)');
const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const reduceTransparencyQuery = window.matchMedia('(prefers-reduced-transparency: reduce)');
const finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
const dataConnection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const themeStorageKey = 'barberherman-theme';
const motionStorageKey = 'barberherman-reduce-motion';
const logoViewStorageKey = 'barberherman-logo-view';
const queryParams = new URLSearchParams(window.location.search);
const visualQASection = queryParams.get('qa-section');
const visualQAVideoPhase = queryParams.get('hero-phase');
const visualQAMenu = queryParams.get('qa-menu');
const visualQATextScale = queryParams.get('qa-text');
const visualQAContrast = queryParams.get('qa-contrast');
const visualQAPanels = queryParams.get('qa-panels');
const visualQATheme = queryParams.get('qa-theme');
const visualQASystemTransparency = queryParams.get('qa-system-transparency');
const visualQAMotion = queryParams.get('qa-motion');
const visualQALogoView = queryParams.get('qa-logo-view');
const visualQATickerPhase = queryParams.get('ticker-phase');
const visualQAFocus = queryParams.get('qa-focus');
const visualQASafeArea = queryParams.get('qa-safe-area');
const visualQAPresence = queryParams.get('qa-presence');
const visualQAAnalytics = queryParams.get('qa-analytics');
const visualQAOnline = Number.parseInt(queryParams.get('qa-online') || '', 10);
const visualQAWeatherTemperature = Number.parseFloat(queryParams.get('qa-weather-temperature') || '');
const visualQAWeatherCode = Number.parseInt(queryParams.get('qa-weather-code') || '', 10);
const metrikaCounterId = 110837561;
const metrikaDisableKey = `disableYaCounter${metrikaCounterId}`;
const metrikaScriptId = 'yandex-metrika-script';
const analyticsConsentStorageKey = 'barberherman-analytics-consent';
const presenceEndpoint = (root.dataset.presenceEndpoint || '').replace(/\/+$/, '').replace(/\.json$/, '');
const presenceApiKey = root.dataset.presenceApiKey || '';
const presenceAuthStorageKey = 'barberherman-presence-auth-v2';
const legacyPresenceAuthStorageKey = 'barberherman-presence-auth';
const presenceActiveWindow = 75_000;
const presenceDisplayFreshWindow = 90_000;
const presenceStaleWindow = 180_000;
const presenceCleanupInterval = 300_000;
const weatherCacheKey = 'barberherman-moscow-weather';

root.dataset.presenceAvailable = String(Number.isFinite(visualQAOnline));

let hasSavedTheme = false;
let hasSavedReducedMotion = false;
let visualQAMotionOverride = visualQAMotion === 'reduce'
  ? true
  : visualQAMotion === 'full'
    ? false
    : null;
let pointerFrame = 0;
let latestPointerEvent = null;
let latestGlassSurface = null;
let panelLayer = 6;
let mostRecentPanelName = null;
let multitoolStatusTimer = 0;
let presenceTimer = 0;
let presenceAuth = null;
let presenceSyncing = false;
let presenceCleanupAt = 0;
let presenceLastConfirmedAt = 0;
let analyticsConsent = 'prompt';
let metrikaInitialized = false;
let privacyConsentTimer = 0;
let privacySettingsReturnTarget = null;
let menuOpen = true;
let menuDrawerAnimation = null;
const panelAnimations = new Map();

window[metrikaDisableKey] = true;

function reachMetrikaGoal(goal, params = {}) {
  if (!goal || analyticsConsent !== 'granted' || !metrikaInitialized || typeof window.ym !== 'function') return;
  window.ym(metrikaCounterId, 'reachGoal', goal, params);
}

function normalizeAnalyticsConsent(value) {
  return value === 'granted' || value === 'denied' ? value : 'prompt';
}

function loadAnalyticsConsent() {
  if (['granted', 'denied', 'prompt'].includes(visualQAAnalytics)) {
    return visualQAAnalytics;
  }
  try {
    return normalizeAnalyticsConsent(localStorage.getItem(analyticsConsentStorageKey));
  } catch {
    return 'prompt';
  }
}

function storeAnalyticsConsent(value) {
  if (['granted', 'denied', 'prompt'].includes(visualQAAnalytics)) return;
  try {
    localStorage.setItem(analyticsConsentStorageKey, value);
  } catch {
    // The current choice still applies when storage is unavailable.
  }
}

function ensureMetrikaFunction() {
  if (typeof window.ym === 'function') return;
  window.ym = function metrikaQueue() {
    (window.ym.a = window.ym.a || []).push(arguments);
  };
  window.ym.l = Date.now();
}

function startMetrika() {
  if (metrikaInitialized) return;

  window[metrikaDisableKey] = false;
  ensureMetrikaFunction();

  if (!document.getElementById(metrikaScriptId)) {
    const script = document.createElement('script');
    script.id = metrikaScriptId;
    script.async = true;
    script.src = 'https://mc.yandex.ru/metrika/tag.js';
    document.head.append(script);
  }

  window.ym(metrikaCounterId, 'init', {
    ssr: true,
    webvisor: true,
    clickmap: true,
    accurateTrackBounce: true,
    trackLinks: true,
  });
  metrikaInitialized = true;
}

function stopMetrika() {
  window[metrikaDisableKey] = true;
  if (metrikaInitialized && typeof window.ym === 'function') {
    window.ym(metrikaCounterId, 'destruct');
  }
  metrikaInitialized = false;
}

function syncAnalyticsControls() {
  root.dataset.analyticsConsent = analyticsConsent;
  analyticsChoiceButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.analyticsChoice === analyticsConsent));
  });
  if (privacySettingsLabel) {
    privacySettingsLabel.textContent = analyticsConsent === 'granted'
      ? 'Статистика включена'
      : analyticsConsent === 'denied'
        ? 'Статистика выключена'
        : 'Настроить статистику';
  }
}

function hidePrivacyConsent({ returnFocus = false } = {}) {
  if (!privacyConsent || privacyConsent.hidden) return;

  window.clearTimeout(privacyConsentTimer);
  privacyConsent.classList.remove('is-visible');
  privacySettingsButtons.forEach((button) => button.setAttribute('aria-expanded', 'false'));

  const finish = () => {
    if (!privacyConsent.classList.contains('is-visible')) privacyConsent.hidden = true;
    if (returnFocus && privacySettingsReturnTarget instanceof HTMLElement) {
      privacySettingsReturnTarget.focus({ preventScroll: true });
    }
    privacySettingsReturnTarget = null;
  };

  if (prefersReducedMotion()) finish();
  else privacyConsentTimer = window.setTimeout(finish, 220);
}

function showPrivacyConsent({ rememberFocus = false } = {}) {
  if (!privacyConsent) return;

  window.clearTimeout(privacyConsentTimer);
  if (rememberFocus && document.activeElement instanceof HTMLElement) {
    privacySettingsReturnTarget = document.activeElement;
  }
  privacyConsent.hidden = false;
  privacySettingsButtons.forEach((button) => button.setAttribute('aria-expanded', 'true'));
  requestAnimationFrame(() => privacyConsent.classList.add('is-visible'));
}

function applyAnalyticsConsent(value, { persist = false, dismiss = false } = {}) {
  analyticsConsent = normalizeAnalyticsConsent(value);
  if (persist && analyticsConsent !== 'prompt') storeAnalyticsConsent(analyticsConsent);

  if (analyticsConsent === 'granted') startMetrika();
  else stopMetrika();

  syncAnalyticsControls();
  if (dismiss) hidePrivacyConsent({ returnFocus: Boolean(privacySettingsReturnTarget) });
  else if (analyticsConsent === 'prompt') showPrivacyConsent();
}

if (['125', '150', '200'].includes(visualQATextScale)) root.dataset.qaText = visualQATextScale;
if (visualQAContrast === 'more') root.dataset.qaContrast = 'more';
if (visualQASafeArea === 'iphone') root.dataset.qaSafeArea = 'iphone';
if (['start', 'middle', 'seam'].includes(visualQATickerPhase)) {
  root.dataset.tickerPhase = visualQATickerPhase;
}

try {
  hasSavedTheme = ['light', 'dark'].includes(localStorage.getItem(themeStorageKey));
  hasSavedReducedMotion = localStorage.getItem(motionStorageKey) === 'true';
} catch {
  hasSavedTheme = false;
  hasSavedReducedMotion = false;
}

function showMultitoolStatus(message, { duration = 1300 } = {}) {
  if (!multitoolStatus || !message) return;

  window.clearTimeout(multitoolStatusTimer);
  multitoolStatus.classList.remove('is-visible');
  multitoolStatus.hidden = false;
  multitoolStatus.textContent = message;

  requestAnimationFrame(() => multitoolStatus.classList.add('is-visible'));
  multitoolStatusTimer = window.setTimeout(() => {
    multitoolStatus.classList.remove('is-visible');
    window.setTimeout(() => {
      if (!multitoolStatus.classList.contains('is-visible')) multitoolStatus.hidden = true;
    }, 230);
  }, duration);
}

function applyTheme(theme, { persist = false } = {}) {
  const isDark = theme === 'dark';
  const title = isDark ? 'Включить светлую тему' : 'Включить тёмную тему';

  root.dataset.theme = isDark ? 'dark' : 'light';
  root.style.colorScheme = isDark ? 'dark' : 'light';
  themeToggle?.setAttribute('aria-pressed', String(isDark));
  themeToggle?.setAttribute('aria-label', title);

  if (themeToggle) themeToggle.title = title;
  themeColor?.setAttribute('content', isDark ? '#09090b' : '#e8e8e5');

  if (!persist) return;

  hasSavedTheme = true;

  try {
    localStorage.setItem(themeStorageKey, isDark ? 'dark' : 'light');
  } catch {
    // The selected theme still applies when storage is unavailable.
  }
}

function applyLogoView(view, { persist = false } = {}) {
  const nextView = ['list', 'grid', 'poster'].includes(view) ? view : 'grid';

  root.dataset.logoView = nextView;
  logoViewButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.logoView === nextView));
  });

  if (!persist) return;

  try {
    localStorage.setItem(logoViewStorageKey, nextView);
  } catch {
    // The selected view still applies when storage is unavailable.
  }
}

function syncLogoImage(image) {
  const logo = image.closest('.logo');
  if (!logo) return;

  logo.dataset.logoLabel = image.alt || 'Логотип';
  logo.dataset.logoError = String(image.complete && image.naturalWidth === 0);
}

function prepareLogoImages(panel = document) {
  panel.querySelectorAll('.logo img').forEach((image) => {
    image.loading = 'eager';
    syncLogoImage(image);
  });
}

function syncTextScrollFade(scrollSurface) {
  const panel = scrollSurface.closest('.text-block');
  if (!panel) return;

  const hasScroll = scrollSurface.scrollHeight > scrollSurface.clientHeight + 2;
  const isAtEnd = !hasScroll
    || scrollSurface.scrollTop + scrollSurface.clientHeight >= scrollSurface.scrollHeight - 3;

  panel.dataset.hasScroll = String(hasScroll);
  panel.classList.toggle('is-scroll-end', isAtEnd);
}

function panelIsOpen(name) {
  const button = sectionButtons.find((item) => item.dataset.panel === name);
  return button?.getAttribute('aria-pressed') === 'true';
}

function panelMotionDuration(token, fallback) {
  const value = getComputedStyle(root).getPropertyValue(token).trim();
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return fallback;
  return value.endsWith('ms') ? amount : value.endsWith('s') ? amount * 1000 : fallback;
}

function panelMotionEasing(token, fallback) {
  return getComputedStyle(root).getPropertyValue(token).trim() || fallback;
}

function setPanelInteractionState(panel, visible) {
  panel.toggleAttribute('inert', !visible);
  if (visible) panel.removeAttribute('aria-hidden');
  else panel.setAttribute('aria-hidden', 'true');
}

function cancelPanelAnimation(panel) {
  const current = panelAnimations.get(panel);
  if (!current) return;

  current.animation.onfinish = null;
  current.animation.cancel();
  panelAnimations.delete(panel);
  panel.style.removeProperty('overflow');
}

function settlePanelAnimation(panel, visible, animation = null) {
  const current = panelAnimations.get(panel);
  if (animation && current?.animation !== animation) return;

  if (current) {
    current.animation.onfinish = null;
    current.animation.cancel();
    panelAnimations.delete(panel);
  }

  panel.style.removeProperty('overflow');
  panel.hidden = !visible;
  setPanelInteractionState(panel, visible);
  syncContentPresence();
  requestAnimationFrame(() => {
    clampCurrentMultitoolPosition();
    const scrollSurface = visible ? panel.querySelector('.text-block__scroll') : null;
    if (scrollSurface) syncTextScrollFade(scrollSurface);
  });
}

function settleAllPanelAnimations() {
  [...panelAnimations.entries()].forEach(([panel, current]) => {
    settlePanelAnimation(panel, current.visible, current.animation);
  });
}

function animatePanelVisibility(panel, visible, { animate = true } = {}) {
  cancelPanelAnimation(panel);

  if (visible) panel.hidden = false;
  setPanelInteractionState(panel, visible);

  if (!animate || prefersReducedMotion() || typeof panel.animate !== 'function' || (!visible && panel.hidden)) {
    settlePanelAnimation(panel, visible);
    return;
  }

  if (visible && panel.classList.contains('text-block') && !mobileQuery.matches) {
    const offset = panelOffset(panel);
    setPanelOffset(panel, offset.x, offset.y);
  }

  const isFlowPanel = mobileQuery.matches || Boolean(panel.closest('.multitool__drawer'));
  const entering = visible;
  const duration = panelMotionDuration(
    entering ? '--motion-panel-enter' : '--motion-panel-exit',
    entering ? 360 : 240,
  );
  const easing = panelMotionEasing(
    entering ? '--ease-panel-enter' : '--ease-panel-exit',
    entering ? 'cubic-bezier(.16, 1, .3, 1)' : 'cubic-bezier(.4, 0, .8, .2)',
  );
  let keyframes;

  if (isFlowPanel) {
    const panelHeight = panel.getBoundingClientRect().height;
    panel.style.overflow = 'hidden';
    keyframes = entering
      ? [
          { height: '0px', opacity: 0, translate: '0 -10px' },
          { height: `${panelHeight}px`, opacity: 1, translate: '0 0' },
        ]
      : [
          { height: `${panelHeight}px`, opacity: 1, translate: '0 0' },
          { height: '0px', opacity: 0, translate: '0 -8px' },
        ];
  } else {
    const direction = panel.classList.contains('text-block--profile') ? -18 : 18;
    keyframes = entering
      ? [
          { opacity: 0, scale: '.985', translate: `${direction}px 10px` },
          { opacity: 1, scale: '1', translate: '0 0' },
        ]
      : [
          { opacity: 1, scale: '1', translate: '0 0' },
          { opacity: 0, scale: '.992', translate: `${direction}px 8px` },
        ];
  }

  const animation = panel.animate(keyframes, { duration, easing, fill: 'both' });
  panelAnimations.set(panel, { animation, visible });
  animation.onfinish = () => settlePanelAnimation(panel, visible, animation);
}

function setMenuDrawerInteractionState(open) {
  multitoolDrawer?.toggleAttribute('inert', !open);
  if (open) multitoolDrawer?.removeAttribute('aria-hidden');
  else multitoolDrawer?.setAttribute('aria-hidden', 'true');
}

function cancelMenuDrawerAnimation() {
  if (!menuDrawerAnimation) return;

  menuDrawerAnimation.animation.onfinish = null;
  menuDrawerAnimation.animation.cancel();
  menuDrawerAnimation = null;
  multitoolDrawer?.style.removeProperty('overflow');
}

function settleMenuDrawer(open, animation = null) {
  if (animation && menuDrawerAnimation?.animation !== animation) return;

  if (menuDrawerAnimation) {
    menuDrawerAnimation.animation.onfinish = null;
    menuDrawerAnimation.animation.cancel();
    menuDrawerAnimation = null;
  }

  if (!multitoolDrawer) return;
  multitoolDrawer.style.removeProperty('overflow');
  multitoolDrawer.hidden = !open;
  setMenuDrawerInteractionState(open);
}

function animateMenuDrawer(open, { animate = true, startHeight = null } = {}) {
  if (!multitoolDrawer) return;

  cancelMenuDrawerAnimation();
  if (open) {
    multitoolDrawer.hidden = false;
    setMenuDrawerInteractionState(true);
  } else {
    setMenuDrawerInteractionState(false);
  }

  if (!animate || prefersReducedMotion() || typeof multitoolDrawer.animate !== 'function') {
    settleMenuDrawer(open);
    return;
  }

  const drawerHeight = open
    ? multitoolDrawer.getBoundingClientRect().height
    : Number.isFinite(startHeight) ? startHeight : multitoolDrawer.getBoundingClientRect().height;
  const entering = open;
  const duration = panelMotionDuration(
    entering ? '--motion-panel-enter' : '--motion-panel-exit',
    entering ? 360 : 240,
  );
  const easing = panelMotionEasing(
    entering ? '--ease-panel-enter' : '--ease-panel-exit',
    entering ? 'cubic-bezier(.16, 1, .3, 1)' : 'cubic-bezier(.4, 0, .8, .2)',
  );
  const keyframes = entering
    ? [
        { height: '0px', opacity: 0, translate: '0 -8px' },
        { height: `${drawerHeight}px`, opacity: 1, translate: '0 0' },
      ]
    : [
        { height: `${drawerHeight}px`, opacity: 1, translate: '0 0' },
        { height: '0px', opacity: 0, translate: '0 -6px' },
      ];

  multitoolDrawer.style.overflow = 'hidden';
  const animation = multitoolDrawer.animate(keyframes, { duration, easing, fill: 'both' });
  menuDrawerAnimation = { animation, open };
  animation.onfinish = () => settleMenuDrawer(open, animation);
}

function placeMenuToggle(open) {
  if (!multitoolMenuToggle || !multitoolPrimary || !multitoolService) return;

  if (open) multitoolService.append(multitoolMenuToggle);
  else multitoolPrimary.append(multitoolMenuToggle);
}

function setMenuOpen(open, { animate = true } = {}) {
  if (!multitool || !multitoolMenuToggle || !multitoolDrawer) return;

  const nextOpen = mobileQuery.matches ? Boolean(open) : true;
  const stateIsApplied = menuOpen === nextOpen && root.dataset.menuOpen === String(nextOpen);
  if (stateIsApplied) return;

  settleAllPanelAnimations();
  const toggleHadFocus = document.activeElement === multitoolMenuToggle;
  const closingHeight = !nextOpen && !multitoolDrawer.hidden
    ? multitoolDrawer.getBoundingClientRect().height
    : null;

  menuOpen = nextOpen;
  multitool.classList.toggle('is-open', nextOpen);
  root.dataset.menuOpen = String(nextOpen);
  multitoolMenuToggle.setAttribute('aria-expanded', String(nextOpen));
  multitoolMenuToggle.setAttribute('aria-label', nextOpen ? 'Свернуть меню' : 'Развернуть меню');
  multitoolMenuToggle.title = nextOpen ? 'Свернуть меню' : 'Развернуть меню';
  if (multitoolMenuLabel) {
    multitoolMenuLabel.textContent = nextOpen ? 'Свернуть меню' : 'Развернуть меню';
  }
  placeMenuToggle(nextOpen);

  ['profile', 'practice'].forEach((name) => {
    if (panelIsOpen(name)) animatePanelVisibility(contentPanels[name], nextOpen, { animate });
  });
  syncContentPresence();
  animateMenuDrawer(nextOpen, { animate, startHeight: closingHeight });
  syncStageVideos();

  if (!nextOpen) {
    requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
      multitoolMenuToggle.focus({ preventScroll: true });
    });
  } else if (toggleHadFocus && multitoolBooking) {
    requestAnimationFrame(() => multitoolBooking.focus({ preventScroll: true }));
  }
}

function syncContentPresence() {
  const hasVisibleText = menuOpen && ['profile', 'practice'].some(panelIsOpen);
  showcase?.classList.toggle('has-content', hasVisibleText);
  root.dataset.contentOpen = String(hasVisibleText);
}

function setPanelState(name, visible, { returnFocus = false, animate = true } = {}) {
  const panel = contentPanels[name];
  const button = sectionButtons.find((item) => item.dataset.panel === name);

  if (!panel || !button) return;

  const wasVisible = panelIsOpen(name);
  if (wasVisible === visible) return;

  button.setAttribute('aria-pressed', String(visible));
  button.setAttribute('aria-expanded', String(visible));
  animatePanelVisibility(panel, visible, { animate });
  if (visible) {
    mostRecentPanelName = name;
    if (!wasVisible) {
      const scrollSurface = panel.querySelector('.text-block__scroll');
      if (scrollSurface) {
        scrollSurface.scrollTop = 0;
        requestAnimationFrame(() => syncTextScrollFade(scrollSurface));
      }
    }
    prepareLogoImages(panel);
    if (panel.classList.contains('text-block')) bringPanelForward(panel);
  }
  syncContentPresence();
  requestAnimationFrame(() => {
    clampCurrentMultitoolPosition();
  });

  if (!visible && returnFocus) {
    button.focus({ preventScroll: true });
    if (mobileQuery.matches) {
      requestAnimationFrame(() => button.scrollIntoView({
        block: 'center',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      }));
    }
  }
}

function closeAllPanels({ animate = true } = {}) {
  Object.keys(contentPanels).forEach((name) => setPanelState(name, false, { animate }));
}

function keepSinglePanelOnMobile(preferredName = mostRecentPanelName) {
  if (!mobileQuery.matches) return;

  const visibleNames = Object.keys(contentPanels).filter(panelIsOpen);

  if (visibleNames.length < 2) return;

  const nameToKeep = visibleNames.includes(preferredName)
    ? preferredName
    : visibleNames.at(-1);

  visibleNames.forEach((name) => {
    if (name !== nameToKeep) setPanelState(name, false);
  });
}

function revealPanel(name) {
  const panel = contentPanels[name];
  if (!panel) return;

  const button = sectionButtons.find((item) => item.dataset.panel === name);
  const title = panel.querySelector('h2');
  const label = button?.querySelector('.multitool__section-label')?.textContent?.trim()
    || title?.textContent?.trim()
    || name;
  if (moduleStatus) moduleStatus.textContent = `Открыт раздел «${label}»`;
  showMultitoolStatus(`Открыт раздел «${label}»`, { duration: 1100 });

  requestAnimationFrame(() => {
    const isInlinePanel = Boolean(panel.closest('.multitool__drawer'));
    if ((mobileQuery.matches || isInlinePanel) && panel.matches('[tabindex]')) {
      panel.focus({ preventScroll: true });
    }

    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';

    if (mobileQuery.matches) {
      panel.scrollIntoView({ block: 'start', behavior });
    } else if (isInlinePanel && multitoolDrawer) {
      multitoolDrawer.scrollTo({ top: panel.offsetTop, behavior });
    }
  });
}

function applyVisualQAContentState() {
  const requestedPanels = (visualQAPanels || '')
    .split(',')
    .filter((name) => name in contentPanels);
  const sectionPanel = visualQASection in contentPanels ? visualQASection : null;

  if (sectionPanel) requestedPanels.push(sectionPanel);
  [...new Set(requestedPanels)].forEach((name) => setPanelState(name, true, { animate: false }));
}

function prefersReducedMotion() {
  if (visualQAMotionOverride !== null) return visualQAMotionOverride;
  return reduceMotionQuery.matches || hasSavedReducedMotion;
}

function prefersReducedTransparency() {
  return reduceTransparencyQuery.matches || visualQASystemTransparency === 'reduce';
}

function applyTransparencyPreference() {
  const isReduced = prefersReducedTransparency();
  root.dataset.systemReducedTransparency = String(isReduced);
}

function visitorUnit(count) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return ' посетителей';
  if (mod10 === 1) return ' посетитель';
  if (mod10 >= 2 && mod10 <= 4) return ' посетителя';
  return ' посетителей';
}

function renderOnlineCount(count) {
  if (!onlineCountLabel || !onlineUnitLabel || !Number.isFinite(count)) return;
  const safeCount = Math.max(0, Math.round(count));
  presenceLastConfirmedAt = Date.now();
  root.dataset.presenceAvailable = 'true';
  onlineCountLabel.textContent = String(safeCount);
  onlineUnitLabel.textContent = visitorUnit(safeCount);
}

function hideStalePresence() {
  if (!presenceLastConfirmedAt) return;
  if (Date.now() - presenceLastConfirmedAt <= presenceDisplayFreshWindow) return;

  presenceLastConfirmedAt = 0;
  root.dataset.presenceAvailable = 'false';
  if (onlineCountLabel) onlineCountLabel.textContent = '—';
  if (onlineUnitLabel) onlineUnitLabel.textContent = ' посетителей';
}

function normalizePresenceAuth(payload) {
  const uid = payload?.uid || payload?.localId || payload?.user_id;
  const idToken = payload?.idToken || payload?.id_token;
  const refreshToken = payload?.refreshToken || payload?.refresh_token;
  const expiresIn = Number(payload?.expiresIn || payload?.expires_in);

  if (!uid || !idToken || !refreshToken || !Number.isFinite(expiresIn)) return null;

  return {
    uid,
    idToken,
    refreshToken,
    expiresAt: Date.now() + (expiresIn * 1000),
  };
}

function loadPresenceAuth() {
  if (presenceAuth) return presenceAuth;
  try {
    const stored = JSON.parse(localStorage.getItem(presenceAuthStorageKey) || 'null');
    if (
      typeof stored?.uid === 'string'
      && typeof stored?.idToken === 'string'
      && typeof stored?.refreshToken === 'string'
      && Number.isFinite(Number(stored?.expiresAt))
    ) presenceAuth = { ...stored, expiresAt: Number(stored.expiresAt) };
  } catch {
    // Presence can continue in memory when local storage is unavailable.
  }
  try {
    sessionStorage.removeItem(legacyPresenceAuthStorageKey);
  } catch {
    // An old per-tab session can expire without affecting the shared session.
  }
  return presenceAuth;
}

function storePresenceAuth(auth) {
  presenceAuth = auth;
  try {
    localStorage.setItem(presenceAuthStorageKey, JSON.stringify(auth));
  } catch {
    // Presence can continue in memory when local storage is unavailable.
  }
}

function clearPresenceAuth() {
  presenceAuth = null;
  try {
    localStorage.removeItem(presenceAuthStorageKey);
  } catch {
    // Nothing else is required when local storage is unavailable.
  }
}

async function createPresenceAuth() {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(presenceApiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
      cache: 'no-store',
      credentials: 'omit',
    }
  );
  if (!response.ok) throw new Error(`Presence sign-in failed: ${response.status}`);

  const auth = normalizePresenceAuth(await response.json());
  if (!auth) throw new Error('Presence sign-in returned an incomplete session');
  storePresenceAuth(auth);
  return auth;
}

async function refreshPresenceAuth(auth) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: auth.refreshToken,
  });
  const response = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(presenceApiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
      credentials: 'omit',
    }
  );
  if (!response.ok) throw new Error(`Presence token refresh failed: ${response.status}`);

  const nextAuth = normalizePresenceAuth(await response.json());
  if (!nextAuth) throw new Error('Presence token refresh returned an incomplete session');
  storePresenceAuth(nextAuth);
  return nextAuth;
}

async function resolvePresenceAuth() {
  const auth = loadPresenceAuth();
  if (auth?.expiresAt > Date.now() + 120_000) return auth;

  if (auth?.refreshToken) {
    try {
      return await refreshPresenceAuth(auth);
    } catch {
      clearPresenceAuth();
    }
  }
  return createPresenceAuth();
}

async function ensurePresenceAuth() {
  if (navigator.locks?.request) {
    return navigator.locks.request('barberherman-presence-auth', resolvePresenceAuth);
  }
  return resolvePresenceAuth();
}

function presenceUrl(path, auth, query = {}) {
  const url = new URL(`${presenceEndpoint}${path}.json`);
  url.searchParams.set('auth', auth.idToken);
  Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, String(value)));
  return url;
}

async function confirmedPresenceTime(auth) {
  const response = await fetch(presenceUrl(`/${encodeURIComponent(auth.uid)}`, auth), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seenAt: { '.sv': 'timestamp' } }),
    cache: 'no-store',
    credentials: 'omit',
  });
  if (!response.ok) throw new Error(`Presence write failed: ${response.status}`);

  const written = await response.json();
  let serverNow = Number(written?.seenAt);
  if (Number.isFinite(serverNow)) return serverNow;

  const timeResponse = await fetch(
    presenceUrl(`/${encodeURIComponent(auth.uid)}/seenAt`, auth),
    { cache: 'no-store', credentials: 'omit' }
  );
  if (!timeResponse.ok) throw new Error(`Presence timestamp read failed: ${timeResponse.status}`);
  serverNow = Number(await timeResponse.json());
  if (!Number.isFinite(serverNow)) throw new Error('Presence timestamp was not confirmed');
  return serverNow;
}

async function cleanupStalePresence(auth, serverNow) {
  if (Date.now() < presenceCleanupAt) return;
  presenceCleanupAt = Date.now() + presenceCleanupInterval;

  const response = await fetch(presenceUrl('', auth, {
    orderBy: JSON.stringify('seenAt'),
    endAt: serverNow - presenceStaleWindow,
    limitToFirst: 25,
  }), { cache: 'no-store', credentials: 'omit' });
  if (!response.ok) return;

  const staleSessions = await response.json();
  await Promise.allSettled(Object.keys(staleSessions || {}).map((uid) => fetch(
    presenceUrl(`/${encodeURIComponent(uid)}`, auth),
    { method: 'DELETE', cache: 'no-store', credentials: 'omit' }
  )));
}

async function syncPresence() {
  if (Number.isFinite(visualQAOnline)) {
    renderOnlineCount(visualQAOnline);
    return;
  }
  if (!presenceEndpoint || !presenceApiKey || presenceSyncing) return;

  presenceSyncing = true;
  try {
    const auth = await ensurePresenceAuth();
    const serverNow = await confirmedPresenceTime(auth);
    const listResponse = await fetch(presenceUrl('', auth, {
      orderBy: JSON.stringify('seenAt'),
      startAt: serverNow - presenceActiveWindow,
      limitToLast: 500,
    }), { cache: 'no-store', credentials: 'omit' });
    if (!listResponse.ok) throw new Error(`Presence read failed: ${listResponse.status}`);
    const sessions = await listResponse.json();
    renderOnlineCount(Object.keys(sessions || {}).length);
    cleanupStalePresence(auth, serverNow).catch(() => {});
  } catch {
    // Keep the last confirmed value; a realtime number must never be fabricated.
  } finally {
    presenceSyncing = false;
  }
}

function disconnectPresence() {
  window.clearInterval(presenceTimer);
}

function startPresence() {
  if (Number.isFinite(visualQAOnline)) {
    renderOnlineCount(visualQAOnline);
    if (visualQAPresence === 'stale') {
      presenceLastConfirmedAt = Date.now() - presenceDisplayFreshWindow - 1;
      hideStalePresence();
    }
    return;
  }
  if (!presenceEndpoint || !presenceApiKey) return;
  syncPresence();
  window.clearInterval(presenceTimer);
  presenceTimer = window.setInterval(() => {
    hideStalePresence();
    syncPresence();
  }, 25_000);
}

function weatherLabel(code) {
  if (code === 0) return 'ясно';
  if ([1, 2].includes(code)) return 'малооблачно';
  if (code === 3) return 'облачно';
  if ([45, 48].includes(code)) return 'туман';
  if (code >= 51 && code <= 57) return 'морось';
  if (code >= 61 && code <= 67) return 'дождь';
  if (code >= 71 && code <= 77) return 'снег';
  if (code >= 80 && code <= 82) return 'ливни';
  if ([85, 86].includes(code)) return 'снегопад';
  if (code >= 95) return 'гроза';
  return 'погода';
}

function renderWeather(temperature, code) {
  if (!weatherTemperatureLabel || !weatherStatusLabel) return;
  const roundedTemperature = Math.round(temperature);
  const label = weatherLabel(code);
  weatherTemperatureLabel.textContent = `${roundedTemperature}\u202f°C`;
  weatherStatusLabel.textContent = label;
  weatherLink?.setAttribute(
    'aria-label',
    `Москва: ${roundedTemperature} градусов Цельсия, ${label}. Источник — Open-Meteo`
  );
}

function readCachedWeather() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(weatherCacheKey) || 'null');
    if (!cached || Date.now() - Number(cached.fetchedAt) > 15 * 60 * 1000) return null;
    if (!Number.isFinite(cached.temperature) || !Number.isFinite(cached.code)) return null;
    return cached;
  } catch {
    return null;
  }
}

async function loadWeather() {
  if (Number.isFinite(visualQAWeatherTemperature) && Number.isFinite(visualQAWeatherCode)) {
    renderWeather(visualQAWeatherTemperature, visualQAWeatherCode);
    return;
  }

  const cached = readCachedWeather();
  if (cached) renderWeather(cached.temperature, cached.code);

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: '55.7558',
    longitude: '37.6173',
    current: 'temperature_2m,weather_code',
    temperature_unit: 'celsius',
    timezone: 'Europe/Moscow',
  });

  try {
    const response = await fetch(url, { mode: 'cors', cache: 'no-store' });
    if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
    const data = await response.json();
    const temperature = Number(data.current?.temperature_2m);
    const code = Number(data.current?.weather_code);
    if (!Number.isFinite(temperature) || !Number.isFinite(code)) throw new Error('Weather data is invalid');
    renderWeather(temperature, code);
    try {
      sessionStorage.setItem(weatherCacheKey, JSON.stringify({ temperature, code, fetchedAt: Date.now() }));
    } catch {
      // Weather still renders when storage is unavailable.
    }
  } catch {
    if (!cached && weatherStatusLabel) weatherStatusLabel.textContent = 'недоступно';
  }
}

function attachVideoSource(video) {
  const source = video.dataset.src;
  if (!source || video.dataset.sourceAttached === source) return;

  video.src = source;
  video.dataset.sourceAttached = source;
  video.load();
}

function detachVideoSource(video) {
  if (!video.dataset.sourceAttached && !video.getAttribute('src')) return;

  video.pause();
  video.removeAttribute('src');
  delete video.dataset.sourceAttached;
  video.load();
}

function lockVideoToVisualPhase(video) {
  const phases = { start: .02, middle: .5, end: .96 };
  if (!(visualQAVideoPhase in phases)) return;

  const lockPhase = () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;

    video.pause();
    video.currentTime = Math.min(video.duration - .05, video.duration * phases[visualQAVideoPhase]);
    delete video.dataset.visualPhasePending;
  };

  /* Setting currentTime at loadedmetadata is ignored by some browsers until
     the first frame is decoded. Keep visual QA deterministic by seeking only
     once the media has current data. */
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    lockPhase();
  } else if (video.dataset.visualPhasePending !== visualQAVideoPhase) {
    video.dataset.visualPhasePending = visualQAVideoPhase;
    video.addEventListener('loadeddata', lockPhase, { once: true });
  }
}

function syncStageVideos() {
  const mobile = mobileQuery.matches;
  const saveData = dataConnection?.saveData === true;
  const isReduced = prefersReducedMotion();
  root.dataset.saveData = String(saveData);

  stageVideos.forEach((video) => {
    const isMobileVideo = video.classList.contains('stage-video--mobile');
    const isBreakpointVideo = mobile === isMobileVideo;
    const shouldLoad = isBreakpointVideo
      && (Boolean(visualQAVideoPhase) || (!isReduced && (!saveData || !menuOpen)));
    const shouldPlay = shouldLoad && !visualQAVideoPhase && !document.hidden;

    if (shouldLoad) attachVideoSource(video);
    else detachVideoSource(video);

    if (visualQAVideoPhase && shouldLoad) {
      lockVideoToVisualPhase(video);
    } else if (shouldPlay) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  });
}

function applyMotionPreference({ persist = false } = {}) {
  const isReduced = prefersReducedMotion();
  const isSystemReduced = reduceMotionQuery.matches;
  const title = isSystemReduced
    ? 'Движение уменьшено в настройках системы'
    : isReduced
      ? 'Включить движение'
      : 'Уменьшить движение';

  root.dataset.reduceMotion = String(isReduced);
  motionToggle?.setAttribute('aria-pressed', String(isReduced));
  motionToggle?.setAttribute('aria-label', title);
  motionToggle?.setAttribute('aria-disabled', String(isSystemReduced));

  if (motionToggle) motionToggle.title = title;
  if (isReduced) {
    settleAllPanelAnimations();
    if (menuDrawerAnimation) {
      settleMenuDrawer(menuDrawerAnimation.open, menuDrawerAnimation.animation);
    }
  }

  if (persist) {
    try {
      if (hasSavedReducedMotion) localStorage.setItem(motionStorageKey, 'true');
      else localStorage.removeItem(motionStorageKey);
    } catch {
      // The selected preference still applies when storage is unavailable.
    }
  }

  syncStageVideos();
}

function lockVideoPhaseForVisualQA() {
  stageVideos.forEach(lockVideoToVisualPhase);
}

async function focusVisualQASection() {
  const selectorBySection = {
    media: '.multitool__catalog[aria-labelledby="media-title"]',
    partners: '.multitool__catalog[aria-labelledby="partners-title"]',
    gallery: '.multitool__gallery',
    profile: '.text-block--profile',
    practice: '.text-block--practice',
  };
  const selector = selectorBySection[visualQASection];
  const target = selector ? document.querySelector(selector) : null;

  if (!target) return;

  try {
    await document.fonts?.ready;
  } catch {
    // The QA focus still runs when the Font Loading API is unavailable.
  }

  requestAnimationFrame(() => {
    if (mobileQuery.matches) {
      target.scrollIntoView({ block: 'start' });
      return;
    }

    if (target.closest('.multitool__drawer') && multitoolDrawer) {
      multitoolDrawer.scrollTop = target.offsetTop;
      return;
    }

    target.scrollIntoView({ block: 'center' });
  });
}

function paintGlassHighlight() {
  pointerFrame = 0;

  if (!latestPointerEvent || !latestGlassSurface) return;

  const rect = latestGlassSurface.getBoundingClientRect();
  latestGlassSurface.style.setProperty('--glass-x', `${latestPointerEvent.clientX - rect.left}px`);
  latestGlassSurface.style.setProperty('--glass-y', `${latestPointerEvent.clientY - rect.top}px`);
}

function updateGlassHighlight(event) {
  if (!finePointerQuery.matches || prefersReducedMotion()) return;

  latestPointerEvent = event;
  latestGlassSurface = event.currentTarget;
  if (!pointerFrame) pointerFrame = requestAnimationFrame(paintGlassHighlight);
}

function panelOffset(panel) {
  return {
    x: Number.parseFloat(panel.dataset.dragX || '0') || 0,
    y: Number.parseFloat(panel.dataset.dragY || '0') || 0,
  };
}

function dragViewportInsets() {
  const styles = getComputedStyle(root);
  const inset = (name) => Number.parseFloat(styles.getPropertyValue(name)) || 0;
  const dragMargin = 8;

  return {
    top: inset('--safe-top') + dragMargin,
    right: inset('--safe-right') + dragMargin,
    bottom: inset('--safe-bottom') + dragMargin,
    left: inset('--safe-left') + dragMargin,
  };
}

function setPanelOffset(panel, x, y) {
  let nextX = x;
  let nextY = y;

  if (!mobileQuery.matches && !panel.hidden) {
    const current = panelOffset(panel);
    const rect = panel.getBoundingClientRect();
    const insets = dragViewportInsets();
    const baseLeft = rect.left - current.x;
    const baseTop = rect.top - current.y;
    const minX = insets.left - baseLeft;
    const maxX = window.innerWidth - insets.right - (baseLeft + rect.width);
    const minimumPanelHeight = Math.min(360, Math.max(260, window.innerHeight * .45));
    const minY = insets.top - baseTop;
    const maxY = window.innerHeight - insets.bottom - minimumPanelHeight - baseTop;

    nextX = minX <= maxX ? Math.min(maxX, Math.max(minX, x)) : 0;
    nextY = minY <= maxY ? Math.min(maxY, Math.max(minY, y)) : minY;

    const availableHeight = Math.max(
      minimumPanelHeight,
      window.innerHeight - insets.bottom - (baseTop + nextY),
    );
    panel.style.setProperty('--panel-available-height', `${Math.floor(availableHeight)}px`);
  }

  panel.dataset.dragX = String(Math.round(nextX));
  panel.dataset.dragY = String(Math.round(nextY));
  panel.style.setProperty('--drag-x', `${Math.round(nextX)}px`);
  panel.style.setProperty('--drag-y', `${Math.round(nextY)}px`);
}

function bringPanelForward(panel) {
  panelLayer += 1;
  panel.style.zIndex = String(panelLayer);
}

function resetPanelPosition(panel) {
  panel.style.removeProperty('--panel-available-height');
  setPanelOffset(panel, 0, 0);
}

function enablePanelDragging(panel) {
  const handle = panel.querySelector('.text-block__drag-handle');
  if (!handle) return;

  let dragState = null;

  panel.addEventListener('pointerdown', (event) => {
    if (mobileQuery.matches || event.button !== 0) return;
    if (event.target.closest('a, button:not(.text-block__drag-handle), input, select, textarea, [contenteditable="true"]')) return;

    const scrollSurface = event.target.closest('.text-block__scroll');
    if (scrollSurface && event.clientX > scrollSurface.getBoundingClientRect().right - 18) return;

    const offset = panelOffset(panel);
    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
      active: false,
    };

    bringPanelForward(panel);
    panel.setPointerCapture(event.pointerId);
  });

  panel.addEventListener('pointermove', (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    if (!dragState.active && Math.hypot(deltaX, deltaY) < 5) return;
    if (!dragState.active) {
      dragState.active = true;
      panel.classList.add('is-dragging');
    }

    setPanelOffset(
      panel,
      dragState.offsetX + deltaX,
      dragState.offsetY + deltaY,
    );
    event.preventDefault();
  });

  const finishDrag = (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    dragState = null;
    panel.classList.remove('is-dragging');
  };

  panel.addEventListener('pointerup', finishDrag);
  panel.addEventListener('pointercancel', finishDrag);
  panel.addEventListener('lostpointercapture', () => {
    dragState = null;
    panel.classList.remove('is-dragging');
  });

  handle.addEventListener('keydown', (event) => {
    if (mobileQuery.matches) return;

    if (event.key === 'Home') {
      resetPanelPosition(panel);
      bringPanelForward(panel);
      event.preventDefault();
      return;
    }

    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (!direction) return;

    const offset = panelOffset(panel);
    const step = event.shiftKey ? 48 : 16;
    setPanelOffset(panel, offset.x + direction[0] * step, offset.y + direction[1] * step);
    bringPanelForward(panel);
    event.preventDefault();
  });
}

function multitoolOffset() {
  return {
    x: Number.parseFloat(multitool?.dataset.dragX || '0') || 0,
    y: Number.parseFloat(multitool?.dataset.dragY || '0') || 0,
  };
}

function clampMultitoolOffset(x, y) {
  if (!multitool || mobileQuery.matches) return { x: 0, y: 0 };

  const insets = dragViewportInsets();
  const rect = multitool.getBoundingClientRect();
  const transform = getComputedStyle(multitool).transform;
  let renderedX = 0;
  let renderedY = 0;

  if (transform && transform !== 'none') {
    try {
      const matrix = new DOMMatrixReadOnly(transform);
      renderedX = matrix.m41;
      renderedY = matrix.m42;
    } catch {
      const current = multitoolOffset();
      renderedX = current.x;
      renderedY = current.y;
    }
  }

  const baseLeft = rect.left - renderedX;
  const baseTop = rect.top - renderedY;
  const minX = insets.left - baseLeft;
  const maxX = window.innerWidth - insets.right - baseLeft - rect.width;
  const minY = insets.top - baseTop;
  const maxY = window.innerHeight - insets.bottom - baseTop - rect.height;
  const clampAxis = (value, min, max) => (min > max ? min : Math.min(max, Math.max(min, value)));

  return {
    x: clampAxis(x, minX, maxX),
    y: clampAxis(y, minY, maxY),
  };
}

function setMultitoolOffset(x, y) {
  if (!multitool) return;

  const next = clampMultitoolOffset(x, y);
  const roundedX = Math.round(next.x);
  const roundedY = Math.round(next.y);
  multitool.dataset.dragX = String(roundedX);
  multitool.dataset.dragY = String(roundedY);
  multitool.style.setProperty('--multitool-drag-x', `${roundedX}px`);
  multitool.style.setProperty('--multitool-drag-y', `${roundedY}px`);
}

function resetMultitoolPosition({ announce = false } = {}) {
  if (!multitool) return;

  setMultitoolOffset(0, 0);
  if (announce) showMultitoolStatus('Меню возвращено в центр');
}

function clampCurrentMultitoolPosition() {
  if (!multitool || mobileQuery.matches) return;
  const offset = multitoolOffset();
  setMultitoolOffset(offset.x, offset.y);
}

function syncMultitoolDragAvailability() {
  if (!multitoolDragHandle) return;

  const isAvailable = !mobileQuery.matches && finePointerQuery.matches;
  multitoolDragHandle.disabled = !isAvailable;
  multitoolDragHandle.tabIndex = isAvailable ? 0 : -1;
  multitoolDragHandle.setAttribute('aria-hidden', String(!isAvailable));
  if (!isAvailable) resetMultitoolPosition();
  else requestAnimationFrame(clampCurrentMultitoolPosition);
}

function syncPanelDragAvailability() {
  const isAvailable = !mobileQuery.matches;

  draggablePanels.forEach((panel) => {
    const handle = panel.querySelector('.text-block__drag-handle');
    if (!handle) return;

    handle.disabled = !isAvailable;
    handle.tabIndex = isAvailable ? 0 : -1;
    handle.setAttribute('aria-hidden', String(!isAvailable));
  });
}

function enableMultitoolDragging() {
  if (!multitool || !multitoolDragHandle) return;

  let dragState = null;
  let suppressNextClick = false;

  multitool.addEventListener('click', (event) => {
    if (!suppressNextClick) return;

    suppressNextClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  multitool.addEventListener('dragstart', (event) => {
    if (dragState) event.preventDefault();
  });

  multitool.addEventListener('pointerdown', (event) => {
    if (mobileQuery.matches || !finePointerQuery.matches || event.button !== 0) return;

    const drawer = event.target.closest('.multitool__drawer');
    if (drawer && drawer.scrollHeight > drawer.clientHeight) {
      const drawerRect = drawer.getBoundingClientRect();
      if (event.clientX > drawerRect.right - 18) return;
    }

    const offset = multitoolOffset();
    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
      active: false,
    };

    panelLayer += 1;
    multitool.style.zIndex = String(panelLayer);
  });

  window.addEventListener('pointermove', (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    if (!dragState.active && Math.hypot(deltaX, deltaY) < 5) return;

    if (!dragState.active) {
      dragState.active = true;
      multitool.classList.add('is-dragging');
    }

    setMultitoolOffset(dragState.offsetX + deltaX, dragState.offsetY + deltaY);
    event.preventDefault();
  });

  const finishDrag = (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    const moved = dragState.active;
    dragState = null;
    multitool.classList.remove('is-dragging');
    if (moved) {
      suppressNextClick = true;
      window.setTimeout(() => { suppressNextClick = false; }, 0);
      if (document.activeElement === multitoolDragHandle) multitoolDragHandle.blur();
      showMultitoolStatus('Меню перемещено · двойной клик — вернуть в центр', { duration: 2600 });
    }
  };

  window.addEventListener('pointerup', finishDrag);
  window.addEventListener('pointercancel', finishDrag);

  multitoolDragHandle.addEventListener('dblclick', (event) => {
    if (mobileQuery.matches) return;
    resetMultitoolPosition({ announce: true });
    multitoolDragHandle.blur();
    event.preventDefault();
  });

  multitoolDragHandle.addEventListener('keydown', (event) => {
    if (mobileQuery.matches) return;

    if (event.key === 'Home') {
      resetMultitoolPosition({ announce: true });
      event.preventDefault();
      return;
    }

    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (!direction) return;

    const offset = multitoolOffset();
    const step = event.shiftKey ? 48 : 16;
    setMultitoolOffset(offset.x + direction[0] * step, offset.y + direction[1] * step);
    panelLayer += 1;
    multitool.style.zIndex = String(panelLayer);
    showMultitoolStatus('Положение меню изменено · Home — вернуть в центр');
    event.preventDefault();
  });
}

let initialLogoView = 'grid';

try {
  initialLogoView = localStorage.getItem(logoViewStorageKey) || 'grid';
} catch {
  initialLogoView = 'grid';
}

applyTheme(['light', 'dark'].includes(visualQATheme) ? visualQATheme : root.dataset.theme);
applyLogoView(visualQALogoView || initialLogoView);
applyMotionPreference();
applyTransparencyPreference();
applyAnalyticsConsent(loadAnalyticsConsent());
loadWeather();
startPresence();
lockVideoPhaseForVisualQA();
applyVisualQAContentState();
setMenuOpen(visualQAMenu !== 'compact', { animate: false });
focusVisualQASection();
syncStageVideos();
syncMultitoolDragAvailability();
syncPanelDragAvailability();
enableMultitoolDragging();

if (visualQAFocus === 'skip') {
  requestAnimationFrame(() => document.querySelector('.skip-link')?.focus());
}

if (window.location.hash === '#privacy-settings') {
  showPrivacyConsent();
  requestAnimationFrame(() => {
    const currentChoice = analyticsChoiceButtons.find(
      (choice) => choice.dataset.analyticsChoice === analyticsConsent
    );
    (currentChoice || analyticsChoiceButtons[0])?.focus({ preventScroll: true });
  });
}

requestAnimationFrame(() => root.classList.add('theme-ready'));

themeToggle?.addEventListener('click', () => {
  const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme, { persist: true });
  showMultitoolStatus(nextTheme === 'dark' ? 'Тёмная тема включена' : 'Светлая тема включена');
});

motionToggle?.addEventListener('click', () => {
  if (reduceMotionQuery.matches) {
    showMultitoolStatus('Движение уменьшено в настройках системы');
    return;
  }

  hasSavedReducedMotion = !hasSavedReducedMotion;
  applyMotionPreference({ persist: true });
  showMultitoolStatus(hasSavedReducedMotion ? 'Движение уменьшено' : 'Движение включено');
});

multitoolMenuToggle?.addEventListener('click', () => {
  setMenuOpen(!menuOpen);
});

privacySettingsButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (!privacyConsent?.hidden && privacyConsent.classList.contains('is-visible')) {
      hidePrivacyConsent({ returnFocus: true });
      return;
    }
    showPrivacyConsent({ rememberFocus: true });
    requestAnimationFrame(() => {
      const currentChoice = analyticsChoiceButtons.find(
        (choice) => choice.dataset.analyticsChoice === analyticsConsent
      );
      (currentChoice || analyticsChoiceButtons[0])?.focus({ preventScroll: true });
    });
  });
});

analyticsChoiceButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const choice = normalizeAnalyticsConsent(button.dataset.analyticsChoice);
    applyAnalyticsConsent(choice, { persist: true, dismiss: true });
    showMultitoolStatus(choice === 'granted' ? 'Статистика включена' : 'Статистика выключена');
  });
});

logoViewButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyLogoView(button.dataset.logoView, { persist: true });
    const panel = button.closest('[data-catalog]');
    prepareLogoImages(panel || document);
    if (moduleStatus) {
      const labels = { list: 'списком', grid: 'сеткой', poster: 'крупными карточками' };
      moduleStatus.textContent = `Логотипы показаны ${labels[button.dataset.logoView]}`;
    }
    if (mobileQuery.matches && panel) {
      requestAnimationFrame(() => panel.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' }));
    }
  });
});

sectionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const name = button.dataset.panel;
    const willShow = button.getAttribute('aria-pressed') !== 'true';
    if (willShow && mobileQuery.matches) closeAllPanels({ animate: false });
    setPanelState(name, willShow);
    if (willShow) {
      reachMetrikaGoal('module_open', { module: name });
      revealPanel(name);
    }
  });
});

document.addEventListener('click', (event) => {
  const control = event.target instanceof Element
    ? event.target.closest('[data-metrika-goal]')
    : null;
  if (!control) return;

  reachMetrikaGoal(control.dataset.metrikaGoal, {
    label: control.dataset.metrikaLabel || control.getAttribute('aria-label') || control.textContent.trim(),
  });
});

panelCloseButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setPanelState(button.dataset.closePanel, false, { returnFocus: true });
  });
});

draggablePanels.forEach(enablePanelDragging);
logoImages.forEach((image) => {
  image.addEventListener('load', () => syncLogoImage(image));
  image.addEventListener('error', () => syncLogoImage(image));
  syncLogoImage(image);
});
textScrollSurfaces.forEach((scrollSurface) => {
  scrollSurface.addEventListener('scroll', () => syncTextScrollFade(scrollSurface), { passive: true });
  requestAnimationFrame(() => syncTextScrollFade(scrollSurface));
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;

  if (privacyConsent && !privacyConsent.hidden) {
    hidePrivacyConsent({ returnFocus: true });
    event.preventDefault();
    return;
  }

  if (mobileQuery.matches && !menuOpen) return;

  const recentPanel = mostRecentPanelName ? contentPanels[mostRecentPanelName] : null;
  const fallbackName = Object.keys(contentPanels).filter(panelIsOpen).at(-1);
  const name = recentPanel && panelIsOpen(mostRecentPanelName) ? mostRecentPanelName : fallbackName;

  if (name) {
    setPanelState(name, false, { returnFocus: true });
    event.preventDefault();
  } else if (mobileQuery.matches) {
    setMenuOpen(false);
    event.preventDefault();
  }
});

mobileQuery.addEventListener('change', () => {
  settleAllPanelAnimations();
  if (!mobileQuery.matches) setMenuOpen(true, { animate: false });
  syncStageVideos();
  syncMultitoolDragAvailability();
  syncPanelDragAvailability();
  if (mobileQuery.matches) {
    draggablePanels.forEach(resetPanelPosition);
    keepSinglePanelOnMobile();
  } else {
    requestAnimationFrame(clampCurrentMultitoolPosition);
  }
});
reduceMotionQuery.addEventListener('change', applyMotionPreference);
reduceTransparencyQuery.addEventListener('change', applyTransparencyPreference);
colorSchemeQuery.addEventListener('change', (event) => {
  if (!hasSavedTheme) applyTheme(event.matches ? 'dark' : 'light');
});
document.addEventListener('visibilitychange', () => {
  syncStageVideos();
  if (!document.hidden) syncPresence();
});
window.addEventListener('pagehide', disconnectPresence);
window.addEventListener('pageshow', (event) => {
  if (event.persisted) startPresence();
});
dataConnection?.addEventListener?.('change', syncStageVideos);
finePointerQuery.addEventListener('change', syncMultitoolDragAvailability);
window.addEventListener('resize', () => requestAnimationFrame(() => {
  clampCurrentMultitoolPosition();
  textScrollSurfaces.forEach(syncTextScrollFade);
  draggablePanels.forEach((panel) => {
    if (panel.hidden) return;
    const offset = panelOffset(panel);
    setPanelOffset(panel, offset.x, offset.y);
  });
}));
glassSurfaces.forEach((surface) => surface.addEventListener('pointermove', updateGlassHighlight, { passive: true }));
