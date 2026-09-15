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
export const DET_PARAMS = {
  minAreaRatio: numParam('minArea', 0.15),
  cannyLow: numParam('cannyLow', 50),
  cannyHigh: numParam('cannyHigh', 150),
  blur: oddIntParam('blur', 5),
  approxEpsilon: numParam('epsilon', 0.02),
};
if (urlParams.has('debug')) buildDebugPanel();

function buildDebugPanel() {
  const panel = document.createElement('div');
  panel.id = 'debug-panel';
  panel.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:rgba(0,0,0,.85);' +
    'color:#fff;font:11px monospace;padding:8px 10px;z-index:30;max-height:40vh;overflow:auto;';
  const fields = [
    ['minAreaRatio', 0.02, 0.5, 0.01],
    ['cannyLow', 0, 255, 1],
    ['cannyHigh', 0, 255, 1],
    ['blur', 1, 15, 2],
    ['approxEpsilon', 0.005, 0.08, 0.005],
  ];
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

// Draw current cropped video frame into a small canvas, then run the
// edge-detect + contour pipeline to find the best 4-point candidate.
function detectQuad() {
  const c = video._crop;
  detCtx.drawImage(video, c.sx, c.sy, c.sw, c.sh, 0, 0, detCanvas.width, detCanvas.height);

  let src, gray, blurred, edges, dilated, kernel, contours, hierarchy, best = null;
  try {
    src = cv.imread(detCanvas);
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(DET_PARAMS.blur, DET_PARAMS.blur), 0);
    edges = new cv.Mat();
    cv.Canny(blurred, edges, DET_PARAMS.cannyLow, DET_PARAMS.cannyHigh);
    dilated = new cv.Mat();
    kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    cv.dilate(edges, dilated, kernel);

    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const imgArea = detCanvas.width * detCanvas.height;
    let bestArea = 0;

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area > imgArea * DET_PARAMS.minAreaRatio && area > bestArea) {
        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, DET_PARAMS.approxEpsilon * peri, true);
        if (approx.rows === 4 && cv.isContourConvex(approx)) {
          bestArea = area;
          if (best) best.delete();
          best = approx;
        } else {
          approx.delete();
        }
      }
      cnt.delete();
    }

    if (best) {
      const pts = [];
      for (let i = 0; i < 4; i++) {
        pts.push({ x: best.intPtr(i, 0)[0], y: best.intPtr(i, 0)[1] });
      }
      state.lastQuad = orderPoints(pts);
      setLocked(true);
    } else {
      state.lastQuad = null;
      setLocked(false);
    }
  } catch (e) {
    // Skip a frame silently if OpenCV throws (e.g. transient buffer state).
  } finally {
    // `best` is deleted here (rather than right after reading its points above)
    // so it's also cleaned up if an exception is thrown before that point.
    [src, gray, blurred, edges, dilated, kernel, contours, hierarchy, best].forEach(m => m && m.delete && m.delete());
  }

  drawOverlay();
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
    hintText.textContent = 'Apunta a un documento sobre una superficie con contraste.';
    shutterBtn.classList.remove('ready');
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
  ctx.strokeStyle = '#3ddc84';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = 'rgba(61, 220, 132, 0.12)';
  ctx.fill();
}
