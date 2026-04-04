export class MovementSystem {
  constructor({ world, player }) {
    this.world = world;
    this.player = player;
    this.lastMoveTime = 0;
    this.moveDelay = 120; // ms per step

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
    if (!this.player) return;

    let dx = 0;
    let dy = 0;

    // WASD
    if (this.keys.has("w") || this.keys.has("arrowup")) dy = -1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) dy = 1;
    if (this.keys.has("a") || this.keys.has("arrowleft")) dx = -1;
    if (this.keys.has("d") || this.keys.has("arrowright")) dx = 1;

    // prevent diagonal movement for now
    if (dx !== 0 && dy !== 0) {
      dx = 0;
      dy = 0;
    }

    if (dx === 0 && dy === 0) return;

    const nx = this.player.x + dx;
    const ny = this.player.y + dy;

    // bounds check
    if (
      nx < 0 ||
      ny < 0 ||
      nx >= this.world.width ||
      ny >= this.world.height
    ) {
      return;
    }

    // TODO: collision checks later
    this.player.x = nx;
    this.player.y = ny;
  }
}
