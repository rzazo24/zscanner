// Manual corner-adjustment stage: freezes a full-resolution frame and
// shows 4 draggable handles over it, seeded from the detected quad (or a
// centered default) before perspective.js applies the warp.

import { video, adjustCanvas, adjustOverlay, adjustMagnifier } from './dom.js';
import { state } from './state.js';
import { detCanvas } from './detection.js';
import { showAdjustStage } from './ui.js';

// ~300dpi for a full A4/letter page — the standard reasonable target for a document
// scan meant to be read or OCR'd. Capped rather than uncapped: using the camera's raw
// native resolution directly, uncapped, would mean a needlessly huge one-time
// warpPerspective + output canvas on higher-end cameras for no visible benefit.
const MAX_SHOT_WIDTH = 2400;

// Grab a full-resolution frame from the cropped (cover-mapped) video region, at the
// camera's own native resolution (up to MAX_SHOT_WIDTH) rather than a fixed size —
// on a device whose camera can't reach that anyway, this just uses what's actually
// available instead of pointlessly upscaling past the real source resolution.
export function grabFullFrame() {
  const c = video._crop;
  const fullW = Math.min(MAX_SHOT_WIDTH, Math.round(c.sw));
  const fullH = Math.round(fullW * (c.sh / c.sw));
  const shot = document.createElement('canvas');
  shot.width = fullW; shot.height = fullH;
  shot.getContext('2d').drawImage(video, c.sx, c.sy, c.sw, c.sh, 0, 0, fullW, fullH);
  return shot;
}

// Scales the live-detected quad (in small detCanvas coordinates) up to a
// full-resolution shot. Returns null if nothing is currently detected.
export function quadFromDetection(shot) {
  if (!state.lastQuad) return null;
  const scaleX = shot.width / detCanvas.width;
  const scaleY = shot.height / detCanvas.height;
  return state.lastQuad.map(p => ({ x: p.x * scaleX, y: p.y * scaleY }));
}

// Like quadFromDetection, but falls back to this frame's raw (not yet confirmed
// stable) detection when there's no locked quad — a much better starting point for
// manual adjustment than a blank centered rectangle, even when confidence hasn't
// reached the threshold needed to auto-capture. Only used to seed the adjust stage;
// the fast auto-capture path still requires the fully-confirmed state.lastQuad via
// quadFromDetection/captureDetected, so lowering this bar never affects capture
// accuracy — just what the user starts dragging from.
export function bestGuessQuad(shot) {
  const source = state.lastQuad || state.rawQuad;
  if (!source) return null;
  const scaleX = shot.width / detCanvas.width;
  const scaleY = shot.height / detCanvas.height;
  return source.map(p => ({ x: p.x * scaleX, y: p.y * scaleY }));
}

export function defaultInsetQuad(w, h, margin = 0.03) {
  return [
    { x: w * margin, y: h * margin },
    { x: w * (1 - margin), y: h * margin },
    { x: w * (1 - margin), y: h * (1 - margin) },
    { x: w * margin, y: h * (1 - margin) },
  ];
}

// Freezes `shot` on the adjust stage with 4 draggable corner handles,
// seeded from `seedQuad` (or a centered inset rectangle if none is given).
export function enterAdjustMode(shot, seedQuad, returnTo) {
  cancelAnimationFrame(state.detectLoopHandle);
  state.adjustReturnTo = returnTo;
  state.lastShotCanvas = shot;
  const w = shot.width, h = shot.height;
  state.adjustQuad = (seedQuad || defaultInsetQuad(w, h)).map(p => ({ x: p.x, y: p.y }));

  adjustCanvas.width = w; adjustCanvas.height = h;
  adjustOverlay.width = w; adjustOverlay.height = h;
  adjustCanvas.getContext('2d').drawImage(shot, 0, 0);

  showAdjustStage();
  drawAdjustOverlay();
}

// --- Draggable corner handles ---

const HANDLE_RADIUS_CSS = 16;

function overlayScale() {
  const rect = adjustOverlay.getBoundingClientRect();
  return { x: adjustOverlay.width / rect.width, y: adjustOverlay.height / rect.height, rect };
}

function drawAdjustOverlay() {
  const ctx = adjustOverlay.getContext('2d');
  ctx.clearRect(0, 0, adjustOverlay.width, adjustOverlay.height);
  if (!state.adjustQuad) return;
  const { x: scaleX } = overlayScale();

  ctx.beginPath();
  state.adjustQuad.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.strokeStyle = '#3ef27a';
  ctx.lineWidth = 3 * scaleX;
  ctx.stroke();
  ctx.fillStyle = 'rgba(62, 242, 122, 0.12)';
  ctx.fill();

  const r = HANDLE_RADIUS_CSS * scaleX;
  state.adjustQuad.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 179, 71, 0.9)';
    ctx.fill();
    ctx.lineWidth = 2 * scaleX;
    ctx.strokeStyle = '#0a0f0a';
    ctx.stroke();
  });
}

function pointerToCanvasCoords(e) {
  const { x: scaleX, y: scaleY, rect } = overlayScale();
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

function nearestCornerIndex(pt) {
  const { x: scaleX } = overlayScale();
  const threshold = HANDLE_RADIUS_CSS * 1.8 * scaleX;
  let best = -1, bestDist = Infinity;
  state.adjustQuad.forEach((p, i) => {
    const d = Math.hypot(p.x - pt.x, p.y - pt.y);
    if (d < threshold && d < bestDist) { bestDist = d; best = i; }
  });
  return best;
}

// --- Magnifier ---
//
// A finger covers the exact point it's trying to place — the single biggest
// usability problem with touch-dragging a small target. Standard fix (Instagram,
// Google Photos crop, etc.): show a zoomed loupe offset away from the touch point
// while dragging, with a crosshair marking exactly where the corner will land.

const MAGNIFIER_SIZE = 120; // CSS px, matches the canvas's own width/height attrs
const MAGNIFIER_ZOOM = 2.5;
const MAGNIFIER_OFFSET = 70; // CSS px between the touch point and the loupe's edge

function updateMagnifier(e, canvasPt) {
  const rect = adjustOverlay.getBoundingClientRect();
  const touchX = e.clientX - rect.left;
  const touchY = e.clientY - rect.top;

  // Sits above the finger by default; flips below when too close to the top of the
  // stage so the loupe itself never clips out of view.
  let top = touchY - MAGNIFIER_OFFSET - MAGNIFIER_SIZE;
  if (top < 0) top = touchY + MAGNIFIER_OFFSET;
  let left = touchX - MAGNIFIER_SIZE / 2;
  left = Math.min(Math.max(left, 0), rect.width - MAGNIFIER_SIZE);

  adjustMagnifier.style.left = left + 'px';
  adjustMagnifier.style.top = top + 'px';
  adjustMagnifier.style.display = 'block';

  // Sample a small square from the full-res image centered on the touch point, then
  // scale it up to fill the loupe. Clamped to the image bounds (corners are very
  // often near an edge, by definition) — when clamping shifts the sample window,
  // the crosshair is repositioned to match so it still marks the true point, not
  // just the loupe's center.
  const cropSize = MAGNIFIER_SIZE / MAGNIFIER_ZOOM;
  const half = cropSize / 2;
  const maxSx = Math.max(0, adjustCanvas.width - cropSize);
  const maxSy = Math.max(0, adjustCanvas.height - cropSize);
  const sx = Math.min(Math.max(canvasPt.x - half, 0), maxSx);
  const sy = Math.min(Math.max(canvasPt.y - half, 0), maxSy);

  const mctx = adjustMagnifier.getContext('2d');
  mctx.clearRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);
  mctx.drawImage(adjustCanvas, sx, sy, cropSize, cropSize, 0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);

  const crossX = ((canvasPt.x - sx) / cropSize) * MAGNIFIER_SIZE;
  const crossY = ((canvasPt.y - sy) / cropSize) * MAGNIFIER_SIZE;
  mctx.strokeStyle = '#3ef27a';
  mctx.lineWidth = 1.5;
  mctx.beginPath();
  mctx.moveTo(crossX - 8, crossY); mctx.lineTo(crossX + 8, crossY);
  mctx.moveTo(crossX, crossY - 8); mctx.lineTo(crossX, crossY + 8);
  mctx.stroke();
}

function hideMagnifier() {
  adjustMagnifier.style.display = 'none';
}

adjustOverlay.addEventListener('pointerdown', (e) => {
  if (!state.adjustQuad) return;
  const pt = pointerToCanvasCoords(e);
  const idx = nearestCornerIndex(pt);
  if (idx === -1) return;
  state.draggingCorner = idx;
  adjustOverlay.setPointerCapture(e.pointerId);
  updateMagnifier(e, pt);
  e.preventDefault();
});

adjustOverlay.addEventListener('pointermove', (e) => {
  if (state.draggingCorner === -1) return;
  const pt = pointerToCanvasCoords(e);
  state.adjustQuad[state.draggingCorner] = {
    x: Math.min(Math.max(pt.x, 0), adjustOverlay.width),
    y: Math.min(Math.max(pt.y, 0), adjustOverlay.height),
  };
  drawAdjustOverlay();
  updateMagnifier(e, pt);
  e.preventDefault();
});

function endDrag(e) {
  if (state.draggingCorner === -1) return;
  state.draggingCorner = -1;
  hideMagnifier();
  try { adjustOverlay.releasePointerCapture(e.pointerId); } catch (_) { /* already released */ }
}
adjustOverlay.addEventListener('pointerup', endDrag);
adjustOverlay.addEventListener('pointercancel', endDrag);
