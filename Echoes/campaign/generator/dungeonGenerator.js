// campaign/generator/dungeonGenerator.js

// ─────────────────────────────────────────────
// Deterministic RNG
// ─────────────────────────────────────────────
function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min)) + min;
}
function choice(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// ─────────────────────────────────────────────
// Themes & Difficulty
// ─────────────────────────────────────────────
const THEMES = {
  forest:  { floor: 9, accent: [11, 12], water: 10, rubble: 13, monsters: ["wolf", "spider", "treant_sprout", "bandit"] },
  cavern:  { floor: 9, accent: [13, 12], water: 10, rubble: 13, monsters: ["slime", "bat", "spider", "ogre"] },
  crypt:   { floor: 9, accent: [12, 13], water: 10, rubble: 13, monsters: ["skeleton", "zombie", "wraith", "necromancer"] },
  ruins:   { floor: 9, accent: [13, 11], water: 10, rubble: 13, monsters: ["bandit", "cultist", "rogue", "assassin"] },
  frost:   { floor: 9, accent: [12],     water: 10, rubble: 13, monsters: ["ice_spirit", "wolf_white", "yeti", "wraith_ice"] },
  magma:   { floor: 9, accent: [13],     water: 10, rubble: 13, monsters: ["fire_imp", "lava_elemental", "salaman", "cultist_fire"] }
};

const DIFFICULTY = {
  easy:    { roomCount:[6,9],  enemyMult: 0.6, boss: false,  lootTier: "I"  },
  normal:  { roomCount:[8,11], enemyMult: 1.0, boss: false,  lootTier: "II" },
  hard:    { roomCount:[9,13], enemyMult: 1.3, boss: true,   lootTier: "III"},
  elite:   { roomCount:[10,14],enemyMult: 1.6, boss: true,   lootTier: "IV" },
  mythic:  { roomCount:[12,16],enemyMult: 2.0, boss: true,   lootTier: "V"  }
};

// ─────────────────────────────────────────────
// Loot Tables (per difficulty tier)
// ─────────────────────────────────────────────
const LOOT_TABLES = {
  I:   [{id:"potion_small",w:6},{id:"arrow_bundle",w:5},{id:"coin_purse",w:4},{id:"herbs",w:3}],
  II:  [{id:"potion_medium",w:6},{id:"bomb_small",w:3},{id:"coin_satchel",w:5},{id:"oak_wand",w:2}],
  III: [{id:"potion_large",w:5},{id:"bomb_bundle",w:3},{id:"rare_gem",w:2},{id:"steel_blade",w:2}],
  IV:  [{id:"elixir",w:4},{id:"phoenix_down",w:2},{id:"arcane_focus",w:2},{id:"dragonsteel",w:1}],
  V:   [{id:"mythic_elixir",w:2},{id:"soulstone",w:1},{id:"relic_fragment",w:1},{id:"legendary_core",w:1}]
};
function weightedChoice(rng, entries) {
  const total = entries.reduce((a,e)=>a+e.w,0);
  let r = rng()*total;
  for (const e of entries) {
    if ((r -= e.w) <= 0) return e.id;
  }
  return entries[entries.length-1].id;
}

// ─────────────────────────────────────────────
// Dungeon Generation
// ─────────────────────────────────────────────
function carveRoom(tiles, width, x, y, w, h, floorId) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      tiles[yy * width + xx] = floorId;
    }
  }
}
function digCorridor(tiles, width, x1, y1, x2, y2, floorId, rng) {
  // L-shaped with small jitter
  if (rng() < 0.5) {
    while (x1 !== x2) { tiles[y1*width + x1] = floorId; x1 += Math.sign(x2 - x1); }
    while (y1 !== y2) { tiles[y1*width + x1] = floorId; y1 += Math.sign(y2 - y1); }
  } else {
    while (y1 !== y2) { tiles[y1*width + x1] = floorId; y1 += Math.sign(y2 - y1); }
    while (x1 !== x2) { tiles[y1*width + x1] = floorId; x1 += Math.sign(x2 - x1); }
  }
}
function addAccents(tiles, width, height, theme, rng) {
  // sprinkle water/roots/moss/rubble lightly
  const count = Math.floor((width * height) * 0.02);
  for (let i = 0; i < count; i++) {
    const x = randInt(rng, 1, width-1);
    const y = randInt(rng, 1, height-1);
    const idx = y * width + x;
    if (tiles[idx] === theme.floor && rng() < 0.25 && theme.accent?.length) {
      tiles[idx] = choice(rng, theme.accent);
    }
    if (tiles[idx] === theme.floor && rng() < 0.02) {
      tiles[idx] = theme.water;
    }
  }
}
function farthestRoom(rooms) {
  // return room farthest from rooms[0]
  const a = rooms[0];
  let best = a, bestD = -1;
  for (const r of rooms) {
    const d = (r.cx - a.cx)**2 + (r.cy - a.cy)**2;
    if (d > bestD) { best = r; bestD = d; }
  }
  return best;
}
function spawnMonsters(rng, rooms, theme, difficulty) {
  const out = [];
  for (let i = 1; i < rooms.length; i++) {
    const room = rooms[i];
    const density = Math.max(1, Math.round((room.w * room.h)/16 * difficulty.enemyMult));
    for (let k = 0; k < density; k++) {
      out.push({
        x: randInt(rng, room.x, room.x + room.w),
        y: randInt(rng, room.y, room.y + room.h),
        type: choice(rng, theme.monsters),
        alive: true
      });
    }
  }
  if (difficulty.boss) {
    const br = rooms[rooms.length - 1];
    out.push({ x: br.cx, y: br.cy, type: bossForTheme(theme), alive: true, isBoss: true });
  }
  return out;
}
function bossForTheme(theme) {
  // very simple mapping
  for (const [k,v] of Object.entries(THEMES)) {
    if (v === theme) {
      switch (k) {
        case "forest": return "treant_elder";
        case "crypt":  return "lich";
        case "cavern": return "ogre_chief";
        case "ruins":  return "assassin_lord";
        case "frost":  return "ice_tyrant";
        case "magma":  return "flame_titan";
      }
    }
  }
  return "goblin_king";
}

export function generateDungeon({
  id,
  name,
  width = 60,
  height = 60,
  roomCount,          // optional; derived from difficulty if not provided
  theme = "cavern",   // forest | cavern | crypt | ruins | frost | magma
  difficulty = "normal",
  seed = `${Date.now()}_${Math.random()}`
}) {
  const rng = mulberry32(hashSeed(seed));
  const themeDef = THEMES[theme] ?? THEMES.cavern;
  const diffDef  = DIFFICULTY[difficulty] ?? DIFFICULTY.normal;

  // Derive room count by difficulty if unspecified
  const rc = roomCount ?? randInt(rng, diffDef.roomCount[0], diffDef.roomCount[1]+1);

  // Fill with walls
  const tiles = new Array(width * height).fill(8);
  const rooms = [];

  // Generate rooms
  for (let i = 0; i < rc; i++) {
    const w = randInt(rng, 4, 11);
    const h = randInt(rng, 4, 9);
    const x = randInt(rng, 2, width - w - 2);
    const y = randInt(rng, 2, height - h - 2);
    carveRoom(tiles, width, x, y, w, h, themeDef.floor);
    const cx = Math.floor(x + w/2), cy = Math.floor(y + h/2);
    rooms.push({ x, y, w, h, cx, cy });

    // Connect to previous
    if (i > 0) {
      const prev = rooms[i-1];
      digCorridor(tiles, width, prev.cx, prev.cy, cx, cy, themeDef.floor, rng);
    }
  }

  // Accents
  addAccents(tiles, width, height, themeDef, rng);

  // Entry / Exit
  const entryRoom = rooms[0];
  const exitRoom  = farthestRoom(rooms);
  const entry = { x: entryRoom.cx, y: entryRoom.cy };
  const exit  = { x: exitRoom.cx,  y: exitRoom.cy  };

  // Monsters
  const monsters = spawnMonsters(rng, rooms, themeDef, diffDef);

  // Attach lightweight per-dungeon loot hint (drop table tier)
  const lootHint = diffDef.lootTier;

  // Final JSON
  const map = {
    id, name, type: "dungeon",
    width, height, tiles,
    rooms, entry, exit,
    monsters,
    lootTier: lootHint,
    returnMap: "overworld_generated"
  };

  // Quick sanity check to avoid engine crashes
  if (tiles.length !== width * height) {
    throw new Error(`[generateDungeon] tiles mismatch ${tiles.length} vs ${width*height}`);
  }
  return map;
}

// Convenience: roll one random loot item for a difficulty tier
export function rollDungeonLoot(rngSeed, tier="II") {
  const rng = mulberry32(hashSeed(rngSeed));
  return weightedChoice(rng, LOOT_TABLES[tier] ?? LOOT_TABLES.II);
}
