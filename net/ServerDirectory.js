import { createClient } from
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from "../config/supabaseConfig.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const HEARTBEAT_TIMEOUT_MS = 30_000;
const TABLE = "game_servers"; // change to "roe2_servers" if you renamed it

/**
 * Fetch servers that are online and recently heartbeating.
 * Returns an array of server rows sorted by player count (least busy first).
 */
export async function fetchAvailableServers() {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("status", "online")
      .order("player_count", { ascending: true });

    if (error) {
      console.warn("[ServerDirectory] Failed to load servers:", error.message);
      return [];
    }

    const now = Date.now();
    return (data ?? []).filter(server => {
      const last = new Date(server.last_heartbeat).getTime();
      return (now - last) < HEARTBEAT_TIMEOUT_MS;
    });
  } catch (e) {
    console.warn("[ServerDirectory] Exception:", e.message);
    return [];
  }
}
