/**
 * Realm of Echoes — Authoritative Game Server
 *
 * Run:  node server.js
 *
 * Data ownership:
 *   Supabase  — monsters, spawn_groups, spawn_group_monsters, worlds, saves
 *   Server    — NPC simulation, combat resolution, player presence, loot
 *   Clients   — rendering, input, UI
 */

require("dotenv").config();
const { WebSocketServer, WebSocket } = require("ws");
const Database = require("better-sqlite3");
const path     = require("path");
const fs       = require("fs");
const http     = require("http");

// ── Config ────────────────────────────────────────────────────────────────
const PORT         = process.env.PORT         || 8080;
const SERVER_NAME  = process.env.SERVER_NAME  || "Local Server";
const SERVER_URL   = process.env.SERVER_URL   || "ws://localhost:8080";
const MAX_PLAYERS  = process.env.MAX_PLAYERS  || 10;

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

const TICK_MS              = 50;   // 20 ticks/sec
const STALE_MS             = 900000; // 15 minutes
const NPC_BROADCAST_TICKS  = 10;   // broadcast NPC state every 500ms
const PING_INTERVAL_MS     = 10000;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("[Server] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment");
  process.exit(1);
}

// ── Local SQLite database ────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, "db", "roe_server.db");
let db = null;

function initDB() {
  if (!fs.existsSync(DB_PATH)) {
    console.error("[Server] Database not found at", DB_PATH);
    console.error("[Server] Run: node db/seed.js");
    process.exit(1);
  }
  db = new Database(DB_PATH, { readonly: true });
  db.pragma("journal_mode = WAL");
  console.log("[Server] Local database loaded from", DB_PATH);
}

// ── Supabase REST helper (client-facing only — saves, worlds, registry) ───────
async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      "apikey":        SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type":  "application/json",
      "Accept":        "application/json",
      ...(opts.headers ?? {})
    }
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${path}: ${res.status} ${text}`);
  }
  return res.json();
}

// ── State ─────────────────────────────────────────────────────────────────
const worlds  = new Map(); // worldId  -> WorldInstance
const players = new Map(); // token    -> PlayerSession

// ── Monster cache — loaded once on startup ────────────────────────────────
/** @type {Map<string, MonsterDef>} */
const monsterDefs = new Map();

const MONSTER_FALLBACK = [
  { id:"goblinMelee",  name:"Goblin Warrior", icon:"👺", hp:30,  damage_min:4,  damage_max:9,  speed:3, perception:7,  roam_radius:4, attack_range:1, xp_value:25,  is_boss:false },
  { id:"goblinArcher", name:"Goblin Archer",  icon:"🏹", hp:22,  damage_min:5,  damage_max:10, speed:2, perception:8,  roam_radius:4, attack_range:6, xp_value:28,  is_boss:false },
  { id:"zombie",       name:"Zombie",         icon:"🧟", hp:35,  damage_min:5,  damage_max:10, speed:2, perception:5,  roam_radius:3, attack_range:1, xp_value:30,  is_boss:false },
  { id:"skeleton",     name:"Skeleton",       icon:"💀", hp:25,  damage_min:4,  damage_max:9,  speed:3, perception:7,  roam_radius:4, attack_range:1, xp_value:28,  is_boss:false },
  { id:"wraith",       name:"Wraith",         icon:"👻", hp:28,  damage_min:6,  damage_max:12, speed:4, perception:8,  roam_radius:4, attack_range:4, xp_value:40,  is_boss:false },
  { id:"necromancer",  name:"Necromancer",    icon:"🧙", hp:22,  damage_min:8,  damage_max:16, speed:2, perception:9,  roam_radius:3, attack_range:6, xp_value:60,  is_boss:false },
  { id:"lich",         name:"Lich",           icon:"💀", hp:200, damage_min:18, damage_max:28, speed:2, perception:10, roam_radius:2, attack_range:5, xp_value:300, is_boss:true  },
];

function _rowToMonster(row) {
  return {
    id:          row.id,
    name:        row.name,
    icon:        row.icon        ?? "👾",
    hp:          row.hp,
    damageMin:   row.damage_min,
    damageMax:   row.damage_max,
    speed:       row.speed       ?? 2,
    perception:  row.perception  ?? 5,
    roamRadius:  row.roam_radius ?? 3,
    attackRange: row.attack_range ?? 1,
    xpValue:     row.xp_value    ?? 0,
    isBoss:      row.is_boss     === true || row.is_boss === 1,
    tags:        row.tags        ?? []
  };
}

async function loadMonsterDefs() {
  try {
    const rows = await sb("monsters?select=*&order=id");
    if (!rows?.length) throw new Error("Empty response");
    for (const row of rows) monsterDefs.set(row.id, _rowToMonster(row));
    console.log(`[Server] Loaded ${monsterDefs.size} monster definitions from Supabase`);
  } catch (e) {
    console.warn(`[Server] Monster load failed (${e.message}) — using fallback`);
    for (const row of MONSTER_FALLBACK) monsterDefs.set(row.id, _rowToMonster(row));
    console.log(`[Server] Loaded ${monsterDefs.size} monster definitions from fallback`);
  }
}


// ── Ability cache ────────────────────────────────────────────────────────────
/** @type {Map<string, object>} */
const abilityDefs = new Map();

function _rowToAbility(row) {
  return {
    id:        row.id,
    name:      row.name,
    classId:   row.class_id,
    type:      row.type      ?? "melee",
    damageMin: row.damage_min ?? 0,
    damageMax: row.damage_max ?? 0,
    range:     row.range      ?? 1,
    cooldown:  row.cooldown   ?? 40,
    targets:   row.targets    ?? 1,
    healMin:   row.heal_min   ?? 0,
    healMax:   row.heal_max   ?? 0,
    manaCost:  row.mana_cost  ?? 0
  };
}

async function loadAbilityDefs() {
  // Supabase is single source of truth — reads full ability JSON from `data` jsonb column
  try {
    const rows = await sb("abilities?select=id,name,type,data&order=id");
    if (!rows?.length) throw new Error("Empty response");
    for (const row of rows) {
      if (row.data) {
        // Full ability JSON stored in data column — normalise flat fields for server use
        const ab = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
        abilityDefs.set(row.id, {
          ...ab,
          damageMin:   ab.damage?.base ?? 0,
          damageMax:   (ab.damage?.base ?? 0) + (ab.damage?.variance ?? 0),
          healMin:     ab.heal?.base ?? 0,
          healMax:     (ab.heal?.base ?? 0) + (ab.heal?.variance ?? 0),
          manaCost:    ab.cost?.mana ?? 0,
          rageCost:    ab.cost?.rage ?? 0,
          scalingMult: ab.scaling?.multiplier ?? 1.0,
          targets:     ab.aoe?.maxTargets ?? 1,
        });
      } else {
        // Fallback: old flat-column format
        abilityDefs.set(row.id, _rowToAbility(row));
      }
    }
    console.log(`[Server] Loaded ${abilityDefs.size} ability definitions from Supabase`);
  } catch (e) {
    console.warn(`[Server] Ability load failed (${e.message})`);
  }
}


async function registerServer() {
  try {
    // PATCH if exists, POST if not — match on ws_url
    const existing = await sb(`game_servers?ws_url=eq.${encodeURIComponent(SERVER_URL)}&select=id`);

    if (existing?.length) {
      // Update existing row
      _serverId = existing[0].id;
      await fetch(`${SUPABASE_URL}/rest/v1/game_servers?id=eq.${_serverId}`, {
        method: "PATCH",
        headers: {
          "apikey":        SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type":  "application/json"
        },
        body: JSON.stringify({
          name:           SERVER_NAME,
          status:         "online",
          players_online: 0,
          last_heartbeat: new Date().toISOString(),
          region:         SERVER_URL.includes("onrender") ? "cloud" : "local"
        })
      });
      console.log(`[Server] Re-registered (existing) — id: ${_serverId}`);
    } else {
      // Insert new row
      const data = await sb("game_servers", {
        method:  "POST",
        headers: { "Prefer": "return=representation" },
        body:    JSON.stringify({
          name:           SERVER_NAME,
          ws_url:         SERVER_URL,
          region:         SERVER_URL.includes("onrender") ? "cloud" : "local",
          status:         "online",
          players_online: 0,
          last_heartbeat: new Date().toISOString()
        })
      });
      _serverId = Array.isArray(data) ? data[0]?.id : data?.id;
      console.log(`[Server] Registered (new) — id: ${_serverId}`);
    }
  } catch (e) {
    console.warn("[Server] Registration failed:", e.message);
  }
}

async function pingServer() {
  // Match by ws_url so we don't need _serverId
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/game_servers?ws_url=eq.${encodeURIComponent(SERVER_URL)}`, {
      method:  "PATCH",
      headers: {
        "apikey":        SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type":  "application/json"
      },
      body: JSON.stringify({
        players_online:  players.size,
        last_heartbeat:  new Date().toISOString(),
        status:          "online"
      })
    });
    console.log(`[Server] Heartbeat (${players.size} players)`);
  } catch (e) {
    console.warn("[Server] Ping failed:", e.message);
  }
}

async function deregisterServer() {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/game_servers?ws_url=eq.${encodeURIComponent(SERVER_URL)}`, {
      method:  "PATCH",
      headers: {
        "apikey":        SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type":  "application/json"
      },
      body: JSON.stringify({ status: "offline", players_online: 0 })
    });
    console.log("[Server] Marked offline");
  } catch (e) {
    console.warn("[Server] Deregister failed:", e.message);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function _send(ws, msg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function _playersInWorld(worldId) {
  return [...players.values()].filter(p => p.worldId === worldId);
}

function _broadcast(worldId, msg, excludeToken = null) {
  const raw = JSON.stringify(msg);
  for (const s of _playersInWorld(worldId)) {
    if (s.playerToken === excludeToken) continue;
    if (s.ws.readyState === WebSocket.OPEN) s.ws.send(raw);
  }
}

function _pub(s) {
  return {
    playerToken: s.playerToken, worldId: s.worldId,
    name: s.name, classId: s.classId, icon: s.icon,
    hp: s.hp, maxHp: s.maxHp, level: s.level,
    x: s.x, y: s.y, state: s.state
  };
}

function _removePlayer(token) {
  const s = players.get(token);
  if (!s) return;
  players.delete(token);
  const world = worlds.get(s.worldId);
  if (world) {
    world.removePlayer(token);
    if (world.players.size === 0) worlds.delete(s.worldId);
  }
  _broadcast(s.worldId, { type: "player_left", token });
  console.log(`[Server] ${s.name} left (${_playersInWorld(s.worldId).length} remaining)`);
}

// ── Startup ───────────────────────────────────────────────────────────────
(async () => {
  // Load game data from Supabase (source of truth)
  await loadMonsterDefs();
  await loadAbilityDefs();

  // Init local DB for spawn groups only
  initDB();

  try {
    await registerServer();
  } catch (e) {
    console.warn("[Server] Registration failed — continuing without Supabase registration:", e.message);
  }

  setInterval(pingServer, PING_INTERVAL_MS);
  server.listen(PORT);
})();