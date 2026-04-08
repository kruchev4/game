import { supabase } from "../supabaseClient.js"; // adjust path if needed

const HEARTBEAT_TIMEOUT_MS = 30_000;

export async function fetchAvailableServers() {
  const { data, error } = await supabase
    .from("game_servers")
    .select("*")
    .eq("status", "online");

  if (error) {
    console.warn("[ServerDirectory] Failed to load servers:", error.message);
    return [];
  }

  const now = Date.now();

  return data.filter(s =>
    now - new Date(s.last_heartbeat).getTime() < HEARTBEAT_TIMEOUT_MS
  );
}
