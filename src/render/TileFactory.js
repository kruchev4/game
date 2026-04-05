import { getTileDef } from "../data/tiles.js";
import { PAINTERS } from "./tilePainters.js";

export class TileFactory {
  constructor({ tileSize = 16 } = {}) {
    this.tileSize = tileSize;
    this.cache = new Map(); // key: `${id}|${x}|${y}|${mask}`
  }

  // neighborMask optional: bitmask for autotiling/edges later
  getTileCanvas(tileId, wx, wy, neighborMask = 0) {
    const key = `${tileId}|${wx}|${wy}|${neighborMask}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const c = document.createElement("canvas");
    c.width = this.tileSize;
    c.height = this.tileSize;

    const ctx = c.getContext("2d");
    const def = getTileDef(tileId);
    const seed = hash2(wx, wy, tileId);

    const painter = PAINTERS[tileId] ?? PAINTERS.__default;
    painter(ctx, this.tileSize, def, seed, neighborMask);

    this.cache.set(key, c);
    return c;
  }

  clear() {
    this.cache.clear();
  }
}

// deterministic hash for stable variation
function hash2(x, y, salt = 0) {
  let n = (x * 374761393) ^ (y * 668265263) ^ (salt * 2147483647);
  n = (n ^ (n >> 13)) * 1274126177;
  return (n ^ (n >> 16)) >>> 0;
}
