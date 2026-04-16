/**
 * TownWorldProvider.js
 *
 * Loads town and dungeon world JSON from Supabase worlds table.
 * Falls back to local JSON files if Supabase fails.
 */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config/supabaseConfig.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export class TownWorldProvider {
  async load(worldId) {
    // Try Supabase first
    try {
      const { data, error } = await supabase
        .from("worlds")
        .select("json")
        .eq("id", worldId)
        .single();

      if (error) throw error;
      if (!data?.json) throw new Error(`No world data for ${worldId}`);

      console.log(`[TownWorldProvider] Loaded ${worldId} from Supabase`);
      return this._buildWorld(data.json);
    } catch (e) {
      console.warn(`[TownWorldProvider] Supabase failed (${e.message}), trying local...`);
    }

    // Fall back to local JSON files
    const isTown   = worldId.startsWith("town_");
    const basePath = isTown ? "./src/data/towns/" : "./src/data/dungeons/";
    const res      = await fetch(`${basePath}${worldId}.json`);
    if (!res.ok) throw new Error(`[TownWorldProvider] Failed to load ${worldId}: ${res.status}`);

    const data = await res.json();
    console.log(`[TownWorldProvider] Loaded ${worldId} from local file`);
    return this._buildWorld(data);
  }

  _buildWorld(data) {
    const width  = data.width;
    const height = data.height;

    // Handle flat array or 2D array tiles
    const tileArray = new Uint8Array(width * height);
    if (Array.isArray(data.tiles)) {
      if (Array.isArray(data.tiles[0])) {
        // 2D array
        data.tiles.forEach((row, y) => {
          row.forEach((tileId, x) => {
            if (x < width && y < height) tileArray[y * width + x] = tileId;
          });
        });
      } else {
        // Flat array
        data.tiles.forEach((tileId, i) => { tileArray[i] = tileId; });
      }
    }

    return {
      id:            data.id,
      type:          data.type          ?? "dungeon",
      name:          data.name          ?? data.id,
      width,
      height,
      meta:          data.meta          ?? {},
      exits:         data.exits         ?? [],
      npcs:          data.npcs          ?? [],
      friendlyNPCs:  data.npcs          ?? [],
      shopInventory: data.shopInventory ?? [],
      spawnGroups:   data.spawnGroups   ?? [],
      spawns:        data.spawns        ?? [],
      boss:          data.boss          ?? null,
      rooms:         data.rooms         ?? [],
      towns:         data.towns         ?? [],
      portals:       data.portals       ?? [],
      entryPoint:    data.entryPoint    ?? { x: Math.floor(width/2), y: Math.floor(height/2) },
      _raw:          data,

      getTile(x, y) {
        if (x < 0 || y < 0 || x >= width || y >= height) return null;
        return tileArray[y * width + x];
      }
    };
  }
}
