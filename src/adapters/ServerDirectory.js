import { createClient } from
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from "../config/supabaseConfig.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const HEARTBEAT_TIMEOUT_MS = 60_000;

/**
 * Fetch servers that are online and recently heartbeating.
 * Returns an array of server rows sorted by players_online ascending.
 */
export async function fetchAvailableServers() {
  try {
    const { data, error } = await supabase
      .from("game_servers")
      .select("*")
      .eq("status", "online")
      .order("players_online", { ascending: true });

    if (error) {
      console.warn("[ServerDirectory] Failed to load servers:", error.message);
      return [];
    }

    console.log("[ServerDirectory] Raw rows:", data);

    const now = Date.now();
    const filtered = (data ?? []).filter(server => {
      const last = new Date(server.last_heartbeat).getTime();
      const age  = now - last;
      console.log(`[ServerDirectory] Server ${server.name}: age=${age}ms, limit=${HEARTBEAT_TIMEOUT_MS}ms, pass=${age < HEARTBEAT_TIMEOUT_MS}`);
      return age < HEARTBEAT_TIMEOUT_MS;
    });

    console.log("[ServerDirectory] Available servers:", filtered.length);
    return filtered;
  } catch (e) {
    console.warn("[ServerDirectory] Exception:", e.message);
    return [];
  }
}
