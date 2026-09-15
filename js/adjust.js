// Manual corner-adjustment stage: freezes a full-resolution frame and
// shows 4 draggable handles over it, seeded from the detected quad (or a
// centered default) before perspective.js applies the warp.

import { video, adjustCanvas, adjustOverlay } from './dom.js';
import { state } from './state.js';
import { detCanvas } from './detection.js';
import { showAdjustStage } from './ui.js';

// Grab a full-resolution frame from the cropped (cover-mapped) video region.
export function grabFullFrame() {
  const c = video._crop;
  const fullW = 1400;
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

adjustOverlay.addEventListener('pointerdown', (e) => {
  if (!state.adjustQuad) return;
  const idx = nearestCornerIndex(pointerToCanvasCoords(e));
  if (idx === -1) return;
  state.draggingCorner = idx;
  adjustOverlay.setPointerCapture(e.pointerId);
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
  e.preventDefault();
});

function endDrag(e) {
  if (state.draggingCorner === -1) return;
  state.draggingCorner = -1;
  try { adjustOverlay.releasePointerCapture(e.pointerId); } catch (_) { /* already released */ }
}
adjustOverlay.addEventListener('pointerup', endDrag);
adjustOverlay.addEventListener('pointercancel', endDrag);
