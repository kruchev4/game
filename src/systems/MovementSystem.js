import { isWalkable } from "../world/isWalkable.js";

export class MovementSystem {
  constructor({ world, player }) {
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
    if (this.player) this.player.moveTarget = this.target; // for optional rendering
  }

  clearTarget() {
    this.target = null;
    if (this.player) this.player.moveTarget = null;
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
    if (this.target) {
      if (this._stepTowardTarget()) this.lastMoveTime = now;
    }
  }

  _getKeyboardStep() {
    let dx = 0, dy = 0;

    if (this.keys.has("w") || this.keys.has("arrowup")) dy = -1;
    else if (this.keys.has("s") || this.keys.has("arrowdown")) dy = 1;
    else if (this.keys.has("a") || this.keys.has("arrowleft")) dx = -1;
    else if (this.keys.has("d") || this.keys.has("arrowright")) dx = 1;

    if (dx === 0 && dy === 0) return null;
    return { dx, dy };
  }

  _stepTowardTarget() {
    const tx = this.target.x;
    const ty = this.target.y;

    // arrived?
    if (this.player.x === tx && this.player.y === ty) {
      this.clearTarget();
      return false;
    }

    const dxFull = tx - this.player.x;
    const dyFull = ty - this.player.y;

    const sx = Math.sign(dxFull);
    const sy = Math.sign(dyFull);

    // prefer moving on the axis with the larger remaining distance
    const first = Math.abs(dxFull) >= Math.abs(dyFull) ? { dx: sx, dy: 0 } : { dx: 0, dy: sy };
    const second = first.dx !== 0 ? { dx: 0, dy: sy } : { dx: sx, dy: 0 };

    // Try primary axis; if blocked, try secondary; if both blocked, give up.
    if (first.dx !== 0 || first.dy !== 0) {
      if (this._tryStep(first.dx, first.dy)) return true;
    }
    if (second.dx !== 0 || second.dy !== 0) {
      if (this._tryStep(second.dx, second.dy)) return true;
    }

    // stuck (no pathing yet)
    this.clearTarget();
    return false;
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
