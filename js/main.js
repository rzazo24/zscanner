// Entry point: loads OpenCV.js, starts the camera, and wires up every
// button to the stage transitions (live -> adjust -> result) implemented
// across the other modules.

import {
  switchCamBtn, shutterBtn, manualBtn, retakeBtn, adjustAgainBtn,
  adjustCancelBtn, adjustConfirmBtn, video, loadingOverlay, loadingText,
  statusPill, stageLive, resultPanel, updateBanner, updateReloadBtn,
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

// --- PWA: install via manifest.webmanifest, offline shell via sw.js ---

if ('serviceWorker' in navigator) {
  // On a first-ever visit there's no controller yet; sw.js's own clients.claim() makes
  // that first install also fire "controllerchange" below, even though it isn't a real
  // update. Without this check, everyone's first visit would show the "new version"
  // banner for no reason.
  const hadControllerBeforeRegister = Boolean(navigator.serviceWorker.controller);

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.error('SW registration failed', err));
  });

  // sw.js calls skipWaiting()/clients.claim(), so a new version takes control of an
  // already-open tab immediately — but that tab is still running the old html/css/js
  // already loaded in memory until it reloads. "controllerchange" fires at exactly that
  // moment; instead of reloading on its own (could cut off a capture or a drag in
  // progress), it shows a banner with a button and reloads when the user chooses to.
  let updateAvailable = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updateAvailable || !hadControllerBeforeRegister) return;
    updateAvailable = true;
    updateBanner.hidden = false;
  });

  updateReloadBtn.addEventListener('click', () => window.location.reload());

  // The browser only checks sw.js for changes on its own schedule (roughly every 24h, or
  // on navigation) — for a PWA reopened from the background instead of freshly navigated
  // to, that can leave it stale much longer than intended. Re-checking whenever the tab
  // becomes visible again catches updates sooner.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      navigator.serviceWorker.getRegistration().then((reg) => reg && reg.update());
    }
  });
}
