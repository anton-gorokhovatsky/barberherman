const root = document.documentElement;
const themeToggle = document.querySelector('.theme-toggle');
const motionToggle = document.querySelector('.motion-toggle');
const themeColor = document.getElementById('theme-color');
const ctaDock = document.querySelector('.cta-dock');
const tickerBand = document.querySelector('.ticker-band');
const heroVideos = [...document.querySelectorAll('.hero-video')];
const ticker = document.querySelector('.copyright');
const mobileQuery = window.matchMedia('(max-width: 700px)');
const contentFlowQuery = window.matchMedia('(max-width: 899px)');
const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
const themeStorageKey = 'barberherman-theme';
const motionStorageKey = 'barberherman-reduce-motion';
const queryParams = new URLSearchParams(window.location.search);
const visualQASection = queryParams.get('qa-section');
const visualQAHeroPhase = queryParams.get('hero-phase');
const editorialGrid = document.querySelector('.editorial-grid');
const railColumn = document.querySelector('.rail-column');
const mainColumn = document.querySelector('.main-column');
const flowSections = {
  identity: document.querySelector('.identity-intro'),
  profile: document.querySelector('.profile-block'),
  expertise: document.querySelector('.expertise-block'),
  media: document.querySelector('.media-block'),
  mentoring: document.querySelector('.mentoring-block'),
  partners: document.querySelector('.partners-block'),
  fashion: document.querySelector('.fashion-block'),
  business: document.querySelector('.business-block'),
};

let hasSavedTheme = false;
let hasSavedReducedMotion = false;
let pointerFrame = 0;
let latestPointerEvent = null;
let ctaFrame = 0;

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
  themeColor?.setAttribute('content', isDark ? '#09090b' : '#f7f7f5');

  if (!persist) return;

  hasSavedTheme = true;

  try {
    localStorage.setItem(themeStorageKey, isDark ? 'dark' : 'light');
  } catch {
    // The selected theme still applies for this page when storage is unavailable.
  }
}

function prefersReducedMotion() {
  return reduceMotionQuery.matches || hasSavedReducedMotion;
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
  motionToggle?.setAttribute('aria-label', isSystemReduced ? title : 'Уменьшить движение');
  motionToggle?.setAttribute('aria-disabled', String(isSystemReduced));

  if (motionToggle) {
    motionToggle.title = title;
  }

  if (persist) {
    try {
      if (hasSavedReducedMotion) localStorage.setItem(motionStorageKey, 'true');
      else localStorage.removeItem(motionStorageKey);
    } catch {
      // The preference still applies for this page when storage is unavailable.
    }
  }

  syncHeroVideos();
}

function syncHeroVideos() {
  const mobile = mobileQuery.matches;

  heroVideos.forEach((video) => {
    const isMobileVideo = video.classList.contains('hero-video--mobile');
    const shouldPlay = !prefersReducedMotion() && !document.hidden && mobile === isMobileVideo;

    if (visualQAHeroPhase) {
      video.pause();
    } else if (shouldPlay) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  });
}

function lockHeroPhaseForVisualQA() {
  const phases = { start: .02, middle: .5, end: .96 };

  if (!(visualQAHeroPhase in phases)) return;

  heroVideos.forEach((video) => {
    const lockPhase = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;

      video.pause();
      video.currentTime = Math.min(video.duration - .05, video.duration * phases[visualQAHeroPhase]);
    };

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) lockPhase();
    else video.addEventListener('loadedmetadata', lockPhase, { once: true });
  });
}

function syncContentFlow() {
  if (!editorialGrid || !railColumn || !mainColumn || Object.values(flowSections).some((section) => !section)) return;

  if (contentFlowQuery.matches) {
    ['identity', 'profile', 'expertise', 'media', 'mentoring', 'partners', 'fashion', 'business']
      .forEach((key) => editorialGrid.append(flowSections[key]));
  } else {
    ['identity', 'expertise', 'media', 'partners']
      .forEach((key) => railColumn.append(flowSections[key]));
    ['profile', 'mentoring', 'fashion', 'business']
      .forEach((key) => mainColumn.append(flowSections[key]));
  }

  root.classList.add('flow-ready');
}

function syncCtaDock() {
  ctaFrame = 0;

  if (!ctaDock) return;

  const tickerTop = tickerBand?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
  const isAtFooter = tickerTop <= window.innerHeight;

  ctaDock.classList.toggle('is-at-footer', isAtFooter);
}

function queueCtaDockSync() {
  if (!ctaFrame) ctaFrame = requestAnimationFrame(syncCtaDock);
}

function lockTickerPhaseForVisualQA() {
  const requestedPhase = queryParams.get('ticker-phase');
  const phases = { start: 0, middle: 0.62, seam: 0.999 };

  if (!ticker || !(requestedPhase in phases)) return;

  const duration = Number.parseFloat(getComputedStyle(ticker).animationDuration);

  if (!Number.isFinite(duration) || duration <= 0) return;

  ticker.style.animationDelay = `${-duration * phases[requestedPhase]}s`;
  ticker.style.animationPlayState = 'paused';
}

async function focusVisualQASection() {
  const selectorBySection = {
    media: '.media-block',
    partners: '.partners-block',
    footer: '.ticker-band',
  };
  const selector = selectorBySection[visualQASection];
  const target = selector ? document.querySelector(selector) : null;

  if (!target) return;

  try {
    await document.fonts?.ready;
  } catch {
    // The QA scroll still runs when the Font Loading API is unavailable.
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' });
      setTimeout(() => target.scrollIntoView({ block: 'start' }), 160);
    });
  });
}

function paintGlassHighlight() {
  pointerFrame = 0;

  const event = latestPointerEvent;
  const target = event?.target instanceof Element ? event.target : null;
  const surface = target?.closest('.glass-control, .glass-surface, .glass-card, .cta-dock');

  if (!surface) return;

  const rect = surface.getBoundingClientRect();
  surface.style.setProperty('--glass-x', `${event.clientX - rect.left}px`);
  surface.style.setProperty('--glass-y', `${event.clientY - rect.top}px`);
}

function updateGlassHighlight(event) {
  if (!finePointerQuery.matches || prefersReducedMotion()) return;

  latestPointerEvent = event;

  if (!pointerFrame) pointerFrame = requestAnimationFrame(paintGlassHighlight);
}

applyTheme(root.dataset.theme);
applyMotionPreference();
syncContentFlow();
lockTickerPhaseForVisualQA();
syncHeroVideos();
lockHeroPhaseForVisualQA();
focusVisualQASection();
syncCtaDock();

requestAnimationFrame(() => root.classList.add('theme-ready'));

themeToggle?.addEventListener('click', () => {
  applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', { persist: true });
});

motionToggle?.addEventListener('click', () => {
  if (reduceMotionQuery.matches) return;

  hasSavedReducedMotion = !hasSavedReducedMotion;
  applyMotionPreference({ persist: true });
});

mobileQuery.addEventListener?.('change', syncHeroVideos);
contentFlowQuery.addEventListener?.('change', syncContentFlow);
reduceMotionQuery.addEventListener?.('change', applyMotionPreference);
colorSchemeQuery.addEventListener?.('change', (event) => {
  if (!hasSavedTheme) applyTheme(event.matches ? 'dark' : 'light');
});
document.addEventListener('visibilitychange', syncHeroVideos);
document.addEventListener('pointermove', updateGlassHighlight, { passive: true });
window.addEventListener('scroll', queueCtaDockSync, { passive: true });
window.addEventListener('resize', queueCtaDockSync, { passive: true });
window.addEventListener('load', focusVisualQASection, { once: true });
window.addEventListener('load', syncCtaDock, { once: true });
