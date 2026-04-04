import { TILES } from "../data/tiles.js";

export function isWalkable(tileId) {
  const def = TILES[tileId];
  return def ? def.walkable === true : false;
}
