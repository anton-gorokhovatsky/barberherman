const root = document.documentElement;
const themeToggle = document.querySelector('.theme-toggle');
const motionToggle = document.querySelector('.motion-toggle');
const logoViewButtons = [...document.querySelectorAll('button[data-logo-view]')];
const themeColor = document.getElementById('theme-color');
const multitool = document.querySelector('.multitool');
const multitoolDragHandle = document.querySelector('.multitool__drag-handle');
const multitoolStatus = document.querySelector('.multitool__status');
const multitoolDrawer = document.getElementById('multitool-drawer');
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
const visualQAOnline = Number.parseInt(queryParams.get('qa-online') || '', 10);
const visualQAWeatherTemperature = Number.parseFloat(queryParams.get('qa-weather-temperature') || '');
const visualQAWeatherCode = Number.parseInt(queryParams.get('qa-weather-code') || '', 10);
const metrikaCounterId = 110837561;
const presenceEndpoint = (root.dataset.presenceEndpoint || '').replace(/\/+$/, '');
const weatherCacheKey = 'barberherman-moscow-weather';

root.dataset.presenceAvailable = String(
  Number.isFinite(visualQAOnline) || Boolean(presenceEndpoint)
);

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
let presenceSessionId = '';

function reachMetrikaGoal(goal, params = {}) {
  if (!goal || typeof window.ym !== 'function') return;
  window.ym(metrikaCounterId, 'reachGoal', goal, params);
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

function syncContentPresence() {
  const hasVisibleText = ['profile', 'practice'].some((key) => contentPanels[key] && !contentPanels[key].hidden);
  showcase?.classList.toggle('has-content', hasVisibleText);
  root.dataset.contentOpen = String(hasVisibleText);
}

function setPanelState(name, visible, { returnFocus = false } = {}) {
  const panel = contentPanels[name];
  const button = sectionButtons.find((item) => item.dataset.panel === name);

  if (!panel || !button) return;

  const wasVisible = !panel.hidden;
  panel.hidden = !visible;
  button.setAttribute('aria-pressed', String(visible));
  button.setAttribute('aria-expanded', String(visible));
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
    if (visible) {
      const offset = panelOffset(panel);
      setPanelOffset(panel, offset.x, offset.y);
    }
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

function closeAllPanels() {
  Object.keys(contentPanels).forEach((name) => setPanelState(name, false));
}

function keepSinglePanelOnMobile(preferredName = mostRecentPanelName) {
  if (!mobileQuery.matches) return;

  const visibleNames = Object.keys(contentPanels)
    .filter((name) => contentPanels[name] && !contentPanels[name].hidden);

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
  [...new Set(requestedPanels)].forEach((name) => setPanelState(name, true));
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
  onlineCountLabel.textContent = String(safeCount);
  onlineUnitLabel.textContent = visitorUnit(safeCount);
  onlineCountLabel.closest('.multitool__presence')?.setAttribute(
    'aria-label',
    `Сейчас на сайте ${safeCount}${visitorUnit(safeCount)}`
  );
}

function getPresenceSessionId() {
  if (presenceSessionId) return presenceSessionId;
  try {
    presenceSessionId = sessionStorage.getItem('barberherman-presence-id') || '';
    if (!presenceSessionId) {
      presenceSessionId = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replaceAll('-', '')
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem('barberherman-presence-id', presenceSessionId);
    }
  } catch {
    presenceSessionId = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replaceAll('-', '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  }
  return presenceSessionId;
}

async function syncPresence() {
  if (Number.isFinite(visualQAOnline)) {
    renderOnlineCount(visualQAOnline);
    return;
  }
  if (!presenceEndpoint) return;

  const sessionId = getPresenceSessionId();
  const now = Date.now();

  try {
    const sessionResponse = await fetch(`${presenceEndpoint}/${sessionId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seenAt: now }),
      cache: 'no-store',
    });
    if (!sessionResponse.ok) throw new Error(`Presence write failed: ${sessionResponse.status}`);

    const listResponse = await fetch(`${presenceEndpoint}.json`, { cache: 'no-store' });
    if (!listResponse.ok) throw new Error(`Presence read failed: ${listResponse.status}`);
    const sessions = await listResponse.json();
    const activeSince = Date.now() - 75_000;
    const activeCount = Object.values(sessions || {})
      .filter((session) => Number(session?.seenAt) >= activeSince)
      .length;
    renderOnlineCount(Math.max(1, activeCount));
  } catch {
    // Keep the last confirmed value; a realtime number must never be fabricated.
  }
}

function disconnectPresence() {
  if (!presenceEndpoint || !presenceSessionId) return;
  fetch(`${presenceEndpoint}/${presenceSessionId}.json`, {
    method: 'DELETE',
    cache: 'no-store',
    keepalive: true,
  }).catch(() => {});
}

function startPresence() {
  if (Number.isFinite(visualQAOnline)) {
    renderOnlineCount(visualQAOnline);
    return;
  }
  if (!presenceEndpoint) return;
  syncPresence();
  window.clearInterval(presenceTimer);
  presenceTimer = window.setInterval(syncPresence, 25_000);
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
    const shouldLoad = isBreakpointVideo && (Boolean(visualQAVideoPhase) || (!isReduced && !saveData));
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

  multitool.addEventListener('pointerdown', (event) => {
    const usesHandle = Boolean(event.target.closest('.multitool__drag-handle'));
    const usesFrame = event.target === multitool;
    if (mobileQuery.matches || !finePointerQuery.matches || event.button !== 0 || (!usesHandle && !usesFrame)) return;

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
    multitool.setPointerCapture(event.pointerId);
  });

  multitool.addEventListener('pointermove', (event) => {
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
      if (document.activeElement === multitoolDragHandle) multitoolDragHandle.blur();
      showMultitoolStatus('Меню перемещено · двойной клик — вернуть в центр', { duration: 2600 });
    }
  };

  multitool.addEventListener('pointerup', finishDrag);
  multitool.addEventListener('pointercancel', finishDrag);
  multitool.addEventListener('lostpointercapture', () => {
    dragState = null;
    multitool.classList.remove('is-dragging');
  });

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
loadWeather();
startPresence();
lockVideoPhaseForVisualQA();
applyVisualQAContentState();
focusVisualQASection();
syncStageVideos();
syncMultitoolDragAvailability();
syncPanelDragAvailability();
enableMultitoolDragging();

if (visualQAFocus === 'skip') {
  requestAnimationFrame(() => document.querySelector('.skip-link')?.focus());
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
    if (willShow && mobileQuery.matches) closeAllPanels();
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

  const recentPanel = mostRecentPanelName ? contentPanels[mostRecentPanelName] : null;
  const fallbackPanel = Object.entries(contentPanels).filter(([, panel]) => panel && !panel.hidden).at(-1);
  const name = recentPanel && !recentPanel.hidden ? mostRecentPanelName : fallbackPanel?.[0];

  if (name) {
    setPanelState(name, false, { returnFocus: true });
    event.preventDefault();
  }
});

mobileQuery.addEventListener('change', () => {
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
