import { supabase } from "./client.js";
import { GameMap } from "../world/GameMap.js";

export async function loadMap(mapId) {
  const { data, error } = await supabase
    .from("maps")
    .select("json")
    .eq("id", mapId)
    .single();

  if (error) {
    console.error("Failed to load map:", error);
    throw error;
  }

  return new GameMap(data.json);
}