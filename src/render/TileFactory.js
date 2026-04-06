import { getTileDef } from "../data/tiles.js";
import { PAINTERS } from "./tilePainters.js";

export class TileFactory {
  constructor({ tileSize = 16 } = {}) {
    this.tileSize = tileSize;
    this.cache = new Map(); // key: `${id}|${x}|${y}|${mask}`
    this.painters = PAINTERS;
  }

  

 getTileCanvas(tileId, wx, wy, neighbors = null, variant = 0) {
  // Only soften edges where neighbor is NOT grass
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
   // Soften grass edges ONLY when bordering non-grass to reduce grid read
if (tileId === 0 && neighbors) {
  if (neighbors.n !== 0) softenEdge(ctx, "n");
  if (neighbors.e !== 0) softenEdge(ctx, "e");
  if (neighbors.s !== 0) softenEdge(ctx, "s");
  if (neighbors.w !== 0) softenEdge(ctx, "w");
}

  this.cache.set(key, c);
  return c;
  }
}
function softenEdge(ctx, side, strength = 0.10) {
  const s = ctx.canvas.width;
  const feather = 5;

  let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
  if (side === "n") { x0 = 0; y0 = 0; x1 = 0; y1 = feather; }
  if (side === "s") { x0 = 0; y0 = s; x1 = 0; y1 = s - feather; }
  if (side === "w") { x0 = 0; y0 = 0; x1 = feather; y1 = 0; }
  if (side === "e") { x0 = s; y0 = 0; x1 = s - feather; y1 = 0; }

  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, `rgba(0,0,0,${strength})`);
  g.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = g;
  if (side === "n") ctx.fillRect(0, 0, s, feather);
  if (side === "s") ctx.fillRect(0, s - feather, s, feather);
  if (side === "w") ctx.fillRect(0, 0, feather, s);
  if (side === "e") ctx.fillRect(s - feather, 0, feather, s);
}

  grad.addColorStop(0, `rgba(0,0,0,${strength})`);
  grad.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = grad;

  if (side === "n") ctx.fillRect(0, 0, s, 6);
  if (side === "s") ctx.fillRect(0, s - 6, s, 6);
  if (side === "w") ctx.fillRect(0, 0, 6, s);
  if (side === "e") ctx.fillRect(s - 6, 0, 6, s);
}


// deterministic hash for stable variation
function hash2(x, y, salt = 0) {
  let n = (x * 374761393) ^ (y * 668265263) ^ (salt * 2147483647);
  n = (n ^ (n >> 13)) * 1274126177;
  return (n ^ (n >> 16)) >>> 0;
}

