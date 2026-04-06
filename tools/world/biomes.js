// src/world/biomes.js
import { TILE } from "./constants.js";

export const BIOMES = {
  heartlands: {
    base: TILE.GRASS,
    noise: [
      [TILE.FOREST, 0.25],
      [TILE.SAND,   0.10],
      [TILE.DANGER, 0.05],
    ],
  },

  witchwood: {
    base: TILE.FOREST,
    noise: [
      [TILE.ELDRITCH, 0.20],
      [TILE.DANGER,   0.15],
    ],
  },

  ashen_expanse: {
    base: TILE.OBSIDIAN,
    noise: [
      [TILE.VOLCANO, 0.35],
      [TILE.DANGER,  0.25],
    ],
  },

  ember_jungle: {
    base: TILE.JUNGLE,
    noise: [
      [TILE.VOLCANO, 0.20],
      [TILE.DANGER,  0.15],
    ],
  },

  blightreach: {
    base: TILE.BLIGHT,
    noise: [
      [TILE.SHALLOW, 0.20],
      [TILE.DANGER,  0.30],
    ],
  },

  drowned_jungle: {
    base: TILE.JUNGLE,
    noise: [
      [TILE.SHALLOW, 0.35],
      [TILE.BLIGHT,  0.20],
    ],
  },

  eldritch_tundra: {
    base: TILE.MOUNTAIN,
    noise: [
      [TILE.ELDRITCH, 0.30],
      [TILE.DANGER,   0.10],
    ],
  },

  sky_ruins: {
    base: TILE.MOUNTAIN,
    noise: [
      [TILE.ELDRITCH, 0.25],
      [TILE.MOUNTAIN, 0.25],
    ],
  },

  frozen_peaks: {
    base: TILE.MOUNTAIN,
    noise: [
      [TILE.ELDRITCH, 0.20],
      [TILE.DANGER,   0.10],
    ],
  },
};
