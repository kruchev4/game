export const PAINTERS = {
  // fallback: flat color (useful while tiles are unfinished)
  __default: (ctx, s, def) => {
    ctx.fillStyle = def.color || "#000";
    ctx.fillRect(0, 0, s, s);
  },

  // Tile 0: Grass
  // ── PAINTERS entries to add ──────────────────────────────────────────────────
 
  // Tile 3: Deep Water
  3: (ctx, s, def, seed) => {
    const r = makeRand(seed);
    fill(ctx, s, def.color || "#1a3f6b");
    // animated shimmer bands (deterministic — no Date.now so chunk-safe)
    ctx.fillStyle = "rgba(30,80,140,0.30)";
    ctx.fillRect(0, ((r() * s) | 0) % s, s, 2);
    ctx.fillRect(0, ((r() * s) | 0) % s, s, 1);
    ctx.fillStyle = "rgba(80,140,200,0.12)";
    for (let i = 0; i < 6; i++) {
      const x = (r() * s) | 0;
      const y = (r() * s) | 0;
      ctx.fillRect(x, y, 3, 1);
    }
    vignette(ctx, s, 0.01);
  },
 
  // Tile 4: Shallow Water / Path
  4: (ctx, s, def, seed) => {
    const r = makeRand(seed);
    fill(ctx, s, def.color || "#2a6080");
    ctx.fillStyle = "rgba(100,180,210,0.18)";
    for (let i = 0; i < 8; i++) {
      const x = (r() * s) | 0;
      const y = (r() * s) | 0;
      ctx.fillRect(x, y, 2, 1);
    }
    vignette(ctx, s, 0.01);
  },
 
  // Tile 5: Town marker (overworld)
  5: (ctx, s, def, seed) => {
    fill(ctx, s, def.color || "#c9a227");
    ctx.fillStyle = "rgba(255,220,80,0.25)";
    ctx.fillRect(2, 2, s - 4, s - 4);
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(0, s - 2, s, 2);
    ctx.fillRect(s - 2, 0, 2, s);
  },
 
  // Tile 6: Danger zone
  6: (ctx, s, def, seed) => {
    const r = makeRand(seed);
    fill(ctx, s, def.color || "#6b1a1a");
    ctx.fillStyle = "rgba(160,30,30,0.20)";
    for (let i = 0; i < 10; i++) {
      const x = (r() * s) | 0;
      const y = (r() * s) | 0;
      ctx.fillRect(x, y, 1, 1);
    }
    vignette(ctx, s, 0.01);
  },
 
  // Tile 7: Sand
  7: (ctx, s, def, seed) => {
    const r = makeRand(seed);
    fill(ctx, s, def.color || "#c8a870");
    ctx.fillStyle = "rgba(200,160,80,0.18)";
    for (let i = 0; i < 8; i++) {
      ctx.fillRect((r() * s) | 0, (r() * s) | 0, 2, 1);
    }
    ctx.fillStyle = "rgba(180,130,50,0.12)";
    for (let i = 0; i < 6; i++) {
      ctx.fillRect((r() * s) | 0, (r() * s) | 0, 1, 1);
    }
  },
 
  // Tile 8: Dungeon Wall
  8: (ctx, s, def, seed) => {
    const r = makeRand(seed);
    fill(ctx, s, def.color || "#151520");
    // Stone block pattern
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(0, 0, s/2 - 1, s/2 - 1);
    ctx.fillRect(s/2 + 1, s/2 + 1, s/2 - 1, s/2 - 1);
    // Dark mortar
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    ctx.fillRect(0, (s/2) | 0, s, 1);
    ctx.fillRect((s/2) | 0, 0, 1, s);
    // Occasional crack
    if (r() > 0.65) {
      ctx.strokeStyle = "rgba(0,0,0,0.40)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo((r() * s * 0.4 + 2) | 0, (r() * 6 + 2) | 0);
      ctx.lineTo((r() * s * 0.6 + s * 0.2) | 0, (r() * 10 + 6) | 0);
      ctx.stroke();
    }
  },
 
  // Tile 9: Dungeon Floor
  9: (ctx, s, def, seed) => {
    const r = makeRand(seed);
    fill(ctx, s, def.color || "#262018");
    // Subtle stone texture
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    if (r() > 0.8) ctx.fillRect(2, 2, s - 4, 1);
    if (r() > 0.9) ctx.fillRect(2, s - 4, s - 4, 1);
    // Very faint grout lines
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(0, (s/2) | 0, s, 1);
    ctx.fillRect((s/2) | 0, 0, 1, s);
  },
 
  // Tile 10: Stairs Up
  10: (ctx, s, def, seed) => {
    fill(ctx, s, "#262018");
    ctx.fillStyle = "rgba(96,128,160,0.55)";
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(4 + i*3, s - 8 - i*4, s - 8 - i*6, 3);
    }
    ctx.fillStyle = "rgba(150,190,230,0.8)";
    ctx.font = `${(s * 0.5) | 0}px serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("⬆", s/2, s/2);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  },
 
  // Tile 11: Stairs Down
  11: (ctx, s, def, seed) => {
    fill(ctx, s, "#262018");
    ctx.fillStyle = "rgba(64,80,96,0.55)";
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(4 + i*3, 4 + i*4, s - 8 - i*6, 3);
    }
    ctx.fillStyle = "rgba(100,130,160,0.8)";
    ctx.font = `${(s * 0.5) | 0}px serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("⬇", s/2, s/2);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  },
 
  // Tile 12: Door
  12: (ctx, s, def, seed) => {
    // Floor base
    fill(ctx, s, "#262018");
    // Door frame (dark wood)
    ctx.fillStyle = "#5a3010";
    ctx.fillRect(4, 2, s - 8, s - 4);
    // Door face (lighter)
    ctx.fillStyle = "#7a4a20";
    ctx.fillRect(6, 4, s - 12, s - 8);
    // Handle
    ctx.fillStyle = "#c9a227";
    ctx.fillRect((s/2) | 0, (s/2) | 0, 3, 3);
    // Frame border
    ctx.strokeStyle = "#3a2008"; ctx.lineWidth = 1.5;
    ctx.strokeRect(4, 2, s - 8, s - 4);
    ctx.lineWidth = 1;
  },
 
  // Tile 13: Chest
  13: (ctx, s, def, seed) => {
    const r = makeRand(seed);
    fill(ctx, s, "#262018");
    // Body
    ctx.fillStyle = "#6b3a10";
    ctx.fillRect(5, 8, s - 10, s - 14);
    // Lid highlight
    ctx.fillStyle = "#8b5a20";
    ctx.fillRect(5, 8, s - 10, (s - 14) / 2);
    // Lid top
    ctx.fillStyle = "#5a2a08";
    ctx.fillRect(5, 6, s - 10, 4);
    // Lock
    ctx.fillStyle = "#c9a227";
    ctx.fillRect((s/2) | 0 - 2, (s/2) | 0 - 1, 4, 4);
    // Gold glow (deterministic pulse using seed)
    const pulse = 0.06 + (r() * 0.04);
    ctx.fillStyle = `rgba(201,162,39,${pulse})`;
    ctx.fillRect(3, 5, s - 6, s - 8);
  },
 
  // Tile 14: Portal
  14: (ctx, s, def, seed) => {
    const r = makeRand(seed);
    fill(ctx, s, "#1a0830");
    // Radial glow
    ctx.fillStyle = "rgba(120,40,220,0.35)";
    ctx.beginPath();
    ctx.arc(s/2, s/2, s/2 - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(180,100,255,0.20)";
    ctx.beginPath();
    ctx.arc(s/2, s/2, s/3, 0, Math.PI * 2);
    ctx.fill();
    // Swirl icon
    ctx.fillStyle = "rgba(200,150,255,0.85)";
    ctx.font = `${(s * 0.55) | 0}px serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("🌀", s/2, s/2);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    vignette(ctx, s, 0.01);
  },
 
  // Tile 15: Jungle
  15: (ctx, s, def, seed) => {
    const r = makeRand(seed);
    fill(ctx, s, def.color || "#0f3b1f");
    ctx.fillStyle = "rgba(0,60,20,0.35)";
    ctx.beginPath();
    ctx.arc((r() * s/2 + s/4) | 0, (r() * s/2 + s/4) | 0, (s * 0.38) | 0, 0, Math.PI * 2);
    ctx.fill();
    dots(ctx, s, seed + 5, "rgba(20,80,30,0.3)", 8);
  },
 
  // Tile 16: Volcano
  16: (ctx, s, def, seed) => {
    const r = makeRand(seed);
    fill(ctx, s, def.color || "#7a1a0a");
    ctx.fillStyle = "rgba(255,80,0,0.25)";
    for (let i = 0; i < 5; i++) {
      ctx.fillRect((r() * s) | 0, (r() * s) | 0, 2, 2);
    }
    vignette(ctx, s, 0.01);
  },
 
  // Tile 17: Eldritch
  17: (ctx, s, def, seed) => {
    const r = makeRand(seed);
    fill(ctx, s, def.color || "#32134d");
    ctx.fillStyle = "rgba(120,40,220,0.18)";
    ctx.fillRect(0, 0, s, s);
    dots(ctx, s, seed + 3, "rgba(180,100,255,0.20)", 8);
    vignette(ctx, s, 0.01);
  },
 
  // Tile 18: Obsidian
  18: (ctx, s, def, seed) => {
    const r = makeRand(seed);
    fill(ctx, s, def.color || "#1a1a1a");
    // Glassy facets
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(1, 1, s/2 - 2, s/2 - 2);
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(s/2 + 1, s/2 + 1, s/2 - 2, s/2 - 2);
    vignette(ctx, s, 0.01);
  },
 
  // Tile 19: Blight
  19: (ctx, s, def, seed) => {
    const r = makeRand(seed);
    fill(ctx, s, def.color || "#3a2a1a");
    dots(ctx, s, seed + 7, "rgba(80,40,0,0.30)", 10);
    ctx.fillStyle = "rgba(100,60,20,0.15)";
    ctx.fillRect(2, 2, s - 4, s - 4);
  },
 
  // Tile 20: Town Floor (cobblestone)
  20: (ctx, s, def, seed) => {
    const r = makeRand(seed);
    fill(ctx, s, def.color || "#6a6058");
    // Cobble grid offset by row
    const stW = (s / 3) | 0;
    const stH = (s / 2.5) | 0;
    for (let row = 0; row < 3; row++) {
      for (let col = -1; col < 4; col++) {
        const sx = col * stW + (row % 2 === 0 ? 0 : (stW/2) | 0);
        const sy = row * stH;
        if (sx >= s || sy >= s) continue;
        const sv = r();
        ctx.fillStyle = sv > 0.5 ? "#757060" : "#656050";
        ctx.fillRect(sx + 1, sy + 1, stW - 2, stH - 2);
      }
    }
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 0, s, 1); ctx.fillRect(0, 0, 1, s);
  },
 
  // Tile 21: Town Wall
  21: (ctx, s, def, seed) => {
    const r = makeRand(seed);
    fill(ctx, s, def.color || "#1e1810");
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(1, 1, s/2 - 2, s/2 - 2);
    ctx.fillRect(s/2 + 1, s/2 + 1, s/2 - 2, s/2 - 2);
    ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, s - 1, s - 1);
    ctx.beginPath();
    ctx.moveTo(0, s/2); ctx.lineTo(s, s/2);
    ctx.moveTo(s/2, 0); ctx.lineTo(s/2, s/2);
    ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, 0, s, 2);
  },
 
  // Tile 22: Inn
  22: (ctx, s, def, seed) => { drawTownService(ctx, s, seed, "🏨", "#7a5030"); },
  // Tile 23: Shop
  23: (ctx, s, def, seed) => { drawTownService(ctx, s, seed, "⚒", "#1a3a5a"); },
  // Tile 24: Temple
  24: (ctx, s, def, seed) => { drawTownService(ctx, s, seed, "✝", "#4a2a6a"); },
  // Tile 25: Tavern
  25: (ctx, s, def, seed) => { drawTownService(ctx, s, seed, "🍺", "#3a2808"); },
  // Tile 26: Vendor
  26: (ctx, s, def, seed) => { drawTownService(ctx, s, seed, "💰", "#1a3a1a"); },
  // Tile 32: Town Exit
  32: (ctx, s, def, seed) => {
    fill(ctx, s, "#2a5a2a");
    ctx.fillStyle = "#3a7a3a";
    ctx.fillRect(2, 2, s - 4, s - 4);
    ctx.fillStyle = "rgba(100,220,100,0.7)";
    ctx.font = `${(s * 0.55) | 0}px serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("🌍", s/2, s/2);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    vignette(ctx, s, 0.01);
  },

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
function drawTownService(ctx, s, seed, icon, color) {
  const r = makeRand(seed);
  // Cobble base
  fill(ctx, s, color + "30");
  ctx.fillStyle = "#6a6058";
  ctx.fillRect(0, 0, s, s);
  // Coloured tint
  ctx.fillStyle = color + "40";
  ctx.fillRect(0, 0, s, s);
  // Icon
  ctx.globalAlpha = 0.88;
  ctx.font = `${(s * 0.52) | 0}px serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(icon, s/2, s/2);
  ctx.globalAlpha = 1;
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  // Border
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5;
  ctx.strokeRect(1, 1, s - 2, s - 2);
  ctx.globalAlpha = 1; ctx.lineWidth = 1;
}

function vignette(ctx, s, strength = 0.01) {
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