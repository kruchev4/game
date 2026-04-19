export class Camera {
  constructor({
    x = 0,
    y = 0,
    viewportWidth = 0,
    viewportHeight = 0,
    tileSize = 24          // 24px = 16px × 1.5 — matches old 150% browser zoom
  } = {}) {
    this.x = x;
    this.y = y;
    this.viewportWidth  = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.tileSize       = tileSize;

    // Zoom limits — ±25% of base (24)
    this.minTileSize = 16;   // ~67% zoom  (zoomed out)
    this.maxTileSize = 32;   // ~133% zoom (zoomed in)
    this.zoomStep    = 4;    // pixels per scroll step
  }

  // ── Zoom ──────────────────────────────────────────────────────────────────

  /**
   * Zoom in or out, keeping the given world tile anchored to the same
   * screen position. Called by the scroll wheel listener.
   * @param {number}  delta     - positive = zoom in, negative = zoom out
   * @param {number}  anchorWx  - world tile X under the cursor
   * @param {number}  anchorWy  - world tile Y under the cursor
   * @param {object}  [renderer] - if provided, syncs renderer.tileSize too
   */
  zoom(delta, anchorWx, anchorWy, renderer) {
    const newSize = clamp(
      this.tileSize + delta,
      this.minTileSize,
      this.maxTileSize
    );
    if (newSize === this.tileSize) return;

    // Keep the tile under the cursor in the same screen position
    const screenX = (anchorWx - this.x) * this.tileSize;
    const screenY = (anchorWy - this.y) * this.tileSize;

    this.tileSize = newSize;

    this.x = anchorWx - screenX / newSize;
    this.y = anchorWy - screenY / newSize;

    // Sync renderer tileSize if provided
    if (renderer) {
      renderer.tileSize = newSize;
      // Rebuild TileFactory cache at new size
      renderer.tileFactory = new (renderer.tileFactory.constructor)({ tileSize: newSize });
      renderer.chunkLayer.tileFactory = renderer.tileFactory;
      // Invalidate chunk cache so tiles redraw at new size
      if (renderer._lastWorld) {
        renderer.chunkLayer.setWorld(renderer._lastWorld);
      }
    }
  }

  // ── Core ──────────────────────────────────────────────────────────────────

  resize(w, h) {
    this.viewportWidth  = w;
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

  centerOn(tx, ty, world) {
    const vw = this.visibleTilesX;
    const vh = this.visibleTilesY;
    let nx = Math.floor(tx - vw / 2);
    let ny = Math.floor(ty - vh / 2);
    const maxX = Math.max(0, world.width  - vw);
    const maxY = Math.max(0, world.height - vh);
    this.x = clamp(nx, 0, maxX);
    this.y = clamp(ny, 0, maxY);
  }

  worldToScreen(wx, wy) {
    return {
      sx: (wx - this.x) * this.tileSize,
      sy: (wy - this.y) * this.tileSize
    };
  }


  /** Fractional world position — use for zoom anchoring */
  screenToWorldF(px, py) {
    return {
      x: this.x + px / this.tileSize,
      y: this.y + py / this.tileSize
    };
  }

  screenToWorld(px, py) {
    return {
      x: this.x + Math.floor(px / this.tileSize),
      y: this.y + Math.floor(py / this.tileSize)
    };
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}