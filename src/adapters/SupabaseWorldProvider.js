import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://YOUR_PROJECT.supabase.co",
  "PUBLIC_ANON_KEY"
);

export class SupabaseWorldProvider {
  async load(id) {
    const { data, error } = await supabase
      .from("maps")
      .select("json")
      .eq("id", id)
      .single();

    if (error) throw new Error(error.message);

    return this.#normalizeMap(data.json);
  }

  #normalizeMap(raw) {
    return {
      id: raw.id,
      width: raw.width,
      height: raw.height,
      tiles: Array.isArray(raw.tiles)
        ? raw.tiles
        : Array.from(raw.tiles),

      getTile(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
          return 0;
        }
        return this.tiles[y * this.width + x];
      }
    };
  }
}
