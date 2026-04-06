/**
 * TileFactory.js
 *
 * Renders individual tiles to small canvases using the draw() functions
 * defined in tiles.js. Results are cached by tileId + variant so each
 * unique tile appearance is only drawn once.
 *
 * Used by ChunkLayer to build chunk canvases efficiently.
 */

import { TILES } from "../data/tiles.js";

export class TileFactory {
  constructor({ tileSize = 16 } = {}) {
    this.tileSize = tileSize;
    this._cache   = new Map(); // "tileId:variant" -> canvas
  }

  /**
   * Get a rendered tile canvas. Cached after first render.
   * @param {number} tileId
   * @param {number} wx       - world x (for hash-based variation)
   * @param {number} wy       - world y
   * @param {object} neighbors - { n, e, s, w } tile IDs
   * @param {number} variant  - 0-3 pre-computed variant index
   * @returns {HTMLCanvasElement}
   */
  getTileCanvas(tileId, wx, wy, neighbors, variant = 0) {
    const def = TILES[tileId] ?? TILES[0];

    // Animated tiles (water, portals, chests) skip cache — drawn fresh each chunk build
    // For now all tiles are cached; animated ones will be handled by ChunkLayer invalidation
    const key = `${tileId}:${wx}:${wy}`;
    if (this._cache.has(key)) return this._cache.get(key);

    const canvas = document.createElement("canvas");
    canvas.width  = this.tileSize;
    canvas.height = this.tileSize;
    const ctx = canvas.getContext("2d");

    if (def.draw) {
      def.draw(ctx, 0, 0, this.tileSize, wx, wy);
    } else {
      // Fallback — solid color fill
      ctx.fillStyle = def.color ?? "#222";
      ctx.fillRect(0, 0, this.tileSize, this.tileSize);
    }

    this._cache.set(key, canvas);
    return canvas;
  }

  /** Clear all cached tiles (call after zoom change) */
  clearCache() {
    this._cache.clear();
  }
}
