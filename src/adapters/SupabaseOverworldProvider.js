import { createClient } from
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from "../config/supabaseConfig.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export class SupabaseOverworldProvider {
  async load(id) {
    const { data, error } = await supabase
      .from("worlds")
      .select("json")
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    return this.#normalize(data.json);
  }

  #normalize(raw) {
    // Helper to parse JSON strings that may be nested
    const parseArr = (v) => {
      if (!v) return [];
      if (Array.isArray(v)) return v;
      if (typeof v === "string") { try { return JSON.parse(v); } catch { return []; } }
      return [];
    };

    return {
      // ── Core ──
      id:     raw.id,
      width:  raw.width,
      height: raw.height,
      tiles:  raw.tiles,

      // ── Rich metadata ──
      type:        raw.type        ?? "world",
      name:        raw.name        ?? raw.id,
      meta:        raw.meta        ?? {},
      capitol:     raw.capitol     ?? null,
      towns:       parseArr(raw.towns),
      portals:     parseArr(raw.portals),
      namedZones:  parseArr(raw.namedZones),
      bosses:      parseArr(raw.bosses),
      entryPoints: raw.entryPoints ?? {},
      spawnGroups: parseArr(raw.spawnGroups),
      encounters:  parseArr(raw.encounters),
      specialFeatures: parseArr(raw.specialFeatures),
      blimpRoutes: parseArr(raw.blimpRoutes),
      variants:    raw.variants    ?? {},
      metadata:    raw.metadata    ?? {},

      // Keep raw for anything we missed
      _raw: raw,

      getTile(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
        return this.tiles[y * this.width + x];
      }
    };
  }
}
