// campaign/persistence/saveDungeon.js
import { supabase } from "../../Echoes/engine/supabase/client.js";

// example: src/db/saveWorld.js
export async function saveWorld({ id, name, tiles }) {
  return supabase
    .from("worlds")
    .upsert({
      id,
      name,
      type: "world",
      width: 240,
      height: 180,
      tiles,
      npcs: [],
    });
}


export async function saveDungeonToSupabase(dungeon) {
  const { data, error } = await supabase
    .from("maps")
    .upsert(
      {
        id: dungeon.id,
        name: dungeon.name ?? dungeon.id,
        type: "dungeon",
        width: dungeon.width,
        height: dungeon.height,
        json: dungeon
      },
      { onConflict: "id" }
    );

  if (error) throw error;
  return data;
}
