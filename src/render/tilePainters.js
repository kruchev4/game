// tilePainters.js
export const PAINTERS = {
  __default: (ctx, s, def) => {
    ctx.fillStyle = def.color ?? "#000";
    ctx.fillRect(0, 0, s, s);
  },

  // 0 Grass
  0: (ctx, s, def, seed) => {
    fill(ctx, s, def.color);
    noiseDots(ctx, s, seed, ["#3e9f44", "#66bb6a", "#2e7d32"], 28);
    vignette(ctx, s, 0.12);
  },

  // 1 Forest (darker, clustered canopy specks)
  1: (ctx, s, def, seed) => {
    fill(ctx, s, def.color);
    noiseClusters(ctx, s, seed, ["#1f5a24", "#2e7d32", "#3b8f3f"], 7);
    vignette(ctx, s, 0.18);
  },

  // 2 Mountain (rocky texture + highlight ridge)
  2: (ctx, s, def, seed) => {
    fill(ctx, s, def.color);
    noiseDots(ctx, s, seed, ["#6b6b6b", "#8a8a8a", "#525252"], 22);
    ridge(ctx, s, seed, "rgba(255,255,255,0.18)", "rgba(0,0,0,0.18)");
    vignette(ctx, s, 0.20);
  },

  // 6 Sand (warm + subtle grain)
  6: (ctx, s, def, seed) => {
    fill(ctx, s, def.color);
    noiseDots(ctx, s, seed, ["#d2b96d", "#e7d7a3", "#c7ad62"], 18);
    vignette(ctx, s, 0.10);
  },

  // 3 Deep Water (dark + gentle wave strokes)
  3: (ctx, s, def, seed) => {
    fill(ctx, s, def.color);
    wave(ctx, s, seed, "rgba(255,255,255,0.08)");
    vignette(ctx, s, 0.22);
  },

  // 4 Shallow Water (lighter + shoreline sparkle)
  4: (ctx, s, def, seed) => {
    fill(ctx, s, def.color);
    wave(ctx, s, seed, "rgba(255,255,255,0.10)");
    noiseDots(ctx, s, seed, ["rgba(255,255,255,0.12)"], 10);
    vignette(ctx, s, 0.14);
  },
};

/* ---------- helpers (simple + fast) ---------- */
function fill(ctx, s, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, s, s);
}

function rand(seed) {
  // xorshift32
  let x = seed | 0;
  x ^= x << 13; x ^= x >> 17; x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

function noiseDots(ctx, s, seed, colors, count) {
  let z = seed;
  for (let i = 0; i < count; i++) {
    z = (z + 0x9e3779b9) >>> 0;
    const r = rand(z);
    const x = (rand(z ^ 0xA53) * s) | 0;
    const y = (rand(z ^ 0xC31) * s) | 0;
    const c = colors[(r * colors.length) | 0];
    ctx.fillStyle = c;
    ctx.fillRect(x, y, 1, 1);
  }
}

function noiseClusters(ctx, s, seed, colors, clusters) {
  let z = seed;
  for (let k = 0; k < clusters; k++) {
    z = (z + 0x9e3779b9) >>> 0;
    const cx = (rand(z ^ 0x1a) * s) | 0;
    const cy = (rand(z ^ 0x2b) * s) | 0;
    const c = colors[(rand(z ^ 0x3c) * colors.length) | 0];
    ctx.fillStyle = c;
    // small blob
    for (let i = 0; i < 8; i++) {
      const x = cx + (((rand(z ^ (i * 11)) * 5) | 0) - 2);
      const y = cy + (((rand(z ^ (i * 17)) * 5) | 0) - 2);
      if (x >= 0 && y >= 0 && x < s && y < s) ctx.fillRect(x, y, 1, 1);
    }
  }
}

function wave(ctx, s, seed, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  let z = seed;
  for (let i = 0; i < 3; i++) {
    z = (z + 0x9e3779b9) >>> 0;
    const y = ((rand(z) * (s - 1)) | 0) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(s, y);
    ctx.stroke();
  }
}

function ridge(ctx, s, seed, hi, lo) {
  // diagonal highlight/shadow
  ctx.strokeStyle = hi;
  ctx.beginPath();
  ctx.moveTo(0, 2.5);
  ctx.lineTo(s, s - 3.5);
  ctx.stroke();

  ctx.strokeStyle = lo;
  ctx.beginPath();
  ctx.moveTo(2.5, 0);
  ctx.lineTo(s - 3.5, s);
  ctx.stroke();
}

function vignette(ctx, s, strength = 0.15) {
  // cheap edge darken
  ctx.fillStyle = `rgba(0,0,0,${strength})`;
  ctx.fillRect(0, 0, s, 1);
  ctx.fillRect(0, s - 1, s, 1);
  ctx.fillRect(0, 0, 1, s);
  ctx.fillRect(s - 1, 0, 1, s);
}
