// Entry point: loads OpenCV.js, starts the camera, and wires up every
// button to the stage transitions (live -> adjust -> result) implemented
// across the other modules.

import {
  switchCamBtn, shutterBtn, manualBtn, galleryBtn, galleryInput,
  retakeBtn, adjustAgainBtn, addPageBtn, finishPdfBtn,
  adjustCancelBtn, adjustConfirmBtn, video, loadingOverlay, loadingText,
  cameraPriming, cameraPrimingBtn, cameraPrimingError,
  statusPill, stageLive, resultPanel, updateBanner, updateReloadBtn,
} from './dom.js';
import { state } from './state.js';
import { showLiveStage, backToResultFromAdjust } from './ui.js';
import { runDetectionLoop, setLocked } from './detection.js';
import { openStream, sizeCanvases } from './camera.js';
import { grabFullFrame, bestGuessQuad, enterAdjustMode, loadImageFile } from './adjust.js';
import { captureDetected, finalizeWarp } from './perspective.js';
import { addCurrentPageToSession, exportPagesAsPdf, clearPages } from './pages.js';

function onOpenCvReady() {
  // cv.js defines a global Module that resolves asynchronously.
  if (cv && cv['onRuntimeInitialized']) {
    cv['onRuntimeInitialized'] = showCameraPriming;
  } else {
    showCameraPriming();
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

// The native browser "allow camera access?" prompt can't be styled or explained by
// the page — it's deliberately outside web content's control, so a site can't design
// it to trick someone into granting access. This screen is shown right before
// triggering it instead, so the abrupt native dialog has some on-brand context before
// it rather than popping up in the middle of a bare loading spinner.
function showCameraPriming() {
  state.cvReady = true;
  loadingOverlay.classList.add('hidden');
  cameraPriming.classList.remove('hidden');
}

cameraPrimingBtn.addEventListener('click', startCamera);

async function startCamera() {
  cameraPrimingBtn.disabled = true;
  cameraPrimingError.hidden = true;
  try {
    await openStream(state.facingMode);
    cameraPriming.classList.add('hidden');
    statusPill.textContent = 'buscando';
    statusPill.className = 'searching';
    stageLive.classList.add('searching');
    runDetectionLoop();
  } catch (err) {
    // Most browsers won't re-show the native prompt once explicitly denied (it has to
    // be reset from the site's permission settings) — worth saying so plainly instead
    // of implying "Reintentar" will just pop the dialog again like a fresh request would.
    cameraPrimingError.textContent = err.name === 'NotAllowedError'
      ? 'Permiso denegado. Actívalo en los ajustes de cámara del navegador para este sitio y vuelve a intentarlo.'
      : 'No se pudo acceder a la cámara: ' + err.message;
    cameraPrimingError.hidden = false;
    cameraPrimingBtn.textContent = 'Reintentar';
  } finally {
    cameraPrimingBtn.disabled = false;
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
    const shot = grabFullFrame();
    enterAdjustMode(shot, bestGuessQuad(shot), 'live');
  }
});

manualBtn.addEventListener('click', () => {
  const shot = grabFullFrame();
  enterAdjustMode(shot, bestGuessQuad(shot), 'live');
});

galleryBtn.addEventListener('click', () => galleryInput.click());

galleryInput.addEventListener('change', async () => {
  const file = galleryInput.files[0];
  galleryInput.value = ''; // reset so picking the exact same file again still fires 'change'
  if (!file) return;
  try {
    const shot = await loadImageFile(file);
    // No auto-detected quad exists for a picked photo (it never went through the
    // live detection loop), so this always lands in manual-adjust, not the
    // auto-capture fast path.
    enterAdjustMode(shot, null, 'live');
  } catch (e) {
    // Corrupt/unsupported file — rare enough to just stay on the live view silently
    // rather than needing a dedicated error-toast mechanism for this one case.
  }
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

// Shared by "Repetir" (discard this capture) and "+ Página" (keep it, then go
// capture the next one) — both end up back at a fresh live view the same way.
function resumeLiveScanning() {
  showLiveStage();
  state.lastQuad = null;
  setLocked(false);
  runDetectionLoop();
}

retakeBtn.addEventListener('click', resumeLiveScanning);

addPageBtn.addEventListener('click', () => {
  addCurrentPageToSession();
  resumeLiveScanning();
});

finishPdfBtn.addEventListener('click', async () => {
  finishPdfBtn.disabled = true;
  const originalText = finishPdfBtn.textContent;
  finishPdfBtn.textContent = 'Generando…';
  try {
    await exportPagesAsPdf();
    clearPages(); // the session is "done" once its PDF has been handed off
  } catch (e) {
    finishPdfBtn.textContent = 'Error, reintenta';
    setTimeout(() => { finishPdfBtn.textContent = originalText; }, 2000);
    return;
  } finally {
    finishPdfBtn.disabled = false;
  }
  finishPdfBtn.textContent = originalText;
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
