// game/Echoes/world/worldNeighbors.js
export const WORLD_NEIGHBORS = {
  overworld_C:  { N: "overworld_N",  S: "overworld_S",  E: "overworld_E",  W: "overworld_W" },

  overworld_N:  { S: "overworld_C",  E: "overworld_NE", W: "overworld_NW" },
  overworld_S:  { N: "overworld_C",  E: "overworld_SE", W: "overworld_SW" },
  overworld_E:  { W: "overworld_C",  N: "overworld_NE", S: "overworld_SE" },
  overworld_W:  { E: "overworld_C",  N: "overworld_NW", S: "overworld_SW" },

  overworld_NE: { W: "overworld_N",  S: "overworld_E" },
  overworld_NW: { E: "overworld_N",  S: "overworld_W" },
  overworld_SE: { W: "overworld_S",  N: "overworld_E" },
  overworld_SW: { E: "overworld_S",  N: "overworld_W" }
};
