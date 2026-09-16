// OpenCV.js document-edge detection: gray -> blur -> Canny -> dilate ->
// findContours -> approxPolyDP, looking for the largest convex quadrilateral.
// Runs once per animation frame on a small downscaled canvas for speed.

import { video, overlay, stageLive, statusPill, hintText, shutterBtn } from './dom.js';
import { state } from './state.js';

// Detection parameters, overridable via URL for quick tuning during
// development, e.g. ?minArea=0.1&cannyLow=40&cannyHigh=120&debug=1
const urlParams = new URLSearchParams(location.search);
function numParam(name, fallback) {
  const v = parseFloat(urlParams.get(name));
  return Number.isFinite(v) ? v : fallback;
}
function oddIntParam(name, fallback) {
  const v = Math.round(parseFloat(urlParams.get(name)));
  if (!Number.isFinite(v) || v < 1) return fallback;
  return v % 2 === 0 ? v + 1 : v; // GaussianBlur kernel size must be odd
}
function boolParam(name, fallback) {
  if (!urlParams.has(name)) return fallback;
  return urlParams.get(name) !== '0' && urlParams.get(name) !== 'false';
}

// Set by buildDebugPanel() below (only reachable when ?debug=1); stays null otherwise.
let lastAutoCannyReadoutEl = null;
export const DET_PARAMS = {
  minAreaRatio: numParam('minArea', 0.10),
  // Only used as a fallback / manual override — see autoCanny below.
  cannyLow: numParam('cannyLow', 50),
  cannyHigh: numParam('cannyHigh', 150),
  // Auto-computes Canny thresholds from each frame's median brightness (see
  // estimateMedian/autoCannyThresholds) so detection adapts to lighting instead of
  // relying on one fixed pair of numbers. Passing an explicit ?cannyLow=/?cannyHigh=
  // implies you want to force fixed values, so it turns this off automatically.
  autoCanny: boolParam('autoCanny', !(urlParams.has('cannyLow') || urlParams.has('cannyHigh'))),
  blur: oddIntParam('blur', 5),
  approxEpsilon: numParam('epsilon', 0.02),
  // Temporal stability: how many consecutive similar-enough detections are needed
  // before trusting a quad as "locked", and how many consecutive missed frames
  // (brief occlusion, motion blur) are tolerated before dropping an existing lock.
  stableFrames: Math.max(1, Math.round(numParam('stableFrames', 4))),
  missGrace: Math.max(0, Math.round(numParam('missGrace', 6))),
  // CLAHE (local contrast enhancement) before blur+Canny — helps a lot in dim rooms
  // where the raw image is technically fine but low-contrast. On by default; ?clahe=0
  // disables it for comparison.
  clahe: boolParam('clahe', true),
};
if (urlParams.has('debug')) buildDebugPanel();

function buildDebugPanel() {
  const panel = document.createElement('div');
  panel.id = 'debug-panel';
  panel.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:rgba(0,0,0,.85);' +
    'color:#fff;font:11px monospace;padding:8px 10px;z-index:30;max-height:40vh;overflow:auto;';

  const autoCannyRow = document.createElement('label');
  autoCannyRow.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:4px;';
  const autoCannyCheckbox = document.createElement('input');
  autoCannyCheckbox.type = 'checkbox';
  autoCannyCheckbox.checked = DET_PARAMS.autoCanny;
  const autoCannyLabel = document.createElement('span');
  const autoCannyReadout = document.createElement('span');
  autoCannyReadout.style.cssText = 'margin-left:auto;color:#8f8;';
  const refreshAutoCannyLabel = () => {
    autoCannyLabel.textContent = 'autoCanny (mediana del frame)';
  };
  refreshAutoCannyLabel();
  autoCannyCheckbox.addEventListener('change', () => {
    DET_PARAMS.autoCanny = autoCannyCheckbox.checked;
    cannyLowInput.disabled = DET_PARAMS.autoCanny;
    cannyHighInput.disabled = DET_PARAMS.autoCanny;
  });
  autoCannyRow.appendChild(autoCannyCheckbox);
  autoCannyRow.appendChild(autoCannyLabel);
  autoCannyRow.appendChild(autoCannyReadout);
  panel.appendChild(autoCannyRow);
  // Refreshed from detectQuad() each frame autoCanny actually ran, so you can see
  // what thresholds it's choosing without opening devtools.
  lastAutoCannyReadoutEl = autoCannyReadout;

  const claheRow = document.createElement('label');
  claheRow.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:4px;';
  const claheCheckbox = document.createElement('input');
  claheCheckbox.type = 'checkbox';
  claheCheckbox.checked = DET_PARAMS.clahe;
  const claheLabel = document.createElement('span');
  claheLabel.textContent = 'clahe (realce de contraste local)';
  claheCheckbox.addEventListener('change', () => { DET_PARAMS.clahe = claheCheckbox.checked; });
  claheRow.appendChild(claheCheckbox);
  claheRow.appendChild(claheLabel);
  panel.appendChild(claheRow);

  const fields = [
    ['minAreaRatio', 0.02, 0.5, 0.01],
    ['cannyLow', 0, 255, 1],
    ['cannyHigh', 0, 255, 1],
    ['blur', 1, 15, 2],
    ['approxEpsilon', 0.005, 0.08, 0.005],
    ['stableFrames', 1, 10, 1],
    ['missGrace', 0, 20, 1],
  ];
  let cannyLowInput, cannyHighInput;
  fields.forEach(([key, min, max, step]) => {
    const row = document.createElement('label');
    row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:4px;';
    const val = document.createElement('span');
    val.textContent = key + ': ' + DET_PARAMS[key];
    val.style.cssText = 'width:170px;flex:none;';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min; input.max = max; input.step = step;
    input.value = DET_PARAMS[key];
    input.style.flex = '1';
    if (key === 'cannyLow') { cannyLowInput = input; input.disabled = DET_PARAMS.autoCanny; }
    if (key === 'cannyHigh') { cannyHighInput = input; input.disabled = DET_PARAMS.autoCanny; }
    input.addEventListener('input', () => {
      DET_PARAMS[key] = parseFloat(input.value);
      val.textContent = key + ': ' + DET_PARAMS[key];
    });
    row.appendChild(val); row.appendChild(input);
    panel.appendChild(row);
  });
  document.body.appendChild(panel);
}

// Detection runs on a downscaled canvas for speed.
const DET_W = 360;
export const detCanvas = document.createElement('canvas');
const detCtx = detCanvas.getContext('2d', { willReadFrequently: true });

export function resizeDetectionCanvas(stageAspect) {
  detCanvas.width = DET_W;
  detCanvas.height = Math.round(DET_W / stageAspect);
}

export function runDetectionLoop() {
  if (state.detectLoopHandle) cancelAnimationFrame(state.detectLoopHandle);
  const step = () => {
    if (video.readyState >= 2 && video._crop) {
      detectQuad();
    }
    state.detectLoopHandle = requestAnimationFrame(step);
  };
  state.detectLoopHandle = requestAnimationFrame(step);
}

// Classic "auto Canny": estimate the frame's median brightness from a strided sample
// of the blurred grayscale Mat (cheap — no histogram needed) and derive thresholds
// from it (Adrian Rosebrock's sigma=0.33 heuristic), so edge detection adapts to
// lighting instead of relying on one fixed pair of numbers tuned for one scene.
function estimateMedian(grayMat) {
  const data = grayMat.data; // Uint8Array, CV_8UC1
  const stride = 8;
  const samples = [];
  for (let i = 0; i < data.length; i += stride) samples.push(data[i]);
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

function autoCannyThresholds(grayMat) {
  const median = estimateMedian(grayMat);
  const sigma = 0.33;
  return {
    low: Math.max(0, (1 - sigma) * median),
    high: Math.min(255, (1 + sigma) * median),
  };
}

// A real document, even viewed at a noticeable angle, doesn't produce interior
// corner angles anywhere near 0° or 180° — only a degenerate/sliver-shaped
// contour does. Generous on purpose (not "close to 90°") so a page held at a
// steep angle is never rejected just for looking skewed in 2D projection; this
// is only meant to catch clearly-not-rectangular junk.
const MIN_CORNER_ANGLE_DEG = 30;
const MAX_CORNER_ANGLE_DEG = 150;

function angleAtVertex(prev, curr, next) {
  const v1x = prev.x - curr.x, v1y = prev.y - curr.y;
  const v2x = next.x - curr.x, v2y = next.y - curr.y;
  const mag1 = Math.hypot(v1x, v1y), mag2 = Math.hypot(v2x, v2y);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (mag1 * mag2)));
  return Math.acos(cos) * 180 / Math.PI;
}

function isReasonableQuad(pts) {
  for (let i = 0; i < 4; i++) {
    const angle = angleAtVertex(pts[(i + 3) % 4], pts[i], pts[(i + 1) % 4]);
    if (angle < MIN_CORNER_ANGLE_DEG || angle > MAX_CORNER_ANGLE_DEG) return false;
  }
  return true;
}

// Runs edge-detect -> dilate -> findContours -> approxPolyDP for one Canny
// threshold pair and returns the best matching quad's 4 points (contour order,
// not yet tl/tr/br/bl-sorted), or null if none found. Manages its own Mats
// entirely and deletes all of them before returning either way, so callers can
// call this more than once per frame (e.g. a retry with different thresholds)
// without having to track Mat lifetimes across calls.
function findBestQuadPoints(blurred, cannyLow, cannyHigh) {
  let edges, dilated, kernel, contours, hierarchy;
  try {
    edges = new cv.Mat();
    cv.Canny(blurred, edges, cannyLow, cannyHigh);
    dilated = new cv.Mat();
    kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    cv.dilate(edges, dilated, kernel);

    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const imgArea = detCanvas.width * detCanvas.height;
    let bestArea = 0;
    let best = null;

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area > imgArea * DET_PARAMS.minAreaRatio && area > bestArea) {
        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, DET_PARAMS.approxEpsilon * peri, true);
        if (approx.rows === 4 && cv.isContourConvex(approx)) {
          const pts = [];
          for (let j = 0; j < 4; j++) {
            pts.push({ x: approx.intPtr(j, 0)[0], y: approx.intPtr(j, 0)[1] });
          }
          if (isReasonableQuad(pts)) {
            bestArea = area;
            best = pts;
          }
        }
        approx.delete();
      }
      cnt.delete();
    }
    return best;
  } finally {
    [edges, dilated, kernel, contours, hierarchy].forEach(m => m && m.delete && m.delete());
  }
}

// Below this raw (pre-CLAHE) median, the scene itself is dim enough that the user
// gets a "poca luz" hint instead of the generic "apunta a un documento" one — CLAHE
// and auto-Canny can stretch contrast, but neither adds light that was never
// captured, so a very dark frame still deserves an honest, actionable message.
const LOW_LIGHT_MEDIAN_THRESHOLD = 60;

function updateLowLightHint(rawMedian) {
  if (state.lastQuad) return; // don't override "mantén el encuadre" while locked
  hintText.textContent = rawMedian < LOW_LIGHT_MEDIAN_THRESHOLD
    ? 'Poca luz — busca una zona con más luz ambiente.'
    : 'Apunta a un documento sobre una superficie con contraste.';
}

// CLAHE (contrast-limited adaptive histogram equalization) boosts local contrast
// tile-by-tile instead of stretching the whole frame's histogram at once — the
// classic fix for "the document is there but too low-contrast to see" in dim
// rooms, without blowing out noise the way a flat global equalizeHist would in
// the same conditions. cv.CLAHE is a real constructor in OpenCV.js (confirmed
// against the actual WASM build, not just the Python API docs).
function applyClahe(gray, dst) {
  const clahe = new cv.CLAHE(3.0, new cv.Size(8, 8));
  try {
    clahe.apply(gray, dst);
  } finally {
    clahe.delete();
  }
}

// Draw current cropped video frame into a small canvas, then run the
// edge-detect + contour pipeline to find the best 4-point candidate.
function detectQuad() {
  const c = video._crop;
  detCtx.drawImage(video, c.sx, c.sy, c.sw, c.sh, 0, 0, detCanvas.width, detCanvas.height);

  let src, gray, enhanced, blurred;
  try {
    src = cv.imread(detCanvas);
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    updateLowLightHint(estimateMedian(gray));

    enhanced = gray;
    if (DET_PARAMS.clahe) {
      enhanced = new cv.Mat();
      applyClahe(gray, enhanced);
    }
    blurred = new cv.Mat();
    cv.GaussianBlur(enhanced, blurred, new cv.Size(DET_PARAMS.blur, DET_PARAMS.blur), 0);

    let cannyLow = DET_PARAMS.cannyLow, cannyHigh = DET_PARAMS.cannyHigh;
    if (DET_PARAMS.autoCanny) {
      const auto = autoCannyThresholds(blurred);
      cannyLow = auto.low;
      cannyHigh = auto.high;
      if (lastAutoCannyReadoutEl) lastAutoCannyReadoutEl.textContent = `low=${auto.low.toFixed(0)} high=${auto.high.toFixed(0)}`;
    }

    let pts = findBestQuadPoints(blurred, cannyLow, cannyHigh);
    if (!pts && DET_PARAMS.autoCanny) {
      // The primary estimate found no clean quad at all — retry once with a wider,
      // more permissive band before giving up on this frame. One extra Canny +
      // contours pass is cheap, and this meaningfully helps marginal-contrast
      // scenes where the median-based estimate was too strict to close the
      // document's contour into a single 4-point shape. Skipped when Canny is
      // pinned to explicit fixed values — that's a deliberate override, not
      // something to second-guess with a different pair.
      pts = findBestQuadPoints(blurred, cannyLow * 0.5, Math.min(255, cannyHigh * 1.2));
    }

    const rawQuad = pts ? orderPoints(pts) : null;
    // Exposed even when not yet (or no longer) confirmed stable, so the manual-adjust
    // stage can seed itself from the best available guess instead of a blank rectangle.
    state.rawQuad = rawQuad;
    handleDetectionResult(rawQuad, Math.hypot(detCanvas.width, detCanvas.height));
  } catch (e) {
    // Skip a frame silently if OpenCV throws (e.g. transient buffer state).
  } finally {
    // `enhanced` is only a distinct Mat (needing its own delete) when CLAHE ran —
    // otherwise it's just an alias for `gray`, already covered below.
    if (enhanced && enhanced !== gray) enhanced.delete();
    [src, gray, blurred].forEach(m => m && m.delete && m.delete());
  }

  drawOverlay();
}

const MATCH_TOLERANCE_RATIO = 0.06;
const SMOOTHING_ALPHA = 0.35;

let candidateQuad = null;
let candidateStreak = 0;
let missStreak = 0;

function quadDistance(a, b) {
  let total = 0;
  for (let i = 0; i < 4; i++) total += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return total / 4;
}

function quadsMatch(a, b, canvasDiagonal, toleranceRatio) {
  if (!a || !b) return false;
  return quadDistance(a, b) < canvasDiagonal * toleranceRatio;
}

function smoothQuad(previous, target) {
  return previous.map((p, i) => ({
    x: p.x + (target[i].x - p.x) * SMOOTHING_ALPHA,
    y: p.y + (target[i].y - p.y) * SMOOTHING_ALPHA,
  }));
}

// Debounces raw per-frame detections into a stable state.lastQuad: a fresh detection
// needs `stableFrames` consecutive similar-enough frames before it's trusted, and an
// existing lock (or an in-progress candidate) survives up to `missGrace` consecutive
// frames with no detection at all (a hand briefly crossing the frame, motion blur,
// autofocus hunting) before it's dropped. That grace period has to apply to *both*
// phases — a single missed frame resetting the streak back to 0 while still
// accumulating confidence made the streak nearly impossible to ever reach in practice,
// since real camera footage rarely finds a clean quad on every single consecutive
// frame even when the document itself is perfectly still. That was an actual shipped
// bug (v0.5.0): auto-detection could never lock at all outside near-perfect conditions.
function handleDetectionResult(rawQuad, canvasDiagonal) {
  if (rawQuad) {
    missStreak = 0;

    if (state.lastQuad) {
      // Already locked: ease toward every new detection. A single wrong/noisy frame
      // only nudges the smoothed quad by SMOOTHING_ALPHA before the next good frame
      // pulls it back, so this doesn't need its own re-confirmation gate.
      state.lastQuad = smoothQuad(state.lastQuad, rawQuad);
      return;
    }

    if (quadsMatch(rawQuad, candidateQuad, canvasDiagonal, MATCH_TOLERANCE_RATIO)) {
      candidateStreak++;
    } else {
      candidateQuad = rawQuad;
      candidateStreak = 1;
    }
    if (candidateStreak >= DET_PARAMS.stableFrames) {
      state.lastQuad = rawQuad.map(p => ({ x: p.x, y: p.y }));
      setLocked(true);
    }
  } else {
    missStreak++;
    if (missStreak > DET_PARAMS.missGrace) {
      candidateQuad = null;
      candidateStreak = 0;
      if (state.lastQuad) {
        state.lastQuad = null;
        setLocked(false);
      }
    }
    // else: brief miss within the grace window — keep the existing lock (if any) and
    // keep accumulating toward the existing candidate on the next successful frame.
  }
}

function orderPoints(pts) {
  const sums = pts.map(p => p.x + p.y);
  const diffs = pts.map(p => p.x - p.y);
  const tl = pts[sums.indexOf(Math.min(...sums))];
  const br = pts[sums.indexOf(Math.max(...sums))];
  const tr = pts[diffs.indexOf(Math.max(...diffs))];
  const bl = pts[diffs.indexOf(Math.min(...diffs))];
  return [tl, tr, br, bl];
}

export function setLocked(locked) {
  if (locked) {
    statusPill.textContent = 'documento detectado';
    statusPill.className = 'locked';
    stageLive.classList.remove('searching');
    hintText.textContent = 'Mantén el encuadre y pulsa el disparador.';
    shutterBtn.classList.add('ready');
  } else {
    statusPill.textContent = 'buscando';
    statusPill.className = 'searching';
    stageLive.classList.add('searching');
    shutterBtn.classList.remove('ready');
    // hintText for the "not locked" case is driven every frame by updateLowLightHint()
    // instead of set here — low light can persist for a long time with no lock
    // transition happening again, so it can't just be a one-off message on this
    // transition the way the "locked" branch above is.
  }
}

function drawOverlay() {
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  if (!state.lastQuad) return;
  const sx = overlay.width / detCanvas.width;
  const sy = overlay.height / detCanvas.height;
  ctx.beginPath();
  state.lastQuad.forEach((p, i) => {
    const x = p.x * sx, y = p.y * sy;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.strokeStyle = '#3ef27a';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = 'rgba(62, 242, 122, 0.12)';
  ctx.fill();
}
