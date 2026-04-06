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
  _applyChunkBreakup(ctx, chunkWorldX, chunkWorldY) {
  const ts = this.tileSize;
  const cs = this.chunkSize;

  // Only do this if you actually have a world
  if (!this.world) return;

  // Seed per chunk so it’s stable and doesn’t shimmer
  const seed = hash2(chunkWorldX, chunkWorldY, 1337);

  // 1) Very subtle low-frequency tint wash (breaks uniformity)
  // Keep alpha extremely low so it’s “felt”, not “seen”.
  this._tintWash(ctx, seed);

  // 2) Sparse clumps (multi-tile), only on grass (tileId 0 by default)
  this._grassClumps(ctx, chunkWorldX, chunkWorldY, seed, ts, cs);
}

_tintWash(ctx, seed) {
  // Two faint passes: a cool shadow wash + a warm sun wash
  // Very low alpha to avoid “dirty” look.
  const coolA = 0.035;
  const warmA = 0.025;

  // Cool
  ctx.fillStyle = `rgba(0, 0, 0, ${coolA})`;
  this._bigBlotches(ctx, seed ^ 0xA53A, 6);

  // Warm
  ctx.fillStyle = `rgba(255, 255, 255, ${warmA})`;
  this._bigBlotches(ctx, seed ^ 0xC0FF, 5);
}

_bigBlotches(ctx, seed, count) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  let z = seed >>> 0;
  for (let i = 0; i < count; i++) {
    z = (z + 0x9e3779b9) >>> 0;
    const x = (rand(z) * w) | 0;
    const y = (rand(z ^ 0xB5297A4D) * h) | 0;

    // radius in pixels, fairly large for low-frequency variation
    const r = 30 + ((rand(z ^ 0x1234567) * 80) | 0);

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

_grassClumps(ctx, chunkWorldX, chunkWorldY, seed, ts, cs) {
  // Clumps are multi-tile patches. We only draw them where the underlying
  // world tile is grass (tileId 0) to avoid painting over roads/water/etc.

  const clumpCount = 6; // keep low
  let z = seed ^ 0x51ED;

  for (let i = 0; i < clumpCount; i++) {
    z = (z + 0x9e3779b9) >>> 0;

    // pick a clump center in chunk tile coords
    const tx = (rand(z) * cs) | 0;
    const ty = (rand(z ^ 0xC31C) * cs) | 0;

    const wx = chunkWorldX + tx;
    const wy = chunkWorldY + ty;

    // only place clumps on grass
    if (this.world.getTile(wx, wy) !== 0) continue;

    // clump size in tiles (multi-tile look)
    const radiusTiles = 1 + ((rand(z ^ 0xDEAD) * 3) | 0); // 1..3
    const px = tx * ts;
    const py = ty * ts;

    // clump color (two tones)
    const dark = "rgba(25, 80, 30, 0.20)";
    const light = "rgba(90, 200, 110, 0.10)";

    // draw as a few overlapping circles for organic shape
    ctx.fillStyle = dark;
    this._tileCircle(ctx, px, py, radiusTiles * ts);

    ctx.fillStyle = light;
    this._tileCircle(ctx, px + (ts * 0.4), py + (ts * 0.2), (radiusTiles * ts) * 0.85);
  }
}

_tileCircle(ctx, px, py, r) {
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();
}
  // ---- helpers (must be OUTSIDE the class) ----


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
function rand(seed) {
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

function hash2(x, y, salt = 0) {
  let n = (x * 374761393) ^ (y * 668265263) ^ (salt * 2147483647);
  n = (n ^ (n >> 13)) * 1274126177;
  return (n ^ (n >> 16)) >>> 0;
}
  

 
