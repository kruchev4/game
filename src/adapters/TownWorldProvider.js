/**
 * TownWorldProvider.js
 *
 * Loads town map JSON files from src/data/towns/.
 * Implements the same interface as SupabaseOverworldProvider
 * so Engine.loadWorld() works unchanged.
 *
 * Town JSON tiles are stored as an array of comma-separated strings
 * (one string per row). This provider parses them into a flat array
 * and exposes getTile(x, y).
 */

export class TownWorldProvider {
  /**
   * @param {string} basePath - base path to town JSON files (default ./src/data/towns/)
   */
  constructor(basePath = "./src/data/towns/") {
    this.basePath = basePath;
  }

  async load(townId) {
    const res = await fetch(`${this.basePath}${townId}.json`);
    if (!res.ok) throw new Error(`[TownWorldProvider] Failed to load ${townId}: ${res.status}`);

    const data = await res.json();
    return this._buildWorld(data);
  }

  _buildWorld(data) {
    const width  = data.width;
    const height = data.height;

    // Parse tiles from array of comma-separated row strings
    const tileArray = new Uint8Array(width * height);

    if (Array.isArray(data.tiles)) {
      data.tiles.forEach((row, y) => {
        const values = typeof row === "string"
          ? row.split(",").map(Number)
          : row;
        values.forEach((tileId, x) => {
          if (x < width && y < height) {
            tileArray[y * width + x] = tileId;
          }
        });
      });
    }

    return {
      id:       data.id,
      type:     data.type ?? "town",
      name:     data.name ?? data.id,
      width,
      height,
      meta:     data.meta     ?? {},
      exits:    data.exits    ?? [],
      friendlyNPCs:  data.friendlyNPCs  ?? [],
      shopInventory: data.shopInventory ?? [],
      entryPoint:    data.entryPoint    ?? { x: Math.floor(width / 2), y: Math.floor(height / 2) },
      capitol:       data.entryPoint    ?? { x: Math.floor(width / 2), y: Math.floor(height / 2) },

      getTile(x, y) {
        if (x < 0 || y < 0 || x >= width || y >= height) return null;
        return tileArray[y * width + x];
      },

      // Raw data passthrough for systems that need it
      _raw: data
    };
  }
}
