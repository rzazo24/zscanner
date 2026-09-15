// Perspective correction (getPerspectiveTransform + warpPerspective) and
// the three output render modes (color / grayscale / black & white).

import { resultCanvas, downloadBtn } from './dom.js';
import { state } from './state.js';
import { showResultStage } from './ui.js';
import { grabFullFrame, quadFromDetection } from './adjust.js';

// Fast path: a quad is already locked in, so warp straight to the result
// without the extra confirmation tap.
export function captureDetected() {
  const shot = grabFullFrame();
  finalizeWarp(shot, quadFromDetection(shot));
}

export function finalizeWarp(shot, quad) {
  cancelAnimationFrame(state.detectLoopHandle);
  state.lastShotCanvas = shot;
  state.adjustQuad = quad;

  const widthTop = dist(quad[0], quad[1]);
  const widthBottom = dist(quad[3], quad[2]);
  const heightLeft = dist(quad[0], quad[3]);
  const heightRight = dist(quad[1], quad[2]);
  const outW = Math.round(Math.max(widthTop, widthBottom));
  const outH = Math.round(Math.max(heightLeft, heightRight));

  const srcMat = cv.imread(shot);
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    quad[0].x, quad[0].y,
    quad[1].x, quad[1].y,
    quad[2].x, quad[2].y,
    quad[3].x, quad[3].y,
  ]);
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0, outW, 0, outW, outH, 0, outH
  ]);
  const M = cv.getPerspectiveTransform(srcTri, dstTri);
  const warped = new cv.Mat();
  cv.warpPerspective(srcMat, warped, M, new cv.Size(outW, outH));

  if (state.lastWarpedMat) state.lastWarpedMat.delete();
  state.lastWarpedMat = warped;

  srcMat.delete(); srcTri.delete(); dstTri.delete(); M.delete();

  renderResult();
  showResultStage();
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

export function renderResult() {
  if (!state.lastWarpedMat) return;
  let out = new cv.Mat();
  if (state.currentMode === 'color') {
    state.lastWarpedMat.copyTo(out);
  } else {
    let gray = new cv.Mat();
    cv.cvtColor(state.lastWarpedMat, gray, cv.COLOR_RGBA2GRAY);
    if (state.currentMode === 'gray') {
      cv.cvtColor(gray, out, cv.COLOR_GRAY2RGBA);
    } else {
      let bw = new cv.Mat();
      cv.adaptiveThreshold(gray, bw, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 25, 12);
      cv.cvtColor(bw, out, cv.COLOR_GRAY2RGBA);
      bw.delete();
    }
    gray.delete();
  }
  cv.imshow(resultCanvas, out);
  out.delete();
}

document.querySelectorAll('.mode-toggle button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-toggle button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentMode = btn.dataset.mode;
    renderResult();
  });
});

downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'documento-escaneado.png';
  link.href = resultCanvas.toDataURL('image/png');
  link.click();
});
