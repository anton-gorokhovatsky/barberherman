import { createMorph } from './vendor/morphicons-1.7.1/dom.js';

// Only the drawing changes. The existing button owns clicks, focus and labels.
export function enhanceThemeIcon(button) {
  if (!button || button.dataset.themeIcon === 'morph') return;
  const root = document.documentElement;
  const originals = ['light', 'dark'].map((theme) => button.querySelector(`.theme-toggle__icon--${theme}`));
  if (originals.some((svg) => !svg)) return;

  // Reuse the accepted contours, including the moon's star, rather than swap sets.
  const icons = originals.map((svg) => [...svg.children].map((node) => [
    node.localName,
    Object.fromEntries([...node.attributes].map(({ name, value }) => [name, value])),
  ]));
  const targetIcon = () => icons[root.dataset.theme === 'dark' ? 0 : 1];
  const reducedMotion = () => root.dataset.reduceMotion === 'true';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'theme-toggle__icon theme-toggle__icon--morph');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  svg.append(path);
  let current = targetIcon();
  const morph = createMorph(path, current, { reducedMotion: 'user' });

  const observer = new MutationObserver(() => {
    const next = targetIcon();
    morph.reducedMotion = reducedMotion() ? 'always' : 'user';
    if (reducedMotion()) morph.set(next); // Also stop an in-flight morph immediately.
    else if (next !== current) morph.morphTo(next, 'smooth'); // No spring overshoot.
    current = next;
  });
  observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-reduce-motion'] });
  button.append(svg);
  button.dataset.themeIcon = 'morph';
}
