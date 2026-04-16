/**
 * tiles.js — Tile data definitions
 *
 * Pure data — no draw functions.
 * Draw functions live in tilePainters.js.
 *
 * Tile ID map:
 *   0  GRASS       8  WALL        16 VOLCANO    24 TEMPLE
 *   1  FOREST      9  FLOOR       17 ELDRITCH   25 TAVERN
 *   2  MOUNTAIN    10 STAIRS_UP   18 OBSIDIAN   26 VENDOR
 *   3  DEEP_WATER  11 STAIRS_DOWN 19 BLIGHT     27 ROAD_DIRT
 *   4  SHALLOW     12 DOOR        20 TOWN_FLOOR 28 ROAD_STONE
 *   5  TOWN        13 CHEST       21 TOWN_WALL  29 ROAD_OBSIDIAN
 *   6  DANGER      14 PORTAL      22 INN        30 ROAD_BLIGHT
 *   7  SAND        15 JUNGLE      23 SHOP       31 ROAD_RUNIC
 */

export const TILES = {
  // ── World ──────────────────────────────────────────────────────────────
  0:  { color: "#3a6b30", walkable: true,  type: "grass"        },
  1:  { color: "#1e4a1a", walkable: false, type: "forest"       },
  2:  { color: "#5a4e3a", walkable: false, type: "mountain"     },
  3:  { color: "#1a3f6b", walkable: false, type: "deep_water"   },
  4:  { color: "#2a6080", walkable: true,  type: "shallow"      },
  5:  { color: "#c9a227", walkable: true,  type: "town"         },
  6:  { color: "#6b1a1a", walkable: true,  type: "danger"       },
  7:  { color: "#c8a870", walkable: true,  type: "sand"         },
  // ── Dungeon ────────────────────────────────────────────────────────────
  8:  { color: "#151520", walkable: false, type: "wall"         },
  9:  { color: "#262018", walkable: true,  type: "floor"        },
  10: { color: "#6080a0", walkable: true,  type: "stairs_up"    },
  11: { color: "#405060", walkable: true,  type: "stairs_down"  },
  12: { color: "#8b5e1a", walkable: true,  type: "door"         },
  13: { color: "#c9a227", walkable: true,  type: "chest"        },
  14: { color: "#8040cc", walkable: true,  type: "portal"       },
  // ── Expansion world ────────────────────────────────────────────────────
  15: { color: "#0f3b1f", walkable: true,  type: "jungle"       },
  16: { color: "#7a1a0a", walkable: false, type: "volcano"      },
  17: { color: "#32134d", walkable: true,  type: "eldritch"     },
  18: { color: "#1a1a1a", walkable: false, type: "obsidian"     },
  19: { color: "#3a2a1a", walkable: true,  type: "blight"       },
  // ── Town interior ──────────────────────────────────────────────────────
  20: { color: "#6a6058", walkable: true,  type: "town_floor"   },
  21: { color: "#1e1810", walkable: false, type: "town_wall"    },
  22: { color: "#7a5030", walkable: true,  type: "inn"          },
  23: { color: "#1a3a5a", walkable: true,  type: "shop"         },
  24: { color: "#4a2a6a", walkable: true,  type: "temple"       },
  25: { color: "#3a2808", walkable: true,  type: "tavern"       },
  26: { color: "#1a3a1a", walkable: true,  type: "vendor"       },
  // ── Roads ──────────────────────────────────────────────────────────────
  27: { color: "#8b6a44", walkable: true,  type: "road_dirt"    },
  28: { color: "#7c7f86", walkable: true,  type: "road_stone"   },
  29: { color: "#1b1b22", walkable: true,  type: "road_obsidian"},
  30: { color: "#3a2f2f", walkable: true,  type: "road_blight"  },
  31: { color: "#0f0f18", walkable: true,  type: "road_runic"   },
  // ── Town exit / deco ───────────────────────────────────────────────────
  32: { color: "#1a4a1a", walkable: true,  type: "town_exit"    },
  33: { color: "#5a3a18", walkable: true,  type: "road_bridge"  },
  35: { color: "#7a6848", walkable: true,  type: "road_path"    },
  // ── Isometric town/dungeon tiles (Kenney assets) ───────────────────────
  40: { color: "#888870", walkable: true,  type: "stone_tile"   },  // clean stone
  41: { color: "#7a6040", walkable: true,  type: "planks"       },  // wooden planks
  42: { color: "#6a5030", walkable: true,  type: "dirt_floor"   },  // dirt floor
  43: { color: "#606060", walkable: true,  type: "stone_rough"  },  // rough stone
  44: { color: "#808070", walkable: true,  type: "stone_inset"  },  // decorative stone
  45: { color: "#707060", walkable: true,  type: "stone_uneven" },  // uneven stone
  46: { color: "#605040", walkable: true,  type: "dirt_tiles"   },  // dirt variant
  47: { color: "#6a5535", walkable: true,  type: "plank_hole"   },  // damaged planks
  // Dungeon wall — impassable
  48: { color: "#202020", walkable: false, type: "dungeon_wall"  },
};

/**
 * getTileDef — used by TileFactory
 * Returns the tile definition for a given tile ID.
 * Falls back to tile 0 (grass) if not found.
 */
export function getTileDef(tileId) {
  return TILES[tileId] ?? TILES[0];
}
