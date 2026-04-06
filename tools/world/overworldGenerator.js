// game/tools/world/overworldGenerator.js
// Phase 1 Overworld Generator (3×3), aligned to YOUR renderer IDs
// - World tiles: 0..9
// - Dungeon tiles: 10..15 (unused here)
// - Town tiles: 20..26 (unused here)
// - Road tiles: 27..31
//
// Exposes:
//   export function generateOverworldTiles({ worldId, seed })
//   export function generateOverworldWorld({ worldId, seed })
//   window.__generateOverworldWorld / window.__generateOverworldTiles (dev hooks)

export const WORLD_WIDTH  = 240;
export const WORLD_HEIGHT = 180;

// ── Tile IDs (MUST match your renderer switch) ──────────────────────────────
export const TILE = {
  // World tiles (0..9)
  GRASS: 0,
  FOREST: 1,
  MOUNTAIN: 2,
  DEEP_WATER: 3,
  SHALLOW: 4,
  TOWN: 5,
  SAND: 6,     // renderer case 6 drawSand
  DANGER: 7,   // renderer case 7 drawDanger
  BLIGHT: 8,   // renderer case 8 drawBlight
  VOLCANO: 9,  // renderer case 9 drawVolcano

  // Roads (you added)
  ROAD_DIRT: 27,
  ROAD_STONE: 28,
  ROAD_OBSIDIAN: 29,
  ROAD_BLIGHT: 30,
  ROAD_RUNIC: 31
};

// 3×3 world offsets for edge-consistent features
const WORLD_OFFSETS = {
  overworld_C:[0,0],
  overworld_N:[0,-1],
  overworld_S:[0,1],
  overworld_E:[1,0],
  overworld_W:[-1,0],
  overworld_NE:[1,-1],
  overworld_NW:[-1,-1],
  overworld_SE:[1,1],
  overworld_SW:[-1,1]
};

// ── Deterministic noise helpers ─────────────────────────────────────────────
function hash01(x, y, seed) {
  const s = Math.sin((x * 127.1 + y * 311.7 + seed * 17.17)) * 43758.5453;
  return s - Math.floor(s);
}
function smoothstep(t){ return t*t*(3-2*t); }
function lerp(a,b,t){ return a+(b-a)*t; }

function noise2(x, y, seed, scale=32) {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = smoothstep(fx - x0);
  const ty = smoothstep(fy - y0);

  const a = hash01(x0,   y0,   seed);
  const b = hash01(x0+1, y0,   seed);
  const c = hash01(x0,   y0+1, seed);
  const d = hash01(x0+1, y0+1, seed);

  return lerp(lerp(a,b,tx), lerp(c,d,tx), ty);
}

function idx(x,y,W){ return y*W+x; }
function inb(x,y,W,H){ return x>=0 && y>=0 && x<W && y<H; }

// ── Base biome definition per world (Phase 1, renderer-aligned) ────────────
// Keep it simple: only use tiles 0..9 + roads 27..31.
// You can later add real biome tiles (15..19) in Phase 2 AFTER renderer supports them.
const BIOME = {
  overworld_C: { base: TILE.GRASS,  alts: [[TILE.FOREST, 0.28], [TILE.SAND, 0.06], [TILE.DANGER, 0.04]] },
  overworld_N: { base: TILE.MOUNTAIN, alts: [[TILE.FOREST, 0.10], [TILE.DANGER, 0.06]] },
  overworld_S: { base: TILE.BLIGHT, alts: [[TILE.DANGER, 0.22], [TILE.FOREST, 0.06]] },
  overworld_E: { base: TILE.VOLCANO, alts: [[TILE.DANGER, 0.18], [TILE.SAND, 0.05]] },
  overworld_W: { base: TILE.FOREST, alts: [[TILE.GRASS, 0.12], [TILE.DANGER, 0.10]] },

  // Corners: distinct mixes without new tile IDs
  overworld_NE:{ base: TILE.DANGER, alts: [[TILE.MOUNTAIN, 0.14], [TILE.VOLCANO, 0.07]] },
  overworld_NW:{ base: TILE.FOREST, alts: [[TILE.MOUNTAIN, 0.12], [TILE.GRASS, 0.10]] },
  overworld_SE:{ base: TILE.GRASS,  alts: [[TILE.SAND, 0.10], [TILE.VOLCANO, 0.06], [TILE.DANGER, 0.06]] },
  overworld_SW:{ base: TILE.BLIGHT, alts: [[TILE.FOREST, 0.10], [TILE.DANGER, 0.16]] }
};

// ───────────────────────────────────────────────────────────────────────────
// 1) Base tiles (blank slate biome fill)
// ───────────────────────────────────────────────────────────────────────────
export function generateOverworldTiles({ worldId, seed }) {
  const W = WORLD_WIDTH, H = WORLD_HEIGHT;
  const def = BIOME[worldId] || BIOME.overworld_C;

  const tiles = new Array(W * H);

  // Use global-space noise so worlds are continuous across borders
  const [wx, wy] = WORLD_OFFSETS[worldId] || [0,0];
  const ox = wx * W;
  const oy = wy * H;

  for (let y=0; y<H; y++){
    for (let x=0; x<W; x++){
      const i = idx(x,y,W);

      const n = noise2(x + ox, y + oy, seed + 11, 48);
      const n2 = noise2(x + ox, y + oy, seed + 22, 18);

      let t = def.base;

      // deterministic alt selection
      // (probabilities are thresholds: lower n picks alt earlier)
      for (const [alt, chance] of def.alts) {
        const h = (n*0.7 + n2*0.3);
        if (h < chance) { t = alt; break; }
      }

      tiles[i] = t;
    }
  }

  return tiles;
}

// ───────────────────────────────────────────────────────────────────────────
// 2) Phase 1 full world object (tiles + variants + metadata)
// ───────────────────────────────────────────────────────────────────────────
export function generateOverworldWorld({ worldId, seed }) {
  const tiles = generateOverworldTiles({ worldId, seed });

  const W = WORLD_WIDTH, H = WORLD_HEIGHT;
  const size = W * H;

  // Required by GameMap
  const variants = new Array(size).fill(0);

  // Add geography + towns + roads + dungeon markers
  const meta = decorateWorldPhase1({ worldId, seed, tiles, variants, W, H });

  return {
    id: worldId,
    name: worldId.replace("overworld_", "").toUpperCase(),
    type: "world",
    width: W,
    height: H,
    tiles,
    variants,

    // Phase 1: present but engine can ignore for now
    towns: meta.towns,
    portals: meta.portals,
    npcs: [],
    entities: [],
    encounters: [],
    metadata: meta.metadata
  };
}

// ───────────────────────────────────────────────────────────────────────────
// 3) Decoration passes (Phase 1): ridges, lakes, rivers, towns, roads, POI
// ───────────────────────────────────────────────────────────────────────────
function decorateWorldPhase1({ worldId, seed, tiles, variants, W, H }) {
  const size = W * H;

  const [wx, wy] = WORLD_OFFSETS[worldId] || [0,0];
  const ox = wx * W;
  const oy = wy * H;

  // global noise wrapper
  const gNoise = (x,y,s,sc) => noise2(x + ox, y + oy, s, sc);

  // Road tile by world
  function roadTileForWorld() {
    if (worldId === "overworld_E") return TILE.ROAD_OBSIDIAN;
    if (worldId === "overworld_S") return TILE.ROAD_BLIGHT;
    if (worldId === "overworld_NE") return TILE.ROAD_RUNIC;
    if (worldId === "overworld_N") return TILE.ROAD_STONE;
    return TILE.ROAD_DIRT;
  }

  // ── PASS A: Mountain ridges (belts) ────────────────────────
  for (let y=0; y<H; y++){
    for (let x=0; x<W; x++){
      const i = idx(x,y,W);

      const n1 = gNoise(x,y, seed+101, 58);
      const n2 = gNoise(x,y, seed+202, 18);
      const ridge = Math.abs(n1 - 0.5) * 2;
      const height = 0.65*ridge + 0.35*n2;

      // bias per world
      const bias = (worldId === "overworld_N" || worldId === "overworld_NE" || worldId === "overworld_NW") ? -0.05 : 0.05;

      if (height > (0.82 + bias)) {
        tiles[i] = TILE.MOUNTAIN;
        variants[i] |= 1; // ridge bit
      }
    }
  }

  // ── PASS B: Lakes (deep + shore) ───────────────────────────
  const lakes = (worldId === "overworld_C") ? 1 : 2;
  for (let k=0;k<lakes;k++){
    const cx = Math.floor(W*0.2 + gNoise(33+k, 44+k, seed+303, 8) * W*0.6);
    const cy = Math.floor(H*0.2 + gNoise(55+k, 66+k, seed+404, 8) * H*0.6);
    const radius = 10 + Math.floor(gNoise(cx, cy, seed+505+k, 12) * 18);

    for (let yy=Math.max(1,cy-radius-2); yy<Math.min(H-1,cy+radius+2); yy++){
      for (let xx=Math.max(1,cx-radius-2); xx<Math.min(W-1,cx+radius+2); xx++){
        const i = idx(xx,yy,W);
        const dx = xx-cx, dy = yy-cy;
        const d = Math.sqrt(dx*dx+dy*dy);
        const wobble = gNoise(xx,yy, seed+606+k, 10) * 3.5;

        if (d < radius - wobble) {
          tiles[i] = TILE.DEEP_WATER;
          variants[i] |= 8; // lake bit
        } else if (d < radius + 2 - wobble && tiles[i] !== TILE.DEEP_WATER) {
          tiles[i] = TILE.SHALLOW;
          variants[i] |= 16; // shore bit
        }
      }
    }
  }

  // ── PASS C: Rivers (shallow threads) ────────────────────────
  const rivers = (worldId === "overworld_C") ? 1 : 2;
  for (let r=0;r<rivers;r++){
    let x = Math.floor(gNoise(200+r, 50+r, seed+707, 6) * W);
    let y = Math.floor(gNoise(300+r, 80+r, seed+808, 6) * H);

    for (let steps=0; steps<260; steps++){
      const i = idx(x,y,W);
      if (tiles[i] !== TILE.DEEP_WATER) {
        tiles[i] = TILE.SHALLOW;
        variants[i] |= 4; // river bit
      }

      // stop at edge
      if (x<=0 || y<=0 || x>=W-1 || y>=H-1) break;

      const curH = gNoise(x,y, seed+909, 28);
      let best = null, bestVal = 999;

      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x+dx, ny = y+dy;
        if (!inb(nx,ny,W,H)) continue;
        const nh = gNoise(nx,ny, seed+909, 28);
        const meander = gNoise(nx,ny, seed+1001, 10) * 0.15;
        const score = (nh - curH) + meander;
        if (score < bestVal) { bestVal = score; best = [nx,ny]; }
      }
      if (!best) break;
      x = best[0]; y = best[1];
    }
  }

  // ── PASS D: Town placement (1 per world) ────────────────────
  const towns = [];
  let placed = 0;

  for (let tries=0; tries<900 && placed<1; tries++){
    const x = Math.floor(gNoise(111+tries, 222+tries, seed+1102, 6) * W);
    const y = Math.floor(gNoise(333+tries, 444+tries, seed+1203, 6) * H);
    const i = idx(x,y,W);

    if (x<6 || y<6 || x>W-7 || y>H-7) continue;
    const t = tiles[i];
    if (t===TILE.DEEP_WATER || t===TILE.SHALLOW || t===TILE.MOUNTAIN) continue;

    tiles[i] = TILE.TOWN;
    variants[i] |= 2;
    towns.push({ x, y });
    placed++;
  }

  // ── PASS E: Dungeon marker (Phase 1) ────────────────────────
  // Uses DANGER tile + variants bit (engine can ignore for now)
  const portals = [];
  for (let tries=0; tries<1200 && portals.length<1; tries++){
    const x = Math.floor(gNoise(555+tries, 666+tries, seed+1404, 6) * W);
    const y = Math.floor(gNoise(777+tries, 888+tries, seed+1505, 6) * H);
    const i = idx(x,y,W);

    if (x<8 || y<8 || x>W-9 || y>H-9) continue;
    const t = tiles[i];
    if (t===TILE.DEEP_WATER || t===TILE.SHALLOW || t===TILE.MOUNTAIN || t===TILE.TOWN) continue;

    tiles[i] = TILE.DANGER;
    variants[i] |= 64;
    portals.push({ x, y, kind:"dungeon" });
    break;
  }

  // ── PASS F: Roads (tile-based, biome-matched) ───────────────
  // Connect town -> portal (or town -> center)
  const roadTile = roadTileForWorld();
  for (const town of towns) {
    const target = portals[0] || { x: Math.floor(W/2), y: Math.floor(H/2) };

    let x = town.x, y = town.y;
    for (let s=0; s<800; s++){
      const i = idx(x,y,W);
      if (tiles[i] !== TILE.DEEP_WATER && tiles[i] !== TILE.MOUNTAIN && tiles[i] !== TILE.TOWN) {
        tiles[i] = roadTile;
        variants[i] |= 128;
      }
      if (x === target.x && y === target.y) break;
      if (x < target.x) x++; else if (x > target.x) x--;
      if (y < target.y) y++; else if (y > target.y) y--;
    }
  }

  return {
    towns,
    portals,
    metadata: { seed, worldId, phase: 1 }
  };
}

// ── DEV / CONSOLE HOOKS ──────────────────────────────────────
if (typeof window !== "undefined") {
  window.__generateOverworldTiles = generateOverworldTiles;
  window.__generateOverworldWorld = generateOverworldWorld;
  globalThis.__generateOverworldTiles = generateOverworldTiles;
  globalThis.__generateOverworldWorld = generateOverworldWorld;
  console.log("✅ overworldGenerator hooks exposed:", {
    __generateOverworldTiles: typeof window.__generateOverworldTiles,
    __generateOverworldWorld: typeof window.__generateOverworldWorld
  });
}
