// game/engine/movement/clickHandler.js

import { bfsPath } from "./pathfinding.js";
import { tryMove } from "./movement.js";
import { GameState } from "../state/GameState.js";

export function handleCanvasClick(cx, cy) {
  const map = GameState.activeMap;
  const cam = GameState.camera;
  const player = GameState.player;

  // Convert screen → tile
  const tx = Math.floor((cx + cam.x) / GameState.TILE);
  const ty = Math.floor((cy + cam.y) / GameState.TILE);

  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return;

  const path = bfsPath(map, player.x, player.y, tx, ty);

  if (!path) return;

  // Smooth click-move (like your old startClickPath)
  GameState.clickPath = path;
}