// src/entities/npcDefs.js

export const NPCS = {
  villager: {
    rig: "humanoid",
    body: { type: "human", build: "light" },
    armor: "cloth_simple",
    weapon: null,
    palette: "npc_warm"
  },

  townGuard: {
    rig: "humanoid",
    body: { type: "human", build: "heavy" },
    armor: "chain",
    weapon: "spear",
    palette: "npc_metal"
  }
};
