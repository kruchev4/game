// src/world/overworldDefs.js
export const OVERWORLD_DEFS = {
  overworld_NW: { dx: -1, dy: -1, biome: "frozen_peaks" },
  overworld_N:  { dx:  0, dy: -1, biome: "eldritch_tundra" },
  overworld_NE: { dx:  1, dy: -1, biome: "sky_ruins" },

  overworld_W:  { dx: -1, dy:  0, biome: "witchwood" },
  overworld_C:  { dx:  0, dy:  0, biome: "heartlands" },
  overworld_E:  { dx:  1, dy:  0, biome: "ashen_expanse" },

  overworld_SW: { dx: -1, dy:  1, biome: "drowned_jungle" },
  overworld_S:  { dx:  0, dy:  1, biome: "blightreach" },
  overworld_SE: { dx:  1, dy:  1, biome: "ember_jungle" },
};
