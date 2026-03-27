// game/engine/camera/camera.js

import { GameState } from "../state/GameState.js";

export function updateCamera() {
  const cam = GameState.camera;
  const p = GameState.player;

  cam.x = p.x * GameState.TILE - cam.w / 2 + GameState.TILE / 2;
  cam.y = p.y * GameState.TILE - cam.h / 2 + GameState.TILE / 2;

  if (cam.x < 0) cam.x = 0;
  if (cam.y < 0) cam.y = 0;
}