import { isWalkable } from "../world/isWalkable.js";
import { aStar } from "../pathfinding/aStar.js";

export class MovementSystem {
  constructor({ world, player }) {
    this.path = null; // array of {x,y}
    this.world = world;
    this.player = player;

    this.lastMoveTime = 0;
    this.moveDelay = 120;

    this.keys = new Set();
    this.target = null;

    this._bindInput();
  }

  _bindInput() {
    window.addEventListener("keydown", (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
  }

  
setTarget(x, y) {
  this.target = { x, y };
  if (this.player) this.player.moveTarget = this.target;

  const p = aStar(this.world, { x: this.player.x, y: this.player.y }, { x, y });
  if (!p || p.length === 0) {
    // unreachable or already there
    this.clearTarget();
    return;
  }

  this.path = p;
  if (this.player) this.player.movePath = p; // optional for rendering/debug
}


  clearTarget() {
  this.target = null;
  this.path = null;
  if (this.player) {
    this.player.moveTarget = null;
    this.player.movePath = null;
  }
}

  update() {
    if (!this.player || !this.world) return;

    const now = performance.now();
    if (now - this.lastMoveTime < this.moveDelay) return;

    // 1) If keyboard input is active, it overrides click-to-move
    const kbStep = this._getKeyboardStep();
    if (kbStep) {
      this.clearTarget();
      if (this._tryStep(kbStep.dx, kbStep.dy)) this.lastMoveTime = now;
      return;
    }

    // 2) Otherwise, if we have a click target, step toward it
    // follow A* path if present
if (this.path && this.path.length > 0) {
  const next = this.path.shift(); // {x,y}

  // Safety: if something became blocked later, cancel (future-proof)
  // (For now your world is static, so this is mostly defensive.)
  this.player.x = next.x;
  this.player.y = next.y;

  if (this.path.length === 0) {
    this.clearTarget();
  }

  this.lastMoveTime = now;
  return;
}
  }

  _getKeyboardStep() {
    let dx = 0, dy = 0;

    // Allow diagonal — check each axis independently
    if (this.keys.has("w") || this.keys.has("arrowup"))    dy = -1;
    if (this.keys.has("s") || this.keys.has("arrowdown"))  dy =  1;
    if (this.keys.has("a") || this.keys.has("arrowleft"))  dx = -1;
    if (this.keys.has("d") || this.keys.has("arrowright")) dx =  1;

    if (dx === 0 && dy === 0) return null;
    return { dx, dy };
  }

  

  _tryStep(dx, dy) {
    if (dx === 0 && dy === 0) return false;

    const nx = this.player.x + dx;
    const ny = this.player.y + dy;

    if (nx < 0 || ny < 0 || nx >= this.world.width || ny >= this.world.height) return false;

    const tileId = this.world.getTile(nx, ny);
    if (!isWalkable(tileId)) return false;

    this.player.x = nx;
    this.player.y = ny;
    return true;
  }
}
