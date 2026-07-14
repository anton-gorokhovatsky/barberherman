const stage = document.getElementById('stage');
const canvas = document.getElementById('canvas');
const mobileQuery = window.matchMedia('(max-width: 600px)');

function fitCanvas() {
  const mobile = mobileQuery.matches;
  const baseWidth = mobile ? 320 : 1060;
  const baseHeight = mobile ? 3813 : 1777;
  const scale = window.innerWidth / baseWidth;

  canvas.style.transform = `scale(${scale})`;
  stage.style.height = `${baseHeight * scale}px`;
}

fitCanvas();
window.addEventListener('resize', fitCanvas, { passive: true });
mobileQuery.addEventListener?.('change', fitCanvas);
