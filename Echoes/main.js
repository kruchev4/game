import { loadMap } from "./engine/supabase/mapLoader.js";
import { GameState } from "./engine/state/GameState.js";
import { renderMap } from "./engine/render/renderer.js";
import { updateCamera } from "./engine/camera/camera.js";
import { tryMove } from "./engine/movement/movement.js";

let ctx;

async function initGame() {
  // get canvas & context
  const canvas = document.getElementById("world-cv");
  ctx = canvas.getContext("2d");

  GameState.camera.w = canvas.width;
  GameState.camera.h = canvas.height;

  // Load overworld from Supabase
  GameState.activeMap = await loadMap("overworld_01");

  setupInput();
  gameLoop();
}

function setupInput() {
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") tryMove(0, -1);
    if (e.key === "ArrowDown") tryMove(0, 1);
    if (e.key === "ArrowLeft") tryMove(-1, 0);
    if (e.key === "ArrowRight") tryMove(1, 0);
  });

  // Click-to-move handled separately
}

function gameLoop() {
  updateCamera();
  renderMap(ctx, GameState.activeMap, GameState.camera);

  if (GameState.clickPath.length > 0) {
    const [nx, ny] = GameState.clickPath.shift();
    tryMove(nx - GameState.player.x, ny - GameState.player.y);
  }

  requestAnimationFrame(gameLoop);
}

initGame();