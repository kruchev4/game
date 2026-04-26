/**
 * isWalkable.js
 *
 * Returns true if the given tile ID is passable.
 * Using a direct Set for O(1) lookup — faster than object property access
 * and easier to maintain than editing individual tile definitions.
 */

const PASSABLE = new Set([
  // Core terrain
  0,   // void / empty (walkable for now — world edges)
     // grass
  4,   // path / dirt road
  5,   // cobblestone road
  6,   // bridge
  7,   // shallow water / ford
  

  // Overworld expansion tiles
  15, 16, 17, 18, 19,

  // Dungeon tiles
  9, 10, 11, 12, 13,

  // Town interior passables
  20, 22, 23, 24, 25, 26,
  27, 28, 29, 30, 31, 32, 33, 35,
]);

/**
 * @param {number|null|undefined} tileId
 * @returns {boolean}
 */
export function isWalkable(tileId) {
  if (tileId == null) return false;
  return PASSABLE.has(tileId);
}
