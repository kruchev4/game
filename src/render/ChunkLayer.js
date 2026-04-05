export class ChunkLayer {
  constructor({ tileSize = 16, chunkSize = 32, tileFactory }) {
    this.tileSize = tileSize;
    this.chunkSize = chunkSize;       // 32x32 tiles per chunk
    this.tileFactory = tileFactory;

    this.world = null;
    this.cache = new Map();           // key: "cx,cy" -> canvas
  }

  /** Call this when you load/change the map */
  setWorld(world) {
    this.world = world;
    this.cache.clear();
  }

  /** Optional: eagerly build all chunks for a finite map */
  buildAllChunks() {
    if (!this.world) return;
    const cs = this.chunkSize;
    const maxCX = Math.ceil(this.world.width / cs);
    const maxCY = Math.ceil(this.world.height / cs);

    for (let cy = 0; cy < maxCY; cy++) {
      for (let cx = 0; cx < maxCX; cx++) {
        this._getOrBuildChunk(cx, cy);
      }
    }
  }

  /** Draw only visible chunks */
  draw(ctx, camera) {
    if (!this.world) return;

    const ts = this.tileSize;
    const cs = this.chunkSize;

    // camera.x/y are tile units (per your worldToScreen)
    const viewX = Math.floor(camera.x);
    const viewY = Math.floor(camera.y);

    const tilesWide = Math.ceil(ctx.canvas.width / ts) + 2;
    const tilesHigh = Math.ceil(ctx.canvas.height / ts) + 2;

    const endX = viewX + tilesWide;
    const endY = viewY + tilesHigh;

    const startCX = Math.floor(viewX / cs);
    const startCY = Math.floor(viewY / cs);
    const endCX = Math.floor(endX / cs);
    const endCY = Math.floor(endY / cs);

    for (let cy = startCY; cy <= endCY; cy++) {
      for (let cx = startCX; cx <= endCX; cx++) {
        const chunkCanvas = this._getOrBuildChunk(cx, cy);

        // chunk origin in world tiles
        const chunkWorldX = cx * cs;
        const chunkWorldY = cy * cs;

        // convert world tile coords -> screen pixels
        const px = Math.floor((chunkWorldX - camera.x) * ts);
        const py = Math.floor((chunkWorldY - camera.y) * ts);

        ctx.drawImage(chunkCanvas, px, py);
      }
    }
  }

  /** If a tile changes, invalidate that chunk (and optionally neighbors) */
  invalidateTile(wx, wy) {
    const cs = this.chunkSize;
    const cx = Math.floor(wx / cs);
    const cy = Math.floor(wy / cs);
    this.cache.delete(`${cx},${cy}`);

    // optional: neighbor chunks if your tiles depend on neighbors across edges
    // this.cache.delete(`${cx-1},${cy}`);
    // this.cache.delete(`${cx+1},${cy}`);
    // this.cache.delete(`${cx},${cy-1}`);
    // this.cache.delete(`${cx},${cy+1}`);
  }

  // ----------------- internal -----------------

  _getOrBuildChunk(cx, cy) {
    const key = `${cx},${cy}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const c = this._buildChunkCanvas(cx, cy);
    this.cache.set(key, c);
    return c;
  }

  _buildChunkCanvas(cx, cy) {
    const world = this.world;
    const ts = this.tileSize;
    const cs = this.chunkSize;

    const c = document.createElement("canvas");
    c.width = cs * ts;
    c.height = cs * ts;
    const ctx = c.getContext("2d");

    const startX = cx * cs;
    const startY = cy * cs;

    for (let y = 0; y < cs; y++) {
      for (let x = 0; x < cs; x++) {
        const wx = startX + x;
        const wy = startY + y;

        // guard for finite maps
        if (wx < 0 || wy < 0 || wx >= world.width || wy >= world.height) continue;

        const tileId = world.getTile(wx, wy);
        if (tileId == null) continue;

        // neighbor-aware tiles (for edge blending / autotiling)
        const neighbors = {
          n: world.getTile(wx, wy - 1),
          e: world.getTile(wx + 1, wy),
          s: world.getTile(wx, wy + 1),
          w: world.getTile(wx - 1, wy)
        };

        // TileFactory should return a cached tile variant canvas (fast)
        const tileCanvas = this.tileFactory.getTileCanvas(tileId, wx, wy, neighbors);

        ctx.drawImage(tileCanvas, x * ts, y * ts, ts, ts);
      }
    }

    return c;
  }
}
