export const PAINTERS = {
  // fallback: flat color (useful while tiles are unfinished)
  __default: (ctx, s, def) => {
    ctx.fillStyle = def.color || "#000";
    ctx.fillRect(0, 0, s, s);
  },

  // Tile 0: Grass


  0: (ctx, s, def, seed) => {
    // base
    fill(ctx, s, def.color || "#4caf50");

    // subtle noise (keep counts low so it doesn't shimmer visually)
    dots(ctx, s, seed,     "#3f8f45", 22); // shadow specks
    dots(ctx, s, seed+11,  "#6bdc6f", 12); // highlight specks

    // a few tiny tufts (clusters)
    tufts(ctx, s, seed+23, "#2e7d32", 4);

    // optional: rare flower pixel (very low chance)
    flower(ctx, s, seed+99);

    // tile separation: 1px vignette (keeps map readable)
    vignette(ctx, s, 0.00);
  },
};

/* -------- helpers -------- */

function fill(ctx, s, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, s, s);
}

function rnd(seed) {
  // xorshift32 -> 0..1
  let x = seed | 0;
  x ^= x << 13; x ^= x >> 17; x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

function dots(ctx, s, seed, color, count) {
  ctx.fillStyle = color;
  let z = seed >>> 0;
  for (let i = 0; i < count; i++) {
    z = (z + 0x9e3779b9) >>> 0;
    const x = (rnd(z) * s) | 0;
    const y = (rnd(z ^ 0xB5297A4D) * s) | 0;
    ctx.fillRect(x, y, 1, 1);
  }
}

function tufts(ctx, s, seed, color, clusters) {
  ctx.fillStyle = color;
  let z = seed >>> 0;
  for (let c = 0; c < clusters; c++) {
    z = (z + 0x9e3779b9) >>> 0;
    const cx = (rnd(z) * s) | 0;
    const cy = (rnd(z ^ 0xA341316C) * s) | 0;
    // 3–6 pixels per tuft
    const pixels = 3 + ((rnd(z ^ 0xC8013EA4) * 4) | 0);
    for (let i = 0; i < pixels; i++) {
      const ox = (((rnd(z ^ (i * 17)) * 5) | 0) - 2);
      const oy = (((rnd(z ^ (i * 31)) * 5) | 0) - 2);
      const x = cx + ox, y = cy + oy;
      if (x >= 0 && y >= 0 && x < s && y < s) ctx.fillRect(x, y, 1, 1);
    }
  }
}

function flower(ctx, s, seed) {
  // very rare 1px "flower" sparkle
  const chance = rnd(seed);
  if (chance > 0.985) {
    const x = (rnd(seed ^ 0x1234) * s) | 0;
    const y = (rnd(seed ^ 0xBEEF) * s) | 0;
    ctx.fillStyle = (chance > 0.993) ? "#ffffff" : "#ffb7d5";
    ctx.fillRect(x, y, 1, 1);
  }
}

function vignette(ctx, s, strength = 0.10) {
  ctx.fillStyle = `rgba(0,0,0,${strength})`;
  ctx.fillRect(0, 0, s, 1);
  ctx.fillRect(0, s - 1, s, 1);
  ctx.fillRect(0, 0, 1, s);
  ctx.fillRect(s - 1, 0, 1, s);
}
function makeRand(seed) {
  // fast deterministic PRNG from a 32-bit seed
  let x = seed >>> 0;
  return function () {
    // xorshift32
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return x / 4294967296;
  };
}

