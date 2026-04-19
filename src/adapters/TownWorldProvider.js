/**
 * TownWorldProvider.js
 * Loads town and dungeon worlds from Supabase — single source of truth.
 */

export class TownWorldProvider {
  async load(worldId) {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm");
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import("./src/config/supabaseConfig.js");
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data, error } = await sb.from("worlds").select("json").eq("id", worldId).single();
    if (error || !data) throw new Error(`[TownWorldProvider] Failed to load ${worldId}: ${error?.message}`);

    return this._buildWorld(data.json);
  }

  _buildWorld(data) {
    const width  = data.width;
    const height = data.height;
    const tileArray = new Uint8Array(width * height);

    if (Array.isArray(data.tiles)) {
      data.tiles.forEach((row, y) => {
        const values = typeof row === "string"
          ? row.split(",").map(Number)
          : Array.isArray(row) ? row : [row];
        values.forEach((tileId, x) => {
          if (x < width && y < height) tileArray[y * width + x] = tileId;
        });
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
      friendlyNPCs:  data.friendlyNPCs  ?? data.npcs ?? [],
      shopInventory: data.shopInventory ?? [],
      spawnGroups:   data.spawnGroups   ?? [],
      spawns:        data.spawns        ?? [],
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