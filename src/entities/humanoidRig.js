// src/entities/humanoidRig.js

export const HUMANOID_RIG = {
  size: 24,

  // Body regions (pixel-accurate)
  regions: {
    head:   { x: 8,  y: 0,  w: 8,  h: 4 },
    torsoU: { x: 6,  y: 4,  w: 12, h: 6 },
    torsoL: { x: 7,  y: 10, w: 10, h: 6 },
    legs:   { x: 8,  y: 16, w: 8,  h: 6 },
  },

  // Ground truth
  feetY: 23,

  // Anchor points for equipment & animation pivots
  anchors: {
    shoulderL: { x: 6,  y: 5 },
    shoulderR: { x: 17, y: 5 },

    handL: { x: 9,  y: 11 },
    handR: { x: 15, y: 11 },

    headCenter: { x: 12, y: 2 }
  }
};
