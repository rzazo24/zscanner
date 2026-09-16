// Visibility transitions between the three stages: live camera, manual
// corner adjustment, and result. Kept independent of detection/camera/
// perspective logic so those modules can import it without creating cycles.

import {
  stageLive, stageAdjust, liveControls, liveControlsSecondary, adjustControls,
  hintText, adjustHint, resultPanel,
} from './dom.js';

export function showLiveStage() {
  stageLive.classList.remove('hidden');
  stageAdjust.classList.add('hidden');
  liveControls.style.display = 'flex';
  liveControlsSecondary.style.display = 'flex';
  adjustControls.style.display = 'none';
  hintText.style.display = 'block';
  adjustHint.style.display = 'none';
  resultPanel.classList.remove('visible');
}

export function showAdjustStage() {
  stageLive.classList.add('hidden');
  stageAdjust.classList.remove('hidden');
  liveControls.style.display = 'none';
  liveControlsSecondary.style.display = 'none';
  adjustControls.style.display = 'flex';
  hintText.style.display = 'none';
  adjustHint.style.display = 'block';
  resultPanel.classList.remove('visible');
}

export function showResultStage() {
  stageLive.classList.add('hidden');
  stageAdjust.classList.add('hidden');
  liveControls.style.display = 'none';
  liveControlsSecondary.style.display = 'none';
  adjustControls.style.display = 'none';
  hintText.style.display = 'none';
  adjustHint.style.display = 'none';
  resultPanel.classList.add('visible');
}

// Returning from the adjust stage to an already-captured result (the
// "Ajustar" -> "Cancelar" path) without touching the live camera stage.
export function backToResultFromAdjust() {
  stageAdjust.classList.add('hidden');
  adjustControls.style.display = 'none';
  adjustHint.style.display = 'none';
  resultPanel.classList.add('visible');
}
