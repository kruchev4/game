// game/engine/world/constants.js

export const TILE = {
  GRASS:      0,
  FOREST:     1,
  MOUNTAIN:   2,
  DEEP_WATER: 3,
  SHALLOW:    4,
  TOWN:       5,
  DANGER:     6,
  SAND:       7,
  // Dungeon tiles
  WALL:       8,
  FLOOR:      9,
  DOOR:       10,
  CHEST:      11,
  STAIRS_UP:  12,
  STAIRS_DOWN:13,
  PORTAL:     14,
  
// ── NEW EXPANSION WORLD TILES ──────────────────────
  JUNGLE:     15,  // dense, dangerous movement
  VOLCANO:    16,  // damage over time
  ELDRITCH:   17,  // sanity / fear
  OBSIDIAN:   18,  // volcanic rock
  BLIGHT:     19,  // corruption / decay

};

// Each entry: [base color, optional highlight color]
// base color is what fills the tile
// highlight is used for variant rendering (future)
export const TILE_COLORS = {
  // ── World tiles ───────────────────────────────────────────────────────────
  [TILE.GRASS]:      ["#3a6b30", "#4a8a3a"],  // green grasslands
  [TILE.FOREST]:     ["#1e4a1a", "#2a5e20"],  // dark forest
  [TILE.MOUNTAIN]:   ["#5a4e3a", "#6a5e4a"],  // grey-brown mountains
  [TILE.DEEP_WATER]: ["#1a3f6b", "#1e4a80"],  // deep blue water
  [TILE.SHALLOW]:    ["#2a6080", "#3a7090"],  // lighter shallow water
  [TILE.TOWN]:       ["#c9a227", "#d4b040"],  // gold town marker
  [TILE.DANGER]:     ["#6b1a1a", "#8b2a2a"],  // dark red danger zone
  [TILE.SAND]:       ["#c8a870", "#d4b880"],  // sandy wastes

  // ── Dungeon tiles ─────────────────────────────────────────────────────────
  [TILE.WALL]:       ["#1f1f2a", "#2a2a3a"],  // dark dungeon wall
  [TILE.FLOOR]:      ["#3a3028", "#4a4038"],  // stone floor
  [TILE.DOOR]:       ["#8b5e1a", "#a06a20"],  // wooden door
  [TILE.CHEST]:      ["#c9a227", "#e0b830"],  // gold chest
  [TILE.STAIRS_UP]:  ["#6080a0", "#7090b0"],  // stairs up
  [TILE.STAIRS_DOWN]:["#405060", "#506070"],  // stairs down
  [TILE.PORTAL]:     ["#8040cc", "#9050dd"],  // campaign portal
  
  // (existing entries unchanged)

  // ── Expansion tiles ───────────────────────────────
  [TILE.JUNGLE]:   ["#0f3b1f", "#16502a"],  // deep overgrowth
  [TILE.VOLCANO]:  ["#7a1a0a", "#b02010"],  // burning lava
  [TILE.ELDRITCH]: ["#32134d", "#4a1f73"],  // unnatural purple
  [TILE.OBSIDIAN]: ["#1a1a1a", "#303030"],  // glass-black rock
  [TILE.BLIGHT]:   ["#3a2a1a", "#5a3a2a"],  // dead corruption
};

window.TOWN_TILE_COLORS = {
    20: '#6a6058',  // floor - stone
    21: '#1e1810',  // wall  - dark
    22: '#7a5030',  // inn   - warm brown
    23: '#1a3a5a',  // shop  - blue
    24: '#4a2a6a',  // temple - purple
    25: '#3a2808',  // tavern - dark wood
    26: '#1a3a1a',  // vendor - dark green
    27: '#102a2a',  // craft  - teal
    28: '#1a4a1a',  // exit   - green
    29: '#252015',  // deco   - stone grey
  };
 window.TOWN_TILE_ICONS = {
    22: '🏨', 23: '⚒', 24: '✝', 25: '🍺', 26: '💰', 27: '⚗', 28: '🌍'
  };
 
  // Town tile passability for BFS pathfinding click-to-move
  window.TOWN_PASSABLE_SET = TOWN_PASSABLE;

export const PASSABLE = new Set([
  TILE.GRASS,
  TILE.FOREST,
  TILE.SAND,
  TILE.SHALLOW,
  TILE.TOWN,
  TILE.DANGER,
  TILE.FLOOR,
  TILE.DOOR,
  TILE.STAIRS_UP,
  TILE.STAIRS_DOWN,
  TILE.PORTAL,
  
TILE.JUNGLE,
  TILE.VOLCANO,
  TILE.ELDRITCH,
  TILE.OBSIDIAN,
  TILE.BLIGHT,

  
]);
export const TILE_EFFECTS = {
  [TILE.JUNGLE]: {
    moveCost: 3,
    encounterBias: 0.15,
    description: "Dense vegetation limits visibility."
  },

  [TILE.VOLCANO]: {
    moveCost: 2,
    damagePerTurn: 10,
    description: "Extreme heat scorches the unprepared."
  },

  [TILE.ELDRITCH]: {
    moveCost: 2,
    sanityCheck: true,
    encounterBias: 0.25,
    description: "Reality feels unstable here."
  },

  [TILE.OBSIDIAN]: {
    moveCost: 2,
    heat: true,
    description: "Volcanic glass crunches underfoot."
  },

  [TILE.BLIGHT]: {
    moveCost: 2,
    debuff: "corruption",
    encounterBias: 0.2,
    description: "The land itself decays."
  }
};

export function getMoveCost(tileId) {
  return TILE_EFFECTS[tileId]?.moveCost ?? 1;
}
export function applyWorldTileEffects(player, tileId) {
  const effect = TILE_EFFECTS[tileId];
  if (!effect) return;

  if (effect.damagePerTurn) {
    player.hp = Math.max(0, player.hp - effect.damagePerTurn);
  }

  if (effect.debuff) {
    applyDebuff(player, effect.debuff);
  }

  if (effect.sanityCheck) {
    triggerSanityEvent(player);
  }
}
export function getTileEncounterBias(tileId) {
  return TILE_EFFECTS[tileId]?.encounterBias ?? 0;
}
