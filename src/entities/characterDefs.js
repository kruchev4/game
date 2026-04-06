// src/entities/characterDefs.js

export const CHARACTERS = {
  player: {
    rig: "humanoid",

    body: {
      type: "human",
      build: "medium" // light | medium | heavy
    },

    armor: "cloth_basic",
    headgear: null,
    weapon: "sword_short",

    palette: "player_default"
  },

  hero_test: {
    rig: "humanoid",
    body: { type: "human", build: "heavy" },
    armor: "leather",
    weapon: "axe",
    palette: "hero"
  }
};
``
