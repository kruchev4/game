import { isWalkable } from "../world/isWalkable.js";

export class MovementSystem {
  constructor({ world, player }) {
    this.world = world;
    this.player = player;

    // movement pacing (keep what feels good)
    this.lastMoveTime = 0;
    this.moveDelay = 120; // ms per step (adjust if needed)

    this.keys = new Set();
    this._bindInput();
  }

  _bindInput() {
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.key.toLowerCase());
    });

    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
  }

  update() {
    if (!this.player || !this.world) return;

    // throttle movement so holding a key doesn't fly across the map
    const now = performance.now();
    if (now - this.lastMoveTime < this.moveDelay) return;

    let dx = 0;
    let dy = 0;

    // WASD + arrows
    if (this.keys.has("w") || this.keys.has("arrowup")) dy = -1;
    else if (this.keys.has("s") || this.keys.has("arrowdown")) dy = 1;
    else if (this.keys.has("a") || this.keys.has("arrowleft")) dx = -1;
    else if (this.keys.has("d") || this.keys.has("arrowright")) dx = 1;

    // no input → no move
    if (dx === 0 && dy === 0) return;

    const nx = this.player.x + dx;
    const ny = this.player.y + dy;

    // bounds check
    if (nx < 0 || ny < 0 || nx >= this.world.width || ny >= this.world.height) {
      return;
    }

    // collision check
    const tileId = this.world.getTile(nx, ny);
    if (!isWalkable(tileId)) {
      return;
    }

    // apply movement
    this.player.x = nx;
    this.player.y = ny;
    this.lastMoveTime = now;
  }
}
