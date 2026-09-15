// Entry point: loads OpenCV.js, starts the camera, and wires up every
// button to the stage transitions (live -> adjust -> result) implemented
// across the other modules.

import {
  switchCamBtn, shutterBtn, manualBtn, retakeBtn, adjustAgainBtn,
  adjustCancelBtn, adjustConfirmBtn, video, loadingOverlay, loadingText,
  statusPill, stageLive, resultPanel,
} from './dom.js';
import { state } from './state.js';
import { showLiveStage, backToResultFromAdjust } from './ui.js';
import { runDetectionLoop, setLocked } from './detection.js';
import { openStream, sizeCanvases } from './camera.js';
import { grabFullFrame, quadFromDetection, enterAdjustMode } from './adjust.js';
import { captureDetected, finalizeWarp } from './perspective.js';

function onOpenCvReady() {
  // cv.js defines a global Module that resolves asynchronously.
  if (cv && cv['onRuntimeInitialized']) {
    cv['onRuntimeInitialized'] = startCamera;
  } else {
    startCamera();
  }
}
function onOpenCvError() {
  loadingText.textContent = 'No se pudo cargar OpenCV.js. Comprueba tu conexión y recarga.';
}

// Loaded programmatically (rather than a static <script onload>) so the
// listeners above are always registered before the script can finish —
// with a static tag, a cached opencv.js can fire `load` before the parser
// even reaches the script block that defines onOpenCvReady.
(function loadOpenCv() {
  const s = document.createElement('script');
  s.src = 'https://docs.opencv.org/4.9.0/opencv.js';
  s.onload = onOpenCvReady;
  s.onerror = onOpenCvError;
  document.head.appendChild(s);
})();

async function startCamera() {
  state.cvReady = true;
  try {
    await openStream(state.facingMode);
    loadingOverlay.classList.add('hidden');
    statusPill.textContent = 'buscando';
    statusPill.className = 'searching';
    stageLive.classList.add('searching');
    runDetectionLoop();
  } catch (err) {
    loadingText.textContent = 'No se pudo acceder a la cámara: ' + err.message;
  }
}

switchCamBtn.addEventListener('click', async () => {
  state.facingMode = state.facingMode === 'environment' ? 'user' : 'environment';
  try { await openStream(state.facingMode); } catch (e) { /* ignore */ }
});

// --- Capture, manual corner adjustment & perspective correction ---
//
// Flow: live camera -> (fast path if a quad is already locked, or the
// adjust stage otherwise) -> perspective warp -> result. The adjust stage
// is also reachable from the result panel ("Ajustar") to fix a bad crop
// without retaking the photo.

shutterBtn.addEventListener('click', () => {
  if (state.lastQuad) {
    captureDetected();
  } else {
    enterAdjustMode(grabFullFrame(), null, 'live');
  }
});

manualBtn.addEventListener('click', () => {
  const shot = grabFullFrame();
  enterAdjustMode(shot, quadFromDetection(shot), 'live');
});

adjustAgainBtn.addEventListener('click', () => {
  resultPanel.classList.remove('visible');
  enterAdjustMode(state.lastShotCanvas, state.adjustQuad, 'result');
});

adjustCancelBtn.addEventListener('click', () => {
  if (state.adjustReturnTo === 'result') {
    backToResultFromAdjust();
  } else {
    showLiveStage();
    runDetectionLoop();
  }
});

adjustConfirmBtn.addEventListener('click', () => {
  finalizeWarp(state.lastShotCanvas, state.adjustQuad);
});

retakeBtn.addEventListener('click', () => {
  showLiveStage();
  state.lastQuad = null;
  setLocked(false);
  runDetectionLoop();
});

window.addEventListener('resize', () => { if (video.videoWidth) sizeCanvases(); });
