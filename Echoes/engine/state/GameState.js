export const GameState = {
  TILE: 32,
  TILE_SIZE: 32, // alias — some files use TILE_SIZE, others use TILE

  // Active map (world or dungeon)
  activeMap: null,

  // Player state
  player: {
    x: 120,
    y: 90,
    prevX: 120,
    prevY: 90,
    hp: 100,
    mp: 50,
    xp: 0,
    level: 1,
    gold: 0,
    inventory: [],
    equipment: {},
  },

  // Flags for special modes
  mode: "world",   // "world" | "dungeon"
  inCombat: false,
  inTown: false,

  // Map transitions
  returnMap: null,
  returnX: 120,
  returnY: 90,

  // Interactive systems
  clickPath: [],

  // Camera (w/h get set to canvas size in startEngine)
  camera: {
    x: 0,
    y: 0,
    w: 960,
    h: 720,
  },

  // Dungeon progression
  dungeonState: null,
};

// Global bridge for legacy code
window.GameState = GameState;
