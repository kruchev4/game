/**
 * TownWorldProvider.js
 *
 * Loads town and dungeon worlds from Supabase (worlds table).
 * Supabase is the single source of truth — no local JSON fallback.
 * Implements the same interface as SupabaseOverworldProvider.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config/supabaseConfig.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export class TownWorldProvider {
  async load(worldId) {
    const { data, error } = await supabase
      .from("worlds")
      .select("json")
      .eq("id", worldId)
      .single();

    if (error || !data) {
      throw new Error(`[TownWorldProvider] World "${worldId}" not found in Supabase: ${error?.message ?? "no data"}`);
    }

    // json column may be stored as a string in older rows
    const raw = typeof data.json === "string" ? JSON.parse(data.json) : data.json;
    return this._buildWorld(raw);
  }

  _buildWorld(data) {
    const width  = data.width;
    const height = data.height;
    const tileArray = new Uint8Array(width * height);

    if (Array.isArray(data.tiles)) {
      // Support both flat arrays [t0,t1,...] and row arrays [[t0,t1],[t2,t3],...]
      const firstEl = data.tiles[0];
      if (Array.isArray(firstEl) || typeof firstEl === "string") {
        // Row-based format
        data.tiles.forEach((row, y) => {
          const values = typeof row === "string"
            ? row.split(",").map(Number)
            : row;
          values.forEach((tileId, x) => {
            if (x < width && y < height) tileArray[y * width + x] = tileId;
          });
        });
      } else {
        // Flat format — standard for dungeon/town JSONs
        data.tiles.forEach((tileId, i) => { tileArray[i] = tileId; });
      }
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
      spawns:        data.spawns         ?? [],
      decorations:   data.decorations    ?? [],
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