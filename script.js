const root = document.documentElement;
const themeToggle = document.querySelector('.theme-toggle');
const motionToggle = document.querySelector('.motion-toggle');
const transparencyToggle = document.querySelector('.transparency-toggle');
const logoViewButtons = [...document.querySelectorAll('button[data-logo-view]')];
const logoViewToggle = document.querySelector('.logo-view-toggle');
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
const transparencyStorageKey = 'barberherman-reduce-transparency';
const logoViewStorageKey = 'barberherman-logo-view';
const queryParams = new URLSearchParams(window.location.search);
const visualQASection = queryParams.get('qa-section');
const visualQAVideoPhase = queryParams.get('hero-phase');
const visualQATextScale = queryParams.get('qa-text');
const visualQAContrast = queryParams.get('qa-contrast');
const visualQAPanels = queryParams.get('qa-panels');
const visualQATheme = queryParams.get('qa-theme');
const visualQATransparency = queryParams.get('qa-transparency');
const visualQALogoView = queryParams.get('qa-logo-view');
const visualQATickerPhase = queryParams.get('ticker-phase');
const visualQAFocus = queryParams.get('qa-focus');
const visualQASafeArea = queryParams.get('qa-safe-area');

let hasSavedTheme = false;
let hasSavedReducedMotion = false;
let reduceTransparencyPreference = true;
let visualQATransparencyOverride = visualQATransparency === 'reduce'
  ? true
  : visualQATransparency === 'full'
    ? false
    : null;
let pointerFrame = 0;
let latestPointerEvent = null;
let latestGlassSurface = null;
let panelLayer = 6;
let mostRecentPanelName = null;
let multitoolStatusTimer = 0;

if (['125', '150', '200'].includes(visualQATextScale)) root.dataset.qaText = visualQATextScale;
if (visualQAContrast === 'more') root.dataset.qaContrast = 'more';
if (visualQASafeArea === 'iphone') root.dataset.qaSafeArea = 'iphone';
if (['start', 'middle', 'seam'].includes(visualQATickerPhase)) {
  root.dataset.tickerPhase = visualQATickerPhase;
}

try {
  hasSavedTheme = ['light', 'dark'].includes(localStorage.getItem(themeStorageKey));
  hasSavedReducedMotion = localStorage.getItem(motionStorageKey) === 'true';
  const savedTransparency = localStorage.getItem(transparencyStorageKey);
  reduceTransparencyPreference = savedTransparency === 'true' || savedTransparency === 'false'
    ? savedTransparency === 'true'
    : true;
} catch {
  hasSavedTheme = false;
  hasSavedReducedMotion = false;
  reduceTransparencyPreference = true;
}

function showMultitoolStatus(message, { duration = 2200 } = {}) {
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
  themeToggle?.setAttribute('aria-label', 'Тёмная тема');

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

function syncContentPresence() {
  const hasVisibleText = ['profile', 'practice'].some((key) => contentPanels[key] && !contentPanels[key].hidden);
  showcase?.classList.toggle('has-content', hasVisibleText);
  root.dataset.contentOpen = String(hasVisibleText);
}

function syncContextControls() {
  if (!logoViewToggle) return;

  const hasVisibleCatalog = ['media', 'partners'].some((key) => contentPanels[key] && !contentPanels[key].hidden);
  logoViewToggle.hidden = !hasVisibleCatalog;
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
      if (scrollSurface) scrollSurface.scrollTop = 0;
    }
    if (panel.classList.contains('text-block')) bringPanelForward(panel);
  }
  syncContentPresence();
  syncContextControls();
  requestAnimationFrame(clampCurrentMultitoolPosition);

  if (!visible && returnFocus) button.focus({ preventScroll: true });
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
  showMultitoolStatus(`Открыт раздел «${label}»`);

  requestAnimationFrame(() => {
    const isInlinePanel = Boolean(panel.closest('.multitool__drawer'));
    if ((mobileQuery.matches || isInlinePanel) && panel.matches('[tabindex]')) {
      panel.focus({ preventScroll: true });
    }

    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';

    if (isInlinePanel && multitoolDrawer) {
      multitoolDrawer.scrollTo({ top: panel.offsetTop, behavior });
      if (mobileQuery.matches) document.querySelector('.multitool')?.scrollIntoView({ block: 'start', behavior });
    } else if (mobileQuery.matches) {
      panel.scrollIntoView({ block: 'start', behavior });
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
  return reduceMotionQuery.matches || hasSavedReducedMotion;
}

function prefersReducedTransparency() {
  if (visualQATransparencyOverride !== null) return visualQATransparencyOverride;
  return reduceTransparencyQuery.matches || reduceTransparencyPreference;
}

function applyTransparencyPreference({ persist = false } = {}) {
  const isReduced = prefersReducedTransparency();
  const isSystemReduced = reduceTransparencyQuery.matches && visualQATransparencyOverride === null;
  const title = isSystemReduced
    ? 'Прозрачность уменьшена в настройках системы'
    : isReduced
      ? 'Включить стекло'
      : 'Уменьшить прозрачность';

  root.dataset.reduceTransparency = String(isReduced);
  root.dataset.systemReducedTransparency = String(isSystemReduced);
  transparencyToggle?.setAttribute('aria-pressed', String(isReduced));
  transparencyToggle?.setAttribute('aria-label', 'Уменьшенная прозрачность');
  transparencyToggle?.setAttribute('aria-disabled', String(isSystemReduced));

  if (transparencyToggle) transparencyToggle.title = title;

  if (!persist) return;

  try {
    localStorage.setItem(transparencyStorageKey, String(reduceTransparencyPreference));
  } catch {
    // The selected preference still applies when storage is unavailable.
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
    delete video.dataset.visualPhasePending;
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;

    video.pause();
    video.currentTime = Math.min(video.duration - .05, video.duration * phases[visualQAVideoPhase]);
  };

  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    lockPhase();
  } else if (video.dataset.visualPhasePending !== visualQAVideoPhase) {
    video.dataset.visualPhasePending = visualQAVideoPhase;
    video.addEventListener('loadedmetadata', lockPhase, { once: true });
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
  motionToggle?.setAttribute('aria-label', 'Уменьшенное движение');
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
    if (target.closest('.multitool__drawer') && multitoolDrawer) {
      multitoolDrawer.scrollTop = target.offsetTop;
      if (mobileQuery.matches) document.querySelector('.multitool')?.scrollIntoView({ block: 'start' });
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

function setPanelOffset(panel, x, y) {
  panel.dataset.dragX = String(Math.round(x));
  panel.dataset.dragY = String(Math.round(y));
  panel.style.setProperty('--drag-x', `${Math.round(x)}px`);
  panel.style.setProperty('--drag-y', `${Math.round(y)}px`);
}

function bringPanelForward(panel) {
  panelLayer += 1;
  panel.style.zIndex = String(panelLayer);
}

function resetPanelPosition(panel) {
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

  const margin = 8;
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
  const minX = margin - baseLeft;
  const maxX = window.innerWidth - margin - baseLeft - rect.width;
  const minY = margin - baseTop;
  const maxY = window.innerHeight - margin - baseTop - rect.height;
  const clampAxis = (value, min, max) => (min > max ? 0 : Math.min(max, Math.max(min, value)));

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

  multitool.dataset.dragX = '0';
  multitool.dataset.dragY = '0';
  multitool.style.setProperty('--multitool-drag-x', '0px');
  multitool.style.setProperty('--multitool-drag-y', '0px');
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
lockVideoPhaseForVisualQA();
applyVisualQAContentState();
syncContextControls();
focusVisualQASection();
syncStageVideos();
syncMultitoolDragAvailability();
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

transparencyToggle?.addEventListener('click', () => {
  if (visualQATransparencyOverride !== null) {
    visualQATransparencyOverride = !visualQATransparencyOverride;
    reduceTransparencyPreference = visualQATransparencyOverride;
    applyTransparencyPreference({ persist: true });
    showMultitoolStatus(visualQATransparencyOverride ? 'Спокойный материал включён' : 'Стекло включено');
    return;
  }

  if (reduceTransparencyQuery.matches) {
    showMultitoolStatus('Прозрачность уменьшена в настройках системы');
    return;
  }

  reduceTransparencyPreference = !reduceTransparencyPreference;
  applyTransparencyPreference({ persist: true });
  showMultitoolStatus(reduceTransparencyPreference ? 'Спокойный материал включён' : 'Стекло включено');
});

logoViewButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyLogoView(button.dataset.logoView, { persist: true });
    const labels = {
      list: 'Логотипы показаны списком',
      grid: 'Логотипы показаны сеткой',
      poster: 'Логотипы показаны крупными карточками',
    };
    showMultitoolStatus(labels[button.dataset.logoView]);
  });
});

sectionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const name = button.dataset.panel;
    const willShow = button.getAttribute('aria-pressed') !== 'true';
    if (willShow && mobileQuery.matches) closeAllPanels();
    setPanelState(name, willShow);
    if (willShow) revealPanel(name);
  });
});

panelCloseButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setPanelState(button.dataset.closePanel, false, { returnFocus: true });
  });
});

draggablePanels.forEach(enablePanelDragging);

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
document.addEventListener('visibilitychange', syncStageVideos);
dataConnection?.addEventListener?.('change', syncStageVideos);
finePointerQuery.addEventListener('change', syncMultitoolDragAvailability);
window.addEventListener('resize', () => requestAnimationFrame(clampCurrentMultitoolPosition));
glassSurfaces.forEach((surface) => surface.addEventListener('pointermove', updateGlassHighlight, { passive: true }));
