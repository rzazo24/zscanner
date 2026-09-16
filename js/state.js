// Shared mutable app state. Exported as a single object (rather than
// separate `let` bindings) because ES modules can't let other modules
// reassign an imported binding — mutating properties on a shared object
// is the standard workaround without pulling in a framework.

export const state = {
  cvReady: false,
  currentStream: null,
  facingMode: 'environment',
  lastQuad: null,         // 4 points in DETECTION-canvas coordinates, confirmed/stable only
  rawQuad: null,          // this frame's raw detection, even if not yet confirmed stable —
                          // a better seed for manual adjustment than a blank rectangle
  detectLoopHandle: null,
  currentMode: 'enhanced', // matches the default-active button in the mode-toggle
  lastWarpedMat: null,    // cv.Mat, RGBA, kept between mode switches
  lastShotCanvas: null,   // frozen full-res frame currently in the adjust/result stage
  adjustQuad: null,       // 4 points in lastShotCanvas pixel coords, order tl,tr,br,bl
  adjustReturnTo: 'live', // where "cancelar" goes back to: 'live' or 'result'
  draggingCorner: -1,
  pages: [],              // multi-page session: array of already-rendered <canvas>
                          // elements (one per confirmed page), in the mode each was
                          // in when added — see js/pages.js
};
