export class Camera {
  constructor({
    x = 0,
    y = 0,
    viewportWidth = 0,
    viewportHeight = 0,
    tileSize = 16
  } = {}) {
    this.x = x; // world-space (tiles)
    this.y = y;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.tileSize = tileSize;
  }

  resize(w, h) {
    this.viewportWidth = w;
    this.viewportHeight = h;
  }

  // later we’ll center this on the player
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  worldToScreen(wx, wy) {
    return {
      sx: (wx - this.x) * this.tileSize,
      sy: (wy - this.y) * this.tileSize
    };
  }
}
