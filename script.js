const root = document.documentElement;
const themeToggle = document.querySelector('.theme-toggle');
const motionToggle = document.querySelector('.motion-toggle');
const logoViewButtons = [...document.querySelectorAll('[data-logo-view]')];
const logoViewToggle = document.querySelector('.logo-view-toggle');
const themeColor = document.getElementById('theme-color');
const multitool = document.querySelector('.multitool');
const multitoolMenuToggle = document.querySelector('.multitool__menu-toggle');
const multitoolMenuLabel = document.querySelector('.multitool__menu-label');
const multitoolDrawer = document.getElementById('multitool-drawer');
const sectionButtons = [...document.querySelectorAll('[data-panel]')];
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
const finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
const themeStorageKey = 'barberherman-theme';
const motionStorageKey = 'barberherman-reduce-motion';
const logoViewStorageKey = 'barberherman-logo-view';
const queryParams = new URLSearchParams(window.location.search);
const visualQASection = queryParams.get('qa-section');
const visualQAVideoPhase = queryParams.get('hero-phase');
const visualQATextScale = queryParams.get('qa-text');
const visualQAContrast = queryParams.get('qa-contrast');
const visualQAMenu = queryParams.get('qa-menu');
const visualQAPanels = queryParams.get('qa-panels');
const visualQATheme = queryParams.get('qa-theme');
const visualQALogoView = queryParams.get('qa-logo-view');
const visualQATickerPhase = queryParams.get('ticker-phase');

let hasSavedTheme = false;
let hasSavedReducedMotion = false;
let pointerFrame = 0;
let latestPointerEvent = null;
let latestGlassSurface = null;
let panelLayer = 6;

if (['125', '150', '200'].includes(visualQATextScale)) root.dataset.qaText = visualQATextScale;
if (visualQAContrast === 'more') root.dataset.qaContrast = 'more';
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

function applyTheme(theme, { persist = false } = {}) {
  const isDark = theme === 'dark';
  const label = isDark ? 'Включить светлую тему' : 'Включить тёмную тему';

  root.dataset.theme = isDark ? 'dark' : 'light';
  root.style.colorScheme = isDark ? 'dark' : 'light';
  themeToggle?.setAttribute('aria-pressed', String(isDark));
  themeToggle?.setAttribute('aria-label', label);

  if (themeToggle) themeToggle.title = label;
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

function setPanelState(name, visible) {
  const panel = contentPanels[name];
  const button = sectionButtons.find((item) => item.dataset.panel === name);

  if (!panel || !button) return;

  panel.hidden = !visible;
  button.setAttribute('aria-pressed', String(visible));
  syncContentPresence();
  syncContextControls();
}

function closeAllPanels() {
  Object.keys(contentPanels).forEach((name) => setPanelState(name, false));
}

function setMenuOpen(open, { resetPanels = false } = {}) {
  if (!multitool || !multitoolMenuToggle || !multitoolDrawer) return;

  multitool.classList.toggle('is-open', open);
  root.dataset.menuOpen = String(open);
  multitoolDrawer.hidden = !open;
  multitoolMenuToggle.setAttribute('aria-expanded', String(open));
  multitoolMenuToggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  if (multitoolMenuLabel) multitoolMenuLabel.textContent = open ? 'Свернуть' : 'Меню';

  if (!open && resetPanels) closeAllPanels();
}

function applyVisualQAMenuState() {
  const requestedPanels = (visualQAPanels || '')
    .split(',')
    .filter((name) => name in contentPanels);
  const sectionPanel = visualQASection in contentPanels ? visualQASection : null;

  if (visualQAMenu !== 'open' && !requestedPanels.length && !sectionPanel) return;

  setMenuOpen(visualQAMenu !== 'closed');

  if (sectionPanel) requestedPanels.push(sectionPanel);
  [...new Set(requestedPanels)].forEach((name) => setPanelState(name, true));
}

function prefersReducedMotion() {
  return reduceMotionQuery.matches || hasSavedReducedMotion;
}

function syncStageVideos() {
  const mobile = mobileQuery.matches;

  stageVideos.forEach((video) => {
    const isMobileVideo = video.classList.contains('stage-video--mobile');
    const shouldPlay = !prefersReducedMotion() && !document.hidden && mobile === isMobileVideo;

    if (visualQAVideoPhase) {
      video.pause();
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
  const phases = { start: .02, middle: .5, end: .96 };

  if (!(visualQAVideoPhase in phases)) return;

  stageVideos.forEach((video) => {
    const lockPhase = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;

      video.pause();
      video.currentTime = Math.min(video.duration - .05, video.duration * phases[visualQAVideoPhase]);
    };

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) lockPhase();
    else video.addEventListener('loadedmetadata', lockPhase, { once: true });
  });
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

  requestAnimationFrame(() => target.scrollIntoView({ block: 'center' }));
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

  handle.addEventListener('pointerdown', (event) => {
    if (mobileQuery.matches || event.button !== 0) return;

    const offset = panelOffset(panel);
    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };

    bringPanelForward(panel);
    panel.classList.add('is-dragging');
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  handle.addEventListener('pointermove', (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    setPanelOffset(
      panel,
      dragState.offsetX + event.clientX - dragState.startX,
      dragState.offsetY + event.clientY - dragState.startY,
    );
  });

  const finishDrag = (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    dragState = null;
    panel.classList.remove('is-dragging');
  };

  handle.addEventListener('pointerup', finishDrag);
  handle.addEventListener('pointercancel', finishDrag);
  handle.addEventListener('lostpointercapture', () => {
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

let initialLogoView = 'grid';

try {
  initialLogoView = localStorage.getItem(logoViewStorageKey) || 'grid';
} catch {
  initialLogoView = 'grid';
}

applyTheme(['light', 'dark'].includes(visualQATheme) ? visualQATheme : root.dataset.theme);
applyLogoView(visualQALogoView || initialLogoView);
applyMotionPreference();
lockVideoPhaseForVisualQA();
applyVisualQAMenuState();
syncContextControls();
focusVisualQASection();
syncStageVideos();

requestAnimationFrame(() => root.classList.add('theme-ready'));

themeToggle?.addEventListener('click', () => {
  applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', { persist: true });
});

motionToggle?.addEventListener('click', () => {
  if (reduceMotionQuery.matches) return;

  hasSavedReducedMotion = !hasSavedReducedMotion;
  applyMotionPreference({ persist: true });
});

logoViewButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyLogoView(button.dataset.logoView, { persist: true });
  });
});

multitoolMenuToggle?.addEventListener('click', () => {
  const willOpen = multitoolMenuToggle.getAttribute('aria-expanded') !== 'true';
  setMenuOpen(willOpen, { resetPanels: !willOpen });
});

sectionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const name = button.dataset.panel;
    const willShow = button.getAttribute('aria-pressed') !== 'true';
    setPanelState(name, willShow);
  });
});

draggablePanels.forEach(enablePanelDragging);

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || multitoolMenuToggle?.getAttribute('aria-expanded') !== 'true') return;

  setMenuOpen(false, { resetPanels: true });
  multitoolMenuToggle.focus();
});

mobileQuery.addEventListener('change', () => {
  syncStageVideos();
  if (mobileQuery.matches) draggablePanels.forEach(resetPanelPosition);
});
reduceMotionQuery.addEventListener('change', applyMotionPreference);
colorSchemeQuery.addEventListener('change', (event) => {
  if (!hasSavedTheme) applyTheme(event.matches ? 'dark' : 'light');
});
document.addEventListener('visibilitychange', syncStageVideos);
glassSurfaces.forEach((surface) => surface.addEventListener('pointermove', updateGlassHighlight, { passive: true }));
