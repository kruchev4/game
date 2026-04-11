import { createClient } from
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from "../config/supabaseConfig.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const HEARTBEAT_TIMEOUT_MS = 120_000; // 2 minutes — generous for cold starts

// Fallback — used if Supabase is unreachable
const FALLBACK_SERVERS = [
  {
    id:             "fallback-cloud",
    name:           "Cloud Server",
    ws_url:         "wss://realm-echoes-broker-2.onrender.com",
    region:         "cloud",
    status:         "online",
    players_online: 0,
    last_heartbeat: new Date().toISOString()
  }
];

/**
 * Fetch servers that are online and recently heartbeating.
 */
export async function fetchAvailableServers() {
  try {
    const { data, error } = await supabase
      .from("game_servers")
      .select("*")
      .eq("status", "online")
      .order("players_online", { ascending: true });

    if (error) {
      console.warn("[ServerDirectory] Supabase error — using fallback:", error.message);
      return FALLBACK_SERVERS;
    }

    console.log("[ServerDirectory] Raw rows:", data);

    const now = Date.now();
    const filtered = (data ?? []).filter(server => {
      const last = new Date(server.last_heartbeat).getTime();
      const age  = now - last;
      console.log(`[ServerDirectory] ${server.name}: age=${Math.round(age/1000)}s status=${server.status}`);
      return age < HEARTBEAT_TIMEOUT_MS;
    });

    if (filtered.length === 0) {
      console.warn("[ServerDirectory] No live servers found — using fallback");
      return FALLBACK_SERVERS;
    }

    console.log(`[ServerDirectory] ${filtered.length} server(s) available`);
    return filtered;
  } catch (e) {
    console.warn("[ServerDirectory] Exception — using fallback:", e.message);
    return FALLBACK_SERVERS;
  }
}
