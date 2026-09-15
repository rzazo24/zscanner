// getUserMedia stream handling and the video-to-stage coordinate mapping
// (object-fit: cover means the visible stage only shows a crop of the
// video's native resolution — video._crop records that crop in video
// pixel space so detection/capture can read from the same region).

import { video, stageLive, overlay } from './dom.js';
import { state } from './state.js';
import { resizeDetectionCanvas } from './detection.js';

export async function openStream(mode) {
  if (state.currentStream) {
    state.currentStream.getTracks().forEach(t => t.stop());
  }
  state.currentStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 1706 } },
    audio: false
  });
  video.srcObject = state.currentStream;
  await new Promise(res => { video.onloadedmetadata = () => { video.play(); res(); }; });
  sizeCanvases();
}

export function sizeCanvases() {
  const rect = stageLive.getBoundingClientRect();
  overlay.width = rect.width;
  overlay.height = rect.height;
  const vAspect = video.videoWidth / video.videoHeight;
  const stageAspect = rect.width / rect.height;
  // object-fit: cover mapping from video pixel space to displayed stage space
  let sx, sy, sw, sh;
  if (vAspect > stageAspect) {
    sh = video.videoHeight;
    sw = sh * stageAspect;
    sy = 0;
    sx = (video.videoWidth - sw) / 2;
  } else {
    sw = video.videoWidth;
    sh = sw / stageAspect;
    sx = 0;
    sy = (video.videoHeight - sh) / 2;
  }
  video._crop = { sx, sy, sw, sh };
  resizeDetectionCanvas(stageAspect);
}
