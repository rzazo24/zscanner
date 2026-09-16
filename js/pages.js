// Multi-page scanning session: accumulate already-rendered pages in memory, show a
// thumbnail strip, and export them all as a single multi-page PDF on demand.
// Deliberately independent of the single-capture warp/render pipeline in
// perspective.js — everything here works with plain <canvas> elements, never a
// cv.Mat, since a page is already fully rendered (in whatever output mode was active)
// by the time it's added to the session.

import { pagesBar, pagesThumbs, pagesCount, resultCanvas } from './dom.js';
import { state } from './state.js';

// Snapshots whatever is currently shown in the result canvas (i.e. the current
// capture in its currently-selected output mode) into the session. Each page keeps
// the mode it had at the moment it was added — switching modes afterwards only
// affects new pages, not ones already added, so a session can't retroactively change
// pages you already reviewed and confirmed.
export function addCurrentPageToSession() {
  const canvas = document.createElement('canvas');
  canvas.width = resultCanvas.width;
  canvas.height = resultCanvas.height;
  canvas.getContext('2d').drawImage(resultCanvas, 0, 0);
  state.pages.push(canvas);
  renderPagesBar();
}

export function removePageAt(index) {
  state.pages.splice(index, 1);
  renderPagesBar();
}

export function clearPages() {
  state.pages = [];
  renderPagesBar();
}

export function renderPagesBar() {
  pagesBar.classList.toggle('hidden', state.pages.length === 0);
  pagesCount.textContent = state.pages.length === 1 ? '1 página' : `${state.pages.length} páginas`;

  pagesThumbs.innerHTML = '';
  state.pages.forEach((canvas, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'page-thumb';

    const img = document.createElement('img');
    // Low quality/size on purpose — this is only ever shown at ~34x46 CSS px, no
    // reason to keep a full-fidelity copy just for the thumbnail strip.
    img.src = canvas.toDataURL('image/jpeg', 0.6);
    img.alt = `Página ${i + 1}`;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'page-thumb-remove';
    removeBtn.textContent = '×';
    removeBtn.title = 'Quitar página';
    removeBtn.addEventListener('click', () => removePageAt(i));

    thumb.appendChild(img);
    thumb.appendChild(removeBtn);
    pagesThumbs.appendChild(thumb);
  });
}

// jsPDF is only loaded the first time it's actually needed (on-demand, not on page
// load) — most visits won't touch the multi-page/PDF feature at all, and it's a real
// third-party dependency (the only one besides OpenCV.js) that shouldn't cost anyone
// who never uses it.
let jsPdfLoadPromise = null;
function loadJsPdf() {
  if (window.jspdf?.jsPDF) return Promise.resolve();
  if (jsPdfLoadPromise) return jsPdfLoadPromise;
  jsPdfLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.2.1/jspdf.umd.min.js';
    s.onload = resolve;
    s.onerror = () => {
      jsPdfLoadPromise = null; // let a retry actually retry instead of reusing a dead promise
      reject(new Error('No se pudo cargar jsPDF'));
    };
    document.head.appendChild(s);
  });
  return jsPdfLoadPromise;
}

// Each page becomes its own PDF page sized to match that page's own pixel dimensions
// (unit: 'px') rather than forcing every page onto a fixed A4/letter size — captures
// can have different crop aspect ratios, and this avoids letterboxing or stretching
// any of them. Confirmed directly against the real jsPDF build (not assumed from
// docs) that unit:'px' + a [w, h] format produces a page matching those exact pixel
// dimensions, and that per-page addPage([w, h], orientation) works the same way for
// pages after the first.
export async function exportPagesAsPdf() {
  if (state.pages.length === 0) return;
  await loadJsPdf();
  const { jsPDF } = window.jspdf;

  const first = state.pages[0];
  const doc = new jsPDF({ unit: 'px', format: [first.width, first.height] });

  state.pages.forEach((canvas, i) => {
    if (i > 0) {
      doc.addPage([canvas.width, canvas.height], canvas.width > canvas.height ? 'landscape' : 'portrait');
    }
    // JPEG, not PNG: these are photos of paper, not graphics with sharp flat colors —
    // JPEG's lossy compression is far smaller here for barely perceptible quality
    // loss, which matters once several full-resolution pages are bundled into one file.
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, canvas.width, canvas.height);
  });

  doc.save('documento-escaneado.pdf');
}
