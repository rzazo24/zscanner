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

function toOdd(n) { n = Math.round(n); return n % 2 === 0 ? n + 1 : n; }

// adaptiveThreshold's blockSize is a pixel count, not a proportion of the image — a
// fixed value implicitly assumes a fixed capture resolution. 25 was tuned against the
// ~1400px-wide shots this app used to produce; at the higher resolutions introduced in
// v0.9.0 (up to ~2400px), that same 25px window covers proportionally less of the
// document, which reads as noisier/worse-looking output despite the higher pixel count.
// Scaling it to the actual warped width keeps the *physical* neighborhood size roughly
// consistent regardless of capture resolution. Odd (required by adaptiveThreshold) and
// clamped so unusually small/large crops don't push it to a degenerate value.
function adaptiveBlockSize(width) {
  return Math.min(Math.max(toOdd(width / 56), 11), 51); // 1400/56 = 25, the original tuned ratio
}

// "Mejorado": the CamScanner-style mode that flattens uneven lighting/shadows and
// stretches contrast, but — unlike 'bw' — never binarizes, so text keeps smooth
// (anti-aliased) edges instead of the jagged, speckle-prone look of adaptiveThreshold.
// Classic background-normalization recipe: estimate the page's own illumination by
// heavily blurring a dilated copy (this erases text/fine detail, keeping only the
// large-scale lighting), subtract that estimate from the original to flatten it out,
// then normalize (this is the "escalado" — a min/max contrast stretch) so the paper
// reads as clean white and ink as dark. Kernel sizes scale with image width, same
// reasoning as adaptiveBlockSize above — tuned by visual comparison against a
// synthetic image with a real shadow gradient and camera-sensor-like noise, not
// copied blind from a tutorial pinned to some other resolution.
function enhancedGray(gray, width) {
  const dilateSize = Math.max(3, toOdd(width / 200));
  const medianSize = Math.max(3, toOdd(width / 70));
  let kernel, dilated, bg, diff, inv, norm;
  try {
    kernel = cv.Mat.ones(dilateSize, dilateSize, cv.CV_8U);
    dilated = new cv.Mat();
    cv.dilate(gray, dilated, kernel);
    bg = new cv.Mat();
    cv.medianBlur(dilated, bg, medianSize);
    diff = new cv.Mat();
    cv.absdiff(gray, bg, diff);
    inv = new cv.Mat();
    cv.bitwise_not(diff, inv);
    norm = new cv.Mat();
    cv.normalize(inv, norm, 0, 255, cv.NORM_MINMAX);
    return norm;
  } finally {
    [kernel, dilated, bg, diff, inv].forEach(m => m && m.delete());
  }
}

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
    } else if (state.currentMode === 'enhanced') {
      const enhanced = enhancedGray(gray, state.lastWarpedMat.cols);
      cv.cvtColor(enhanced, out, cv.COLOR_GRAY2RGBA);
      enhanced.delete();
    } else {
      const blockSize = adaptiveBlockSize(state.lastWarpedMat.cols);
      let bw = new cv.Mat();
      cv.adaptiveThreshold(gray, bw, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, blockSize, 12);
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
