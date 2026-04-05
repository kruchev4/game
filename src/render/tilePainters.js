export const PAINTERS = {
  // fallback: flat color (useful while tiles are unfinished)
  __default: (ctx, s, def) => {
    ctx.fillStyle = def.color || "#000";
    ctx.fillRect(0, 0, s, s);
  },

  // Tile 0: Grass
  0: (ctx, s, def, seed, neighbors) => {
  fill(ctx, s, def.color || "#4caf50");

  dots(ctx, s, seed,     "#3f8f45", 18);
  dots(ctx, s, seed + 11,"#6bdc6f", 10);
  tufts(ctx, s, seed+23,"#2e7d32", 3);

  // ✅ THIS LINE IS THE EDGE BLENDING
  if (neighbors) grassEdgeBlend(ctx, s, neighbors);
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

function vignette(ctx, s, strength = 0.00) {
  ctx.fillStyle = `rgba(0,0,0,${strength})`;
  ctx.fillRect(0, 0, s, 1);
  ctx.fillRect(0, s - 1, s, 1);
  ctx.fillRect(0, 0, 1, s);
  ctx.fillRect(s - 1, 0, 1, s);
}
function grassEdgeBlend(ctx, s, nb) {
  const edgeN = grassEdgeColor(nb.n);
  const edgeE = grassEdgeColor(nb.e);
  const edgeS = grassEdgeColor(nb.s);
  const edgeW = grassEdgeColor(nb.w);

  featherEdge(ctx, s, "N", edgeN);
  featherEdge(ctx, s, "E", edgeE);
  featherEdge(ctx, s, "S", edgeS);
  featherEdge(ctx, s, "W", edgeW);
}

function grassEdgeColor(tileId) {
  if (tileId === 0) return null;

  if ([3,4,35,36].includes(tileId))
    return "rgba(255,255,255,0.18)"; // water

  if (tileId === 6)
    return "rgba(180,120,60,0.18)"; // sand

  if ([1,33].includes(tileId))
    return "rgba(0,0,0,0.16)"; // forest

  if ([2,9,34].includes(tileId))
    return "rgba(0,0,0,0.22)"; // mountain

  if ([8,32,30].includes(tileId))
    return "rgba(60,30,30,0.18)"; // blight

  return "rgba(0,0,0,0.12)";
}

function featherEdge(ctx, s, dir, rgba) {
  if (!rgba) return;

  if (dir === "N") {
    ctx.fillStyle = rgba; ctx.fillRect(0, 0, s, 1);
    ctx.fillStyle = weaken(rgba, 0.5); ctx.fillRect(0, 1, s, 1);
  } else if (dir === "S") {
    ctx.fillStyle = rgba; ctx.fillRect(0, s-1, s, 1);
    ctx.fillStyle = weaken(rgba, 0.5); ctx.fillRect(0, s-2, s, 1);
  } else if (dir === "W") {
    ctx.fillStyle = rgba; ctx.fillRect(0, 0, 1, s);
    ctx.fillStyle = weaken(rgba, 0.5); ctx.fillRect(1, 0, 1, s);
  } else if (dir === "E") {
    ctx.fillStyle = rgba; ctx.fillRect(s-1, 0, 1, s);
    ctx.fillStyle = weaken(rgba, 0.5); ctx.fillRect(s-2, 0, 1, s);
  }
}

function weaken(rgba, factor) {
  const m = rgba.match(/rgba\((\d+),(\d+),(\d+),([0-9.]+)\)/);
  if (!m) return rgba;
  const a = Math.max(0, Math.min(1, Number(m[4]) * factor));
  return `rgba(${m[1]},${m[2]},${m[3]},${a})`;
}
