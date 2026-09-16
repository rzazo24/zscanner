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
  // `ideal` (not `min`/`exact`) is a soft constraint — the browser just picks its
  // closest supported resolution to this, never throws for asking "too much". The
  // live detection loop reads from a small downscaled canvas (see DET_W in
  // detection.js) regardless of this, so a higher native resolution here doesn't
  // slow down live detection at all — only the one-time capture/warp step gets
  // bigger input, which is exactly what we want more of.
  state.currentStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: mode, width: { ideal: 2400 }, height: { ideal: 3200 } },
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

// getUserMedia's continuous video stream is capped well below a camera's real photo
// resolution — it has to keep decoding/encoding frames in real time, so the browser
// negotiates something far short of what the sensor can actually produce for a single
// still shot (confirmed directly: a stream negotiated at 2400x2160 here, but
// ImageCapture.takePhoto() on that same track returned 3840x2160 — a real capability
// gap, not a hypothetical one). ImageCapture.takePhoto() asks the camera for one full-
// resolution still instead of just reading the live stream's current frame, which is
// what grabFullFrame() in adjust.js used to do exclusively. Chrome/Android supports
// this; Safari does not define `ImageCapture` at all, so this must stay optional with
// a plain video-frame fallback, not something callers can assume succeeds.
export async function grabHighResPhoto() {
  const track = state.currentStream?.getVideoTracks()[0];
  if (!track || typeof ImageCapture === 'undefined') return null;
  try {
    const capture = new ImageCapture(track);
    // Race against a timeout: a still-photo capture can stall indefinitely on some
    // devices/drivers (autofocus hunting, camera briefly busy) — better to silently
    // fall back to the ordinary video-frame snapshot than to leave the shutter
    // looking hung for something that's meant to feel instant.
    const blob = await Promise.race([
      capture.takePhoto(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('takePhoto timed out')), 4000)),
    ]);
    return await createImageBitmap(blob);
  } catch (e) {
    return null;
  }
}

// A torch/flash toggle was tried here (v0.7.0) and reverted (v0.7.1): at normal
// document-scanning distance, a phone's rear flash is a point source close enough to
// the page to create a bright hotspot with sharp falloff, not even ambient light. That
// both introduces strong spurious edges around the hotspot itself and skews the
// auto-Canny median (see detection.js), and can even trigger the camera's auto-exposure
// to darken the rest of the frame in response — confirmed worse in practice, not just
// in theory. See CLAUDE.md for the longer version if this is ever reconsidered.
