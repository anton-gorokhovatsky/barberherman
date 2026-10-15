import 'https://gorokhovatsky.tech/signature/1.0.2/signature.js';

// Version 1.0.2 supplies the accepted mark and motion. Its footer adapter
// exposes presentation parts without copying or changing the shared drawing.
function connectFooterSignatures() {
  for (const signature of document.querySelectorAll('ag-signature')) {
    const fallback = signature.querySelector('a[rel~="author"]');
    const shadow = signature.shadowRoot;
    const credit = shadow?.querySelector('a[rel~="author"]');
    if (!fallback || !credit) continue;
    for (const attribute of ['href', 'target', 'rel']) {
      credit.setAttribute(attribute, fallback.getAttribute(attribute) || '');
    }
    // Read as one Russian sentence in both the visual and accessible order.
    const text = shadow.querySelector('.text');
    const role = shadow.querySelector('.role');
    const name = shadow.querySelector('.name');
    if (text && role && name) text.replaceChildren(role, ' ', name);
    for (const [selector, part] of [
      ['.signature', 'layout'], ['.credit', 'link'], ['.text', 'text'],
      ['.name', 'name'], ['.role', 'role'], ['.arrow', 'inline-arrow'],
    ]) {
      shadow.querySelector(selector)?.setAttribute('part', part);
    }
    const arrowPath = document.querySelector('#icon-arrow-path');
    if (arrowPath && !shadow.querySelector('[part="footer-arrow"]')) {
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      arrow.setAttribute('part', 'footer-arrow');
      arrow.setAttribute('viewBox', '0 0 24 24');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.setAttribute('focusable', 'false');
      const path = arrowPath.cloneNode(true);
      path.removeAttribute('id');
      arrow.append(path);
      credit.append(arrow);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', connectFooterSignatures, { once: true });
} else {
  connectFooterSignatures();
}
