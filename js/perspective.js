// Perspective correction (getPerspectiveTransform + warpPerspective) and
// the three output render modes (color / grayscale / black & white).

import { resultCanvas, downloadBtn } from './dom.js';
import { state } from './state.js';
import { showResultStage } from './ui.js';
import { grabFullFrame, quadFromDetection } from './adjust.js';
import { saveOrShareFile } from './share.js';

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

// Percentile-based contrast stretch for a single 8-bit channel: clips the darkest
// blackPercentile% and brightest (100-whitePercentile)% of *pixel count* to pure
// black/white, then linearly stretches the rest — instead of cv.normalize's
// NORM_MINMAX, which anchors the whole range to the single darkest and single
// brightest pixel in the image. A lone sensor-noise speckle or a small bright
// reflection can already BE that one pixel, silently ruining the stretch for
// everything else; percentile clipping ignores that handful of outliers instead of
// being defined by them. Technique (and the 2%/99.5% defaults used below) adapted
// from OSS-DocumentScanner's WhitePaperTransform `contrastStretch` — same idea,
// reimplemented directly against OpenCV.js (`cv.calcHist`/`cv.LUT`, confirmed
// working via a Playwright round-trip test before writing this, not assumed from
// the C++ API alone).
function percentileStretch(channel, blackPercentile, whitePercentile) {
  const totalPixels = channel.rows * channel.cols;
  const blackCount = totalPixels * blackPercentile / 100;
  const whiteCount = totalPixels * whitePercentile / 100;
  let srcVec, mask, hist, lut, stretched;
  try {
    srcVec = new cv.MatVector();
    srcVec.push_back(channel);
    mask = new cv.Mat();
    hist = new cv.Mat();
    cv.calcHist(srcVec, [0], mask, hist, [256], [0, 256]);

    let blackIndex = 0;
    let cumulative = 0;
    for (let i = 0; i < 256; i++) {
      cumulative += hist.floatPtr(i, 0)[0];
      if (cumulative > blackCount) { blackIndex = i; break; }
    }
    let whiteIndex = 255;
    cumulative = 0;
    for (let i = 255; i >= 0; i--) {
      cumulative += hist.floatPtr(i, 0)[0];
      if (cumulative > totalPixels - whiteCount) { whiteIndex = i; break; }
    }

    lut = new cv.Mat(1, 256, cv.CV_8UC1);
    const range = whiteIndex - blackIndex;
    for (let i = 0; i < 256; i++) {
      lut.ucharPtr(0, i)[0] = i < blackIndex ? 0
        : i > whiteIndex ? 255
        : range > 0 ? Math.round((i - blackIndex) / range * 255)
        : 0;
    }
    stretched = new cv.Mat();
    cv.LUT(channel, lut, stretched);
    return stretched;
  } finally {
    [srcVec, mask, hist, lut].forEach(m => m && m.delete());
  }
}

// "Color" mode's white-balance correction: stretches each of R/G/B independently
// (never alpha) via percentileStretch, correcting the warm/yellow cast typical of
// indoor lighting — the raw capture had no color processing at all before this.
// Gentler percentiles than the grayscale "Mejorado" stretch above (1%/99% vs.
// 2%/99.5%): this runs on the actual photographed colors, not an already
// background-flattened document, so a more aggressive clip risks visibly shifting
// hues instead of just correcting a lighting cast.
function colorBalance(rgba) {
  // MatVector.get(i) returns its own independent Mat handle, not just a view that
  // dies with the vector — confirmed empirically (read + explicit .delete() on a
  // channel both still worked fine *after* deleting the vector it came from), so
  // r/g/b/a each need their own delete below alongside the vectors themselves, or
  // this leaks 4 Mats every render instead of the 0 a leak-free version would.
  let channels, r, g, b, a, stretchedR, stretchedG, stretchedB, outVec, out;
  try {
    channels = new cv.MatVector();
    cv.split(rgba, channels);
    r = channels.get(0); g = channels.get(1); b = channels.get(2); a = channels.get(3);
    stretchedR = percentileStretch(r, 1, 99);
    stretchedG = percentileStretch(g, 1, 99);
    stretchedB = percentileStretch(b, 1, 99);
    outVec = new cv.MatVector();
    outVec.push_back(stretchedR); outVec.push_back(stretchedG);
    outVec.push_back(stretchedB); outVec.push_back(a);
    out = new cv.Mat();
    cv.merge(outVec, out);
    return out;
  } finally {
    [channels, r, g, b, a, stretchedR, stretchedG, stretchedB, outVec].forEach(m => m && m.delete());
  }
}

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
// then contrast-stretch (this is the "escalado") so the paper reads as clean white
// and ink as dark — percentileStretch (2%/99.5%) rather than a plain min/max
// normalize, for the same outlier-robustness reason described on percentileStretch
// itself. Kernel sizes scale with image width, same reasoning as adaptiveBlockSize
// above — tuned by visual comparison against a synthetic image with a real shadow
// gradient and camera-sensor-like noise, not copied blind from a tutorial pinned to
// some other resolution.
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
    norm = percentileStretch(inv, 2, 99.5);
    return norm;
  } finally {
    [kernel, dilated, bg, diff, inv].forEach(m => m && m.delete());
  }
}

export function renderResult() {
  if (!state.lastWarpedMat) return;
  let out;
  if (state.currentMode === 'color') {
    out = colorBalance(state.lastWarpedMat);
  } else {
    out = new cv.Mat();
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
  resultCanvas.toBlob((blob) => {
    saveOrShareFile(blob, 'documento-escaneado.png', 'image/png');
  }, 'image/png');
});
