import { getTileDef } from "../data/tiles.js";
import { PAINTERS } from "./tilePainters.js";

export class TileFactory {
  constructor({ tileSize = 16 } = {}) {
    this.tileSize = tileSize;
    this.cache = new Map(); // key: `${id}|${x}|${y}|${mask}`
    this.painters = PAINTERS;
  }

 getTileCanvas(tileId, wx, wy, neighbors = null, variant = 0) {
  // Optional debug (turn off once confirmed)
  // console.count("TILE VARIANT PAINT");

  const n = neighbors || {};

  
  const key = `${tileId}|v${variant}|${n.n ?? "x"}|${n.e ?? "x"}|${n.s ?? "x"}|${n.w ?? "x"}`;


  const cached = this.cache.get(key);
  if (cached) return cached;

  const c = document.createElement("canvas");
  c.width = this.tileSize;
  c.height = this.tileSize;

  const ctx = c.getContext("2d");
  const def = getTileDef(tileId);

  
  const seed =
  ((tileId * 73856093) ^
    ((variant + 1) * 83492791) ^
    ((n.n ?? 0) * 19349663) ^
    ((n.e ?? 0) * 29765729) ^
    ((n.s ?? 0) * 104395301) ^
    ((n.w ?? 0) * 668265263)) >>> 0;

  const painter = (this.painters?.[tileId] ?? PAINTERS[tileId] ?? PAINTERS.__default);
  painter(ctx, this.tileSize, def, seed, n);

  this.cache.set(key, c);
  return c;
  }
}

// deterministic hash for stable variation
function hash2(x, y, salt = 0) {
  let n = (x * 374761393) ^ (y * 668265263) ^ (salt * 2147483647);
  n = (n ^ (n >> 13)) * 1274126177;
  return (n ^ (n >> 16)) >>> 0;
}
