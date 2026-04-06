
// campaign/persistence/saveDungeon.js
import { supabase } from "./supabaseClient.js"; // your existing client

export async function saveDungeonToSupabase(dungeon) {
  // assuming table "dungeons" with columns: id (text), map_json (jsonb), created_at (timestamp), name (text)
  const { data, error } = await supabase
    .from("dungeons")
    .upsert({
      id: dungeon.id,
      name: dungeon.name,
      map_json: dungeon
    }, { onConflict: "id" });

  if (error) throw error;
  return data;
}
