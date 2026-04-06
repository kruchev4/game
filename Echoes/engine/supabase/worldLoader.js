import { supabase } from "./client.js";
import { GameMap }  from "../world/GameMap.js";

export async function loadWorld(worldId) {
  console.log(`[worldLoader] Loading world: "${worldId}"…`);

  const { data, error } = await supabase
    .from("worlds")
    .select("map_json")
    .eq("id", worldId)
    .maybeSingle();

  if (error) {
    console.error(`[worldLoader] Supabase error loading "${worldId}":`, error.message, error);
    if (typeof toast === 'function') toast(`World load failed: ${error.message}`, 'err');
    throw error;
  }

  if (!data || !data.map_json) {
    const msg = `[worldLoader] No world found with id="${worldId}". Check the worlds table in Supabase.`;
    console.error(msg);
    if (typeof toast === 'function') toast(`World not found: ${worldId}`, 'err');
    throw new Error(msg);
  }

  const json = typeof data.map_json === 'string'
    ? JSON.parse(data.map_json)
    : data.map_json;

  console.log(
    `[worldLoader] Loaded "${worldId}" — ${json.width}×${json.height}, ${json.tiles?.length} tiles`
  );

  if (!json.id) json.id = worldId;

  return new GameMap(json);
  window.loadWorld = loadWorld;
  console.log("[worldLoader] json keys:", Object.keys(json || {}));
console.log("[worldLoader] tiles typeof:", typeof json?.tiles, "isArray:", Array.isArray(json?.tiles));

}
