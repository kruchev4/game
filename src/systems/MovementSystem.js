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
    // Isometric WASD mapping:
    // In isometric view, "north" on screen is up-left (W) and up-right (D)
    //   W = NW face  (-x, -y ... actually -1,0 in screen feel)
    //   D = NE face
    //   S = SE face
    //   A = SW face
    // Diagonals give true cardinal directions:
    //   W+D = North, S+A = South, W+A = West, S+D = East
    const w = this.keys.has("w") || this.keys.has("arrowup");
    const s = this.keys.has("s") || this.keys.has("arrowdown");
    const a = this.keys.has("a") || this.keys.has("arrowleft");
    const d = this.keys.has("d") || this.keys.has("arrowright");

    let dx = 0, dy = 0;

    // Each key contributes to one iso axis
    if (w) { dx -= 1; dy -= 1; }  // NW on screen = (-1,-1)
    if (s) { dx += 1; dy += 1; }  // SE on screen = (+1,+1)
    if (a) { dx -= 1; dy += 1; }  // SW on screen = (-1,+1)
    if (d) { dx += 1; dy -= 1; }  // NE on screen = (+1,-1)

    // Clamp to -1/0/1
    dx = Math.sign(dx);
    dy = Math.sign(dy);

    if (dx === 0 && dy === 0) return null;
    return { dx, dy };
  }

  

  _tryStep(dx, dy) {
    if (dx === 0 && dy === 0) return false;

    const nx = this.player.x + dx;
    const ny = this.player.y + dy;

    // Try diagonal first
    if (nx >= 0 && ny >= 0 && nx < this.world.width && ny < this.world.height) {
      if (isWalkable(this.world.getTile(nx, ny))) {
        this.player.x = nx;
        this.player.y = ny;
        return true;
      }
    }

    // Fall back to single axis if diagonal blocked
    if (dx !== 0 && dy !== 0) {
      const nx1 = this.player.x + dx;
      const ny1 = this.player.y;
      const nx2 = this.player.x;
      const ny2 = this.player.y + dy;
      if (nx1 >= 0 && nx1 < this.world.width && isWalkable(this.world.getTile(nx1, ny1))) {
        this.player.x = nx1; return true;
      }
      if (ny2 >= 0 && ny2 < this.world.height && isWalkable(this.world.getTile(nx2, ny2))) {
        this.player.y = ny2; return true;
      }
    }

    return false;
  }
}
