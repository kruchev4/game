// src/world/tileProperties.js
import { TILE } from "./constants.js";

export const TILE_PROPERTIES = {
  [TILE.GRASS]: {
    moveCost: 1,
    encounterBias: 0,
    description: "Open grassland."
  },

  [TILE.FOREST]: {
    moveCost: 2,
    encounterBias: 0.1,
    visionPenalty: true,
    description: "Dense forest limits visibility."
  },

  [TILE.SAND]: {
    moveCost: 2,
    encounterBias: 0.05,
    fatigue: true,
    description: "Hot sand drains endurance."
  },

  [TILE.DANGER]: {
    moveCost: 1,
    encounterBias: 0.3,
    eliteSpawnChance: 0.2,
    description: "Something dangerous lurks here."
  },

  // ✅ Expansion tiles
  [TILE.JUNGLE]: {
    moveCost: 3,
    encounterBias: 0.2,
    ambushChance: 0.15,
    visionPenalty: true,
  },

  [TILE.VOLCANO]: {
    moveCost: 2,
    damagePerTurn: 10,
    fireDamage: true,
  },

  [TILE.ELDRITCH]: {
    moveCost: 2,
    encounterBias: 0.35,
    sanityCheck: true,
  },

  [TILE.OBSIDIAN]: {
    moveCost: 2,
    fireResistBonus: true,
  },

  [TILE.BLIGHT]: {
    moveCost: 2,
    encounterBias: 0.25,
    corruption: true,
  },
};
