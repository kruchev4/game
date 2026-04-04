export class Camera {
  screenToWorld(px, py) {
  // px,py are canvas pixel coordinates (NOT CSS pixels)
  const wx = this.x + Math.floor(px / this.tileSize);
  const wy = this.y + Math.floor(py / this.tileSize);
  return { x: wx, y: wy };
}
  constructor({
    x = 0,
    y = 0,
    viewportWidth = 0,
    viewportHeight = 0,
    tileSize = 16
  } = {}) {
    this.x = x; // world-space top-left (tiles)
    this.y = y;
    this.viewportWidth = viewportWidth;   // pixels
    this.viewportHeight = viewportHeight; // pixels
    this.tileSize = tileSize;
  }

  resize(w, h) {
    this.viewportWidth = w;
    this.viewportHeight = h;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  get visibleTilesX() {
    return Math.max(1, Math.floor(this.viewportWidth / this.tileSize));
  }

  get visibleTilesY() {
    return Math.max(1, Math.floor(this.viewportHeight / this.tileSize));
  }

  // Center camera on a world tile (tx, ty), clamped so we don't scroll past edges.
  centerOn(tx, ty, world) {
    const vw = this.visibleTilesX;
    const vh = this.visibleTilesY;

    // desired top-left so target is centered
    let nx = Math.floor(tx - vw / 2);
    let ny = Math.floor(ty - vh / 2);

    // clamp to world bounds
    const maxX = Math.max(0, world.width - vw);
    const maxY = Math.max(0, world.height - vh);

    nx = clamp(nx, 0, maxX);
    ny = clamp(ny, 0, maxY);

    this.x = nx;
    this.y = ny;
  }

  worldToScreen(wx, wy) {
    return {
      sx: (wx - this.x) * this.tileSize,
      sy: (wy - this.y) * this.tileSize
    };
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
