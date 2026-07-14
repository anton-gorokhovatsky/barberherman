const stage = document.getElementById('stage');
const canvas = document.getElementById('canvas');
const mobileQuery = window.matchMedia('(max-width: 600px)');
const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const root = document.documentElement;
const themeToggle = document.querySelector('.theme-toggle');
const themeColor = document.getElementById('theme-color');
const heroVideos = [...document.querySelectorAll('.hero-video')];
const ticker = document.querySelector('.copyright');
const themeStorageKey = 'barberherman-theme';
const visualQASection = new URLSearchParams(window.location.search).get('qa-section');

let hasSavedTheme = false;

try {
  hasSavedTheme = ['light', 'dark'].includes(localStorage.getItem(themeStorageKey));
} catch {
  hasSavedTheme = false;
}

function applyTheme(theme, { persist = false } = {}) {
  const isDark = theme === 'dark';
  const label = isDark ? 'Включить светлую тему' : 'Включить тёмную тему';

  root.dataset.theme = isDark ? 'dark' : 'light';
  root.style.colorScheme = isDark ? 'dark' : 'light';
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.setAttribute('aria-label', label);
  themeToggle.title = label;
  themeColor.content = isDark ? '#09090b' : '#f7f7f5';

  if (persist) {
    hasSavedTheme = true;

    try {
      localStorage.setItem(themeStorageKey, isDark ? 'dark' : 'light');
    } catch {
      // The selected theme still applies for this page when storage is unavailable.
    }
  }
}

function fitCanvas() {
  const mobile = mobileQuery.matches;
  const baseWidth = mobile ? 320 : 1060;
  const baseHeight = mobile ? 3674 : 1777;
  const scale = window.innerWidth / baseWidth;
  const sectionOffsets = mobile
    ? { media: 1980, partners: 2700, footer: 3470 }
    : { media: 1110, partners: 1430, footer: 1560 };
  const sectionOffset = sectionOffsets[visualQASection] || 0;

  canvas.style.transform = `translateY(${-sectionOffset * scale}px) scale(${scale})`;
  stage.style.height = `${(baseHeight - sectionOffset) * scale}px`;
  syncHeroVideos();
}

function syncHeroVideos() {
  const mobile = mobileQuery.matches;

  heroVideos.forEach((video) => {
    const isMobileVideo = video.classList.contains('hero-video--mobile');
    const shouldPlay = !reduceMotionQuery.matches && !document.hidden && mobile === isMobileVideo;

    if (shouldPlay) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  });
}

function lockTickerPhaseForVisualQA() {
  const requestedPhase = new URLSearchParams(window.location.search).get('ticker-phase');
  const phases = { start: 0, middle: .62, seam: .999 };

  if (!ticker || !(requestedPhase in phases)) return;

  const duration = Number.parseFloat(getComputedStyle(ticker).animationDuration);

  if (!Number.isFinite(duration) || duration <= 0) return;

  ticker.style.animationDelay = `${-duration * phases[requestedPhase]}s`;
  ticker.style.animationPlayState = 'paused';
}

fitCanvas();
applyTheme(root.dataset.theme);
lockTickerPhaseForVisualQA();

requestAnimationFrame(() => root.classList.add('theme-ready'));

themeToggle.addEventListener('click', () => {
  applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', { persist: true });
});

window.addEventListener('resize', fitCanvas, { passive: true });
mobileQuery.addEventListener?.('change', fitCanvas);
reduceMotionQuery.addEventListener?.('change', syncHeroVideos);
colorSchemeQuery.addEventListener?.('change', (event) => {
  if (!hasSavedTheme) applyTheme(event.matches ? 'dark' : 'light');
});
document.addEventListener('visibilitychange', syncHeroVideos);
