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
    return {
      id: raw.id,
      width: raw.width,
      height: raw.height,
      tiles: raw.tiles,
      getTile(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
        return this.tiles[y * this.width + x];
      }
    };
  }
}
