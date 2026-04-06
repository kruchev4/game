import { supabase } from "./client.js";

export async function saveWorldToSupabase(world) {
  const { data, error } = await supabase
    .from("worlds")
    .upsert(
      {
        id: world.id,
        name: world.name,
        map_json: world
      },
      { onConflict: "id" }
    );

  if (error) throw error;
  return data;
}

// ✅ dev helper
window.__saveWorld = saveWorldToSupabase;
