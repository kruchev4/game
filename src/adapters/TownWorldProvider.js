/**
 * TownWorldProvider.js
 *
 * Loads town and dungeon map JSON files from src/data/towns/ and src/data/dungeons/.
 * Implements the same interface as SupabaseOverworldProvider.
 */

export class TownWorldProvider {
  constructor() {
    this._paths = {
      town:    "./src/data/towns/",
      dungeon: "./src/data/dungeons/"
    };
  }

  async load(worldId) {
    const prefix = worldId.startsWith("dungeon_") || !worldId.startsWith("town_")
      && !worldId.startsWith("town_") ? "dungeon" : "town";
    const isTown    = worldId.startsWith("town_");
    const basePath  = isTown ? this._paths.town : this._paths.dungeon;
    const filename  = isTown ? worldId : worldId; // e.g. crypt_of_bones

    const res = await fetch(`${basePath}${filename}.json`);
    if (!res.ok) throw new Error(`[TownWorldProvider] Failed to load ${filename}: ${res.status}`);

    const data = await res.json();
    return this._buildWorld(data);
  }

  _buildWorld(data) {
    const width  = data.width;
    const height = data.height;
    const tileArray = new Uint8Array(width * height);

    if (Array.isArray(data.tiles)) {
      data.tiles.forEach((val, i) => {
        if (typeof val === "number") {
          tileArray[i] = val;
        }
      });
    }

    return {
      id:            data.id,
      type:          data.type ?? "dungeon",
      name:          data.name ?? data.id,
      width,
      height,
      meta:          data.meta          ?? {},
      exits:         data.exits         ?? [],
      friendlyNPCs:  data.friendlyNPCs  ?? [],
      shopInventory: data.shopInventory ?? [],
      spawnGroups:   data.spawnGroups   ?? [],
      boss:          data.boss          ?? null,
      rooms:         data.rooms         ?? [],
      entryPoint:    data.entryPoint    ?? { x: Math.floor(width/2), y: Math.floor(height/2) },
      capitol:       data.entryPoint    ?? { x: Math.floor(width/2), y: Math.floor(height/2) },
      _raw:          data,

      getTile(x, y) {
        if (x < 0 || y < 0 || x >= width || y >= height) return null;
        return tileArray[y * width + x];
      }
    };
  }
}
