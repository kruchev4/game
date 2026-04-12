import { TILES } from "../data/tiles.js";

export function getTileDef(tileId) {
  return TILES[tileId] ?? TILES[0];
}
