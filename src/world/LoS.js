/**
 * LoS.js — Line of Sight
 *
 * Uses Bresenham's line algorithm to cast a ray between two world tiles.
 * Returns true if there is an unobstructed line of sight.
 *
 * Blocking is determined by the world's tile walkability — any non-walkable
 * tile (wall, mountain, water, etc.) blocks LoS. The start and end tiles
 * themselves are never checked (a unit standing in a tile can always see
 * from it and into the destination tile).
 *
 * Usage:
 *   import { hasLoS } from "../world/LoS.js";
 *   if (hasLoS(world, attacker, target)) { ... }
 */

import { isWalkable } from "./isWalkable.js";

/**
 * @param {object} world   - world object with getTile(x,y)
 * @param {{x:number, y:number}} a - origin tile
 * @param {{x:number, y:number}} b - destination tile
 * @returns {boolean}
 */
export function hasLoS(world, a, b) {
  let x0 = a.x, y0 = a.y;
  const x1 = b.x, y1 = b.y;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;

  let err = dx - dy;

  while (true) {
    // Reached destination — LoS is clear
    if (x0 === x1 && y0 === y1) return true;

    const e2 = 2 * err;

    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 <  dx) { err += dx; y0 += sy; }

    // Check intermediate tiles only (not origin or destination)
    if (x0 === x1 && y0 === y1) return true;

    if (!isWalkable(world.getTile(x0, y0))) return false;
  }
}

/**
 * Manhattan distance between two tiles.
 * Used for melee range checks (no LoS needed).
 */
export function manhattanDist(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Chebyshev distance — diagonals count as 1.
 * Useful for "within N tiles in any direction" checks.
 */
export function chebyshevDist(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * Returns true if `attacker` can reach `target` with a given ability.
 * Melee: adjacency only (Manhattan <= range), no LoS needed.
 * Ranged: distance check + LoS.
 *
 * @param {object} world
 * @param {object} attacker  - entity with {x, y}
 * @param {object} target    - entity with {x, y}
 * @param {object} ability   - ability def with {range, requiresLoS}
 */
export function inRange(world, attacker, target, ability) {
  const dist = manhattanDist(attacker, target);
  if (dist > ability.range) return false;
  if (ability.requiresLoS && !hasLoS(world, attacker, target)) return false;
  return true;
}
