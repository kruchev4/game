import { getTileDef } from "../data/tiles.js";
import { PAINTERS } from "./tilePainters.js";

export class TileFactory {
  constructor({ tileSize = 16 } = {}) {
    this.tileSize = tileSize;
    this.cache = new Map(); // key includes neighbor signature now
  }

  // neighbors: { n,e,s,w } tileIds
  /*getTileCanvas(tileId, wx, wy, neighbors) {
    const sig = neighbors
      ? `${neighbors.n},${neighbors.e},${neighbors.s},${neighbors.w}`
      : "x,x,x,x";

    const key = `${tileId}|${wx}|${wy}|${sig}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const c = document.createElement("canvas");
    c.width = this.tileSize;
    c.height = this.tileSize;

    const ctx = c.getContext("2d");
    const def = getTileDef(tileId);
    const seed = hash3(wx, wy, tileId);

    const painter = PAINTERS[tileId] || PAINTERS.__default;
    painter(ctx, this.tileSize, def, seed, neighbors);

    this.cache.set(key, c);
    return c;
  }*/

  getTileCanvas(tileId, wx, wy) {
  const c = document.createElement("canvas");
  c.width = this.tileSize;
  c.height = this.tileSize;
  const ctx = c.getContext("2d");

  ctx.fillStyle = "#00ff00";
  ctx.fillRect(0, 0, this.tileSize, this.tileSize);

  return c;
}


  clear() {
    this.cache.clear();
  }
}

function hash3(x, y, salt) {
  let n = (x * 374761393) ^ (y * 668265263) ^ (salt * 1274126177);
  n = (n ^ (n >> 13)) * 1274126177;
  return (n ^ (n >> 16)) >>> 0;
}
