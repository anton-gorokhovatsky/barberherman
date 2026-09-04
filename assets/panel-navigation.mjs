// Address and browser-history state only. Layout, focus and animation stay
// with the existing panel controller; this module never synthesizes clicks.
const routes = {
  profile: 'profile', expertise: 'practice', media: 'media',
  partners: 'partners', archive: 'gallery', music: 'music',
};
const aliases = { practice: 'practice', gallery: 'gallery' };
const slugs = Object.fromEntries(Object.entries(routes).map(([slug, name]) => [name, slug]));
const playlists = new Set(['vol-4', 'vol-3', 'vol-2', 'august-2026']);
const stateKey = 'barberhermanPanels';

export function parsePanelAddress(hash) {
  if (!hash || hash === '#') return { active: null, playlist: null };
  let address;
  try { address = decodeURIComponent(hash.slice(1)); } catch { return null; }
  const [rawSlug, playlist, ...extra] = address.split('/');
  if (extra.length) return null;
  const slug = rawSlug.replace(/-panel$/, '');
  const active = Object.hasOwn(routes, slug) ? routes[slug]
    : Object.hasOwn(aliases, slug) ? aliases[slug] : null;
  if (!active || (playlist && (active !== 'music' || !playlists.has(playlist)))) return null;
  return { active, playlist: playlist || null };
}

export function panelAddress({ active, playlist = null }) {
  if (!Object.hasOwn(slugs, active)) return '';
  return `#${slugs[active]}${active === 'music' && playlists.has(playlist) ? `/${playlist}` : ''}`;
}

export function createPanelNavigation({ readPanels, restore, open }) {
  let current = { panels: [], active: null, playlist: null };
  let lastHash = window.location.hash;

  function cleanState(state) {
    if (!state || !Array.isArray(state.panels)) return null;
    const panels = [...new Set(state.panels.filter((name) => Object.hasOwn(slugs, name)))];
    const active = panels.includes(state.active) ? state.active : panels.at(-1) || null;
    const playlist = active === 'music' && playlists.has(state.playlist) ? state.playlist : null;
    return { panels, active, playlist };
  }

  function record(active, { playlist, replace = false } = {}) {
    if (replace && !parsePanelAddress(window.location.hash)) return;
    const panels = readPanels();
    const next = cleanState({
      panels,
      active,
      playlist: playlist === undefined && active === current.active ? current.playlist : playlist,
    });
    const hash = panelAddress(next);
    if (!replace && JSON.stringify(next) === JSON.stringify(current) && hash === window.location.hash) return;
    current = next;
    const url = new URL(window.location.href);
    url.hash = hash;
    const state = { ...window.history.state, [stateKey]: current };
    window.history[replace ? 'replaceState' : 'pushState'](state, '', url);
    lastHash = window.location.hash;
  }

  function restoreAddress({ initial = false } = {}) {
    const route = parsePanelAddress(window.location.hash);
    lastHash = window.location.hash;
    // Unrelated anchors (skip link, privacy settings) retain their native job.
    if (!route) return;
    const saved = cleanState(window.history.state?.[stateKey]);
    const matchesAddress = saved && panelAddress(saved) === panelAddress(route);
    current = matchesAddress ? saved : {
      panels: route.active ? [route.active] : [], ...route,
    };
    if (initial && !route.active && !saved) {
      record(readPanels().at(-1), { replace: true });
      return;
    }
    restore(current, { initial });
    // Resizing a restored desktop state to mobile may leave only one panel.
    record(current.active, { playlist: current.playlist, replace: true });
  }

  window.addEventListener('popstate', () => restoreAddress());
  window.addEventListener('hashchange', () => {
    if (lastHash !== window.location.hash) restoreAddress();
  });
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
    if (!link || link.target || link.hasAttribute('download')) return;
    const route = parsePanelAddress(link.hash);
    if (!route?.active) return;
    event.preventDefault();
    open(route);
    record(route.active, { playlist: route.playlist });
  });

  restoreAddress({ initial: true });
  return { record };
}
