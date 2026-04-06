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

// Tile 1: Forest (dense, darker, no hard edges)
  1: (ctx, s, def, seed, neighbors) => {
    const r = makeRand(seed);

    // base
    ctx.fillStyle = def.color || "#2e7d32";
    ctx.fillRect(0, 0, s, s);

    // subtle canopy specks (kept away from edges)
    ctx.fillStyle = "rgba(10,20,10,0.14)";
    for (let i = 0; i < 12; i++) {
      const x = 2 + ((r() * (s - 4)) | 0);
      const y = 2 + ((r() * (s - 4)) | 0);
      ctx.fillRect(x, y, 1, 1);
    }

    // darker “leaf clusters” (small blobs)
    for (let k = 0; k < 3; k++) {
      const cx = 3 + ((r() * (s - 6)) | 0);
      const cy = 3 + ((r() * (s - 6)) | 0);
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(cx, cy, 2, 2);
      ctx.fillRect(cx + 1, cy, 2, 1);
    }

    // optional: tiny highlight flecks
    ctx.fillStyle = "rgba(120,200,120,0.10)";
    for (let i = 0; i < 6; i++) {
      const x = 2 + ((r() * (s - 4)) | 0);
      const y = 2 + ((r() * (s - 4)) | 0);
      ctx.fillRect(x, y, 1, 1);
    }
  },

  // Tile 2: Mountain (rock texture, interior-only detail)
  2: (ctx, s, def, seed, neighbors) => {
    const r = makeRand(seed);

    // base
    ctx.fillStyle = def.color || "#7b7b7b";
    ctx.fillRect(0, 0, s, s);

    // rock specks
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    for (let i = 0; i < 16; i++) {
      const x = 2 + ((r() * (s - 4)) | 0);
      const y = 2 + ((r() * (s - 4)) | 0);
      ctx.fillRect(x, y, 1, 1);
    }

    // light specks
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    for (let i = 0; i < 10; i++) {
      const x = 2 + ((r() * (s - 4)) | 0);
      const y = 2 + ((r() * (s - 4)) | 0);
      ctx.fillRect(x, y, 1, 1);
    }

    // subtle ridge line (diagonal) — stays inside tile
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath();
    ctx.moveTo(3, 5);
    ctx.lineTo(s - 4, s - 6);
    ctx.stroke();
  },

  // Road Dirt (27) – autotile connections
  27: (ctx, s, def, seed, n) => {
    drawRoad(ctx, s, seed, n, {
      fill: "#8b6a44",
      track: "rgba(60,40,25,0.35)",
      edge: "rgba(0,0,0,0.15)"
    });
  },

  // Road Stone (28)
  28: (ctx, s, def, seed, n) => {
    drawRoad(ctx, s, seed, n, {
      fill: "#7c7f86",
      track: "rgba(30,30,40,0.30)",
      edge: "rgba(0,0,0,0.18)"
    });
  },

  // Road Obsidian (29)
  29: (ctx, s, def, seed, n) => {
    drawRoad(ctx, s, seed, n, {
      fill: "#1b1b22",
      track: "rgba(120,120,160,0.18)",
      edge: "rgba(0,0,0,0.25)"
    });
  },

  // Road Blight (30)
  30: (ctx, s, def, seed, n) => {
    drawRoad(ctx, s, seed, n, {
      fill: "#3a2f2f",
      track: "rgba(10,0,0,0.22)",
      edge: "rgba(0,0,0,0.22)"
    });
  },

  // Road Runic (31)
  31: (ctx, s, def, seed, n) => {
    drawRoad(ctx, s, seed, n, {
      fill: "#0f0f18",
      track: "rgba(130,90,255,0.18)",
      edge: "rgba(0,0,0,0.25)",
      runes: true
    });
  },}



function drawRoad(ctx, s, seed, neighbors, style) {
  const inset = 2;   // gap where terrain shows
  const chamfer = 3; // size of corner cut
  const mid = (s / 2) | 0;
  const half = 3; // road half-width

  // Utility: is connected road
  const isRoad = (t) =>
    t === 27 || t === 28 || t === 29 || t === 30 || t === 31;

  const N = isRoad(neighbors?.n);
  const E = isRoad(neighbors?.e);
  const S = isRoad(neighbors?.s);
  const W = isRoad(neighbors?.w);

  // -------- road fill (polygon) --------
  ctx.fillStyle = style.track;
  ctx.beginPath();

  // Start top-left corner (chamfered)
  ctx.moveTo(inset + chamfer, inset);

  // Top edge
  ctx.lineTo(s - inset - chamfer, inset);
  ctx.lineTo(s - inset, inset + chamfer);

  // Right edge
  if (E) {
    ctx.lineTo(s - inset, mid - half);
    ctx.lineTo(s, mid - half);
    ctx.lineTo(s, mid + half);
    ctx.lineTo(s - inset, mid + half);
  }

  ctx.lineTo(s - inset, s - inset - chamfer);
  ctx.lineTo(s - inset - chamfer, s - inset);

  // Bottom edge
  ctx.lineTo(inset + chamfer, s - inset);
  ctx.lineTo(inset, s - inset - chamfer);

  // Left edge
  if (W) {
    ctx.lineTo(inset, mid + half);
    ctx.lineTo(0, mid + half);
    ctx.lineTo(0, mid - half);
    ctx.lineTo(inset, mid - half);
  }

  ctx.lineTo(inset, inset + chamfer);

  // Top connection
  if (N) {
    ctx.lineTo(mid - half, inset);
    ctx.lineTo(mid - half, 0);
    ctx.lineTo(mid + half, 0);
    ctx.lineTo(mid + half, inset);
  }

  ctx.closePath();
  ctx.fill();

  // -------- subtle inner edge (optional) --------
  ctx.strokeStyle = style.edge;
  ctx.lineWidth = 1;
  ctx.stroke();
}   

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

