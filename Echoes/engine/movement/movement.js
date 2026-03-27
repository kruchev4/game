// game/engine/movement/movement.js

import { GameState } from "../state/GameState.js";
import { PASSABLE } from "../world/constants.js";
import { checkTileTriggers } from "../world/triggers.js";

export function tryMove(dx, dy) {
  const map = GameState.activeMap;
  const player = GameState.player;

  const nx = player.x + dx;
  const ny = player.y + dy;

  // Prevent out-of-bounds unless we want to allow wrapping
  if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) {
    return false;
  }

  // Collision check
  if (!PASSABLE.has(map.getTile(nx, ny))) {
    return false;
  }

  // Move player
  player.prevX = player.x;
  player.prevY = player.y;
  player.x = nx;
  player.y = ny;

  // Run triggers (towns, portals, encounters)
  checkTileTriggers(nx, ny);

  return true;
}