/**
 * Realm of Echoes — Authoritative Game Server
 *
 * Run:  node server.js
 *
 * Data ownership:
 * Supabase  — monsters, spawn_groups, spawn_group_monsters, worlds, saves
 * Server    — NPC simulation, combat resolution, player presence, loot
 * Clients   — rendering, input, UI
 */

require("dotenv").config();
const { WebSocketServer, WebSocket } = require("ws");
const path = require("path");
const fs   = require("fs");
const http = require("http");
const AbilityRouter = require("./abilities/index");

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
/** @type {Map<string, object>} monster id -> full data JSON blob */
const monsterDefs = new Map();

/** @type {Map<string, object[]>} monsterId -> loot entries (specific overrides) */
const lootByMonster = new Map();

/** @type {Map<number, object[]>} tier -> loot entries (pool drops) */
const lootByTier = new Map();

async function loadMonsterDefs() {
  try {
    const rows = await sb("monsters?select=id,data&order=id");
    if (!rows?.length) throw new Error("Empty response");
    for (const row of rows) monsterDefs.set(row.id, row.data);
    console.log(`[Server] Loaded ${monsterDefs.size} monster definitions from Supabase`);
  } catch (e) {
    console.error(`[Server] Monster load failed: ${e.message}`);
    // No fallback — monsters must be defined in Supabase
  }
}

async function loadLootTables() {
  try {
    const rows = await sb("loot_tables?select=*&order=tier");
    if (!rows?.length) throw new Error("Empty response");
    for (const row of rows) {
      if (row.monster_id) {
        if (!lootByMonster.has(row.monster_id)) lootByMonster.set(row.monster_id, []);
        lootByMonster.get(row.monster_id).push(row);
      } else {
        if (!lootByTier.has(row.tier)) lootByTier.set(row.tier, []);
        lootByTier.get(row.tier).push(row);
      }
    }
    console.log(`[Server] Loaded loot for ${lootByMonster.size} monsters, ${lootByTier.size} tiers`);
  } catch (e) {
    console.error(`[Server] Loot table load failed: ${e.message}`);
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
  // Abilities are the single source of truth in abilities.json (client+server share the same file)
  // This avoids maintaining a separate Supabase abilities table with different field names
  try {
    const fs   = await import("fs");
    const path = await import("path");
    // ABILITIES_PATH env var lets you point to the game folder without hardcoding
    const defaultPath = path.join(__dirname, "..", "src", "data", "abilities.json");
    console.log(`[Server] Loading abilities from: ${process.env.ABILITIES_PATH ?? defaultPath}`);
    const filePath = process.env.ABILITIES_PATH ?? defaultPath;
    const raw  = fs.readFileSync(filePath, "utf8");
    const defs = JSON.parse(raw);
    for (const [id, def] of Object.entries(defs)) {
      // Normalise to server field names while keeping full JSON structure
      abilityDefs.set(id, {
        ...def,
        damageMin:  def.damage?.base ?? 0,
        damageMax:  (def.damage?.base ?? 0) + (def.damage?.variance ?? 0),
        healMin:    def.heal?.base ?? 0,
        healMax:    (def.heal?.base ?? 0) + (def.heal?.variance ?? 0),
        manaCost:   def.cost?.mana ?? 0,
        rageCost:   def.cost?.rage ?? 0,
        scalingMult: def.scaling?.multiplier ?? 1.0,
        targets:    def.aoe?.maxTargets ?? 1,
      });
    }
    console.log(`[Server] Loaded ${abilityDefs.size} ability definitions from abilities.json`);
  } catch (e) {
    console.warn(`[Server] abilities.json load failed (${e.message}) — trying Supabase`);
    try {
      const rows = await sb("abilities?select=*&order=id");
      if (!rows?.length) throw new Error("Empty response");
      for (const row of rows) {
        if (row.data) {
          const ab = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
          abilityDefs.set(row.id, {
            ...ab,
            damageMin: ab.damage?.base ?? 0,
            damageMax: (ab.damage?.base ?? 0) + (ab.damage?.variance ?? 0),
            healMin: ab.heal?.base ?? 0,
            healMax: (ab.heal?.base ?? 0) + (ab.heal?.variance ?? 0),
            manaCost: ab.cost?.mana ?? 0,
            rageCost: ab.cost?.rage ?? 0,
            scalingMult: ab.scaling?.multiplier ?? 1.0,
            targets: ab.aoe?.maxTargets ?? 1,
          });
        } else {
          abilityDefs.set(row.id, _rowToAbility(row));
        }
      }
      console.log(`[Server] Loaded ${abilityDefs.size} ability definitions from Supabase fallback`);
    } catch (e2) {
      console.warn(`[Server] Ability load failed entirely — using generic damage`);
    }
  }
}

// ── Spawn group loader — called per world ─────────────────────────────────
/**
 * Load all spawn groups + their monsters for a given worldId.
 * Returns array of { group, monsters[] } ready for NPC instantiation.
 */


// ── Ability Resolution ────────────────────────────────────────────────────────

function _statMod(val) { return Math.floor(((val ?? 10) - 10) / 2); }

function _rollDamage(ability, session = null) {
  const min = ability.damageMin ?? 0;
  const max = ability.damageMax ?? 0;
  if (min === 0 && max === 0) return 0;
  let dmg = min + Math.floor(Math.random() * (max - min + 1));
  if (session) {
    const stats = session.stats ?? {};
    const type  = ability.type ?? "melee";

    if (type === "ranged") {
      dmg += Math.floor(_statMod(stats.dex ?? stats.DEX ?? 10) * (ability.scalingMult ?? 1.0));
    } else if (type === "melee") {
      dmg += _statMod(stats.str ?? stats.STR ?? 10);
    }

    if (type === "ranged") {
      const critChance = 0.05 + _statMod(stats.dex ?? stats.DEX ?? 10) * 0.02;
      session._lastCrit = Math.random() < critChance;
      if (session._lastCrit) dmg = Math.floor(dmg * 2);
    }
  }
  return Math.max(1, dmg);
}

function getRankedAbility(ability, rank) {
  if (!ability || !rank || rank <= 1) return ability;
  const override = ability.ranks?.[String(rank)];
  if (!override) return ability;
  return { ...ability, ...override };
}

function _rollHeal(ability) {
  const min = ability.healMin ?? 0;
  const max = ability.healMax ?? 0;
  if (min === 0 && max === 0) return 0;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function _inRange(attacker, target, range) {
  const dx = Math.abs(attacker.x - target.x);
  const dy = Math.abs(attacker.y - target.y);
  return (dx + dy) <= range + 2; // +2 tile sync tolerance
}

function _resolveAbility(session, world, msg) {
  const { abilityId } = msg;
  const rank = msg.rank ?? (session.learnedSkills?.[abilityId] ?? 1);

  // Cooldown check
  const cdRemaining = session.cooldowns[abilityId] ?? 0;
  if (cdRemaining > 0) {
    _send(session.ws, { type: "ability_cooldown", abilityId, remaining: cdRemaining });
    return;
  }

  const baseAbility = abilityDefs.get(abilityId) ?? { id: abilityId, type: "melee", damageMin: 5, damageMax: 10, range: 1, cooldown: 40, targets: 1, healMin: 0, healMax: 0, manaCost: 0 };
  const ability = getRankedAbility(baseAbility, rank);

  // Set cooldown
  session.cooldowns[abilityId] = ((ability.cooldown ?? 40) / 60) * 1000;

  // Cast time — delay resolution
  if (ability.castTime && ability.castTime > 0 && !msg.skipCastTime) {
    const castMs = ability.castTime / 60 * 1000;
    _send(session.ws, { type: "cast_start", abilityId, castTime: castMs });
    session.pendingCast = { abilityId, targetId: msg.targetId, targetType: msg.targetType, rank, resolveAt: Date.now() + castMs };
    return;
  }

  // Volley handled separately via volley_place message
  if (abilityId === "volley") return;

  // Mana check
  const manaCost = ability.manaCost ?? 0;
  if (manaCost > 0) {
    const currentMana = session.mana ?? session.maxMana ?? 100;
    if (currentMana < manaCost) {
      delete session.cooldowns[abilityId];
      _send(session.ws, { type: "ability_result", abilityId, noMana: true });
      return;
    }
    session.mana = Math.max(0, currentMana - manaCost);
  }

  // Route to appropriate resolver
  AbilityRouter.route(session, world, ability, msg);
}

function _handleNPCKill(session, world, npcId, result) {
  const playersHere = _playersInWorld(session.worldId);
  const count       = playersHere.length;
  const xpShare     = Math.floor(result.xpValue / Math.max(1, count));

  // Award XP and gold to all players in world
  for (const p of playersHere) {
    p.xp   = (p.xp   ?? 0) + xpShare;
    p.gold = (p.gold ?? 0) + (result.loot?.gold ?? 0);
    _send(p.ws, {
      type: "player_stat_update",
      hp: p.hp, maxHp: p.maxHp,
      xp: p.xp, gold: p.gold
    });
  }

  _broadcast(session.worldId, {
    type: "npc_killed", npcId,
    killerName: session.name, xpShare, loot: result.loot
  });

  console.log(`[Server] ${session.name} killed ${npcId} (${xpShare} XP × ${count})`);
}

function _applyHeal(session, amount, world) {
  session.hp = Math.min(session.maxHp, (session.hp ?? 0) + amount);
  _send(session.ws, {
    type: "player_stat_update",
    hp: session.hp, maxHp: session.maxHp,
    xp: session.xp, gold: session.gold
  });
}

// ── HTTP Static File Server (Replaces Nginx) ──────────────────────────────
const server = http.createServer((req, res) => {
  // Default to index.html for the root route
  let filePath = path.join(__dirname, '..', req.url === '/' ? 'index.html' : req.url);

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if(error.code === 'ENOENT') {
        res.writeHead(404);
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// ── WebSocket server ──────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });
console.log(`[Server] HTTP and WebSocket listening on port ${PORT}`);

wss.on("connection", (ws) => {
  let session = null;

  ws.on("message", async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    console.log(`[Server] message received: ${msg.type}`);

    switch (msg.type) {

      case "join": {
        const { playerToken, worldId, name, classId, icon, hp, maxHp, level, x, y } = msg;

        if (players.has(playerToken)) _removePlayer(playerToken);

        session = {
          ws, playerToken, worldId,
          name:     name    ?? "Hero",
          classId:  classId ?? "fighter",
          icon:     icon    ?? "🧙",
          hp:       hp      ?? 80,
          maxHp:    maxHp   ?? 80,
          level:    level   ?? 1,
          x:        x       ?? 0,
          y:        y       ?? 0,
          gold:     msg.gold    ?? 0,
          xp:       msg.xp      ?? 0,
          mana:     msg.mana    ?? 100,
          maxMana:  msg.maxMana ?? 100,
          stats:         msg.stats        ?? {},
          learnedSkills: msg.learnedSkills ?? {},
          state:         "idle",
          lastSeen:      Date.now(),
          cooldowns:     {},
          elementalCharge: null,
          eaglesEye:       null,
          pendingCast:     null,
          rage:            msg.rage ?? 0,
          stunned:         {},  // npcId -> expiresAt
          battleCry:       null, // { expiresAt, magnitude }
          fortify:         null, // { expiresAt, magnitude, reflect }
          lastCombatAt:    0
        };
        players.set(playerToken, session);

        // Get or create world — triggers Supabase load if new
        if (!worlds.has(worldId)) {
          const world = new WorldInstance(worldId);
          worlds.set(worldId, world);
          world.load().catch(e =>
            console.warn(`[Server] Failed to load ${worldId}:`, e.message)
          );
        }
        const world = worlds.get(worldId);
        world.addPlayer(playerToken);

        // Tell new player about existing players
        const others = _playersInWorld(worldId)
          .filter(p => p.playerToken !== playerToken)
          .map(_pub);
        _send(ws, { type: "world_state", players: others });
        console.log(`[Server] Sent world_state to ${name}: ${others.length} other players`);

        // Send current NPC state once world is ready
        if (world.ready) {
          const npcs = world.getNPCState();
          _send(ws, { type: "npc_state", npcs });
          console.log(`[Server] Sent npc_state to ${name}: ${npcs.length} NPCs`);
        } else {
          // Poll until ready then send
          const poll = setInterval(() => {
            if (world.ready) {
              clearInterval(poll);
              const npcs = world.getNPCState();
              _send(ws, { type: "npc_state", npcs });
              console.log(`[Server] Sent delayed npc_state to ${name}: ${npcs.length} NPCs`);
            }
          }, 200);
        }

        // Tell everyone else about new player
        _broadcast(worldId, { type: "player_joined", player: _pub(session) }, playerToken);
        console.log(`[Server] ${name} joined ${worldId} (${_playersInWorld(worldId).length} players)`);
        break;
      }

      case "move": {
        if (!session) break;
        session.x        = msg.x;
        session.y        = msg.y;
        session.state    = msg.state ?? "idle";
        session.lastSeen = Date.now();
        _broadcast(session.worldId, {
          type: "player_moved", token: session.playerToken,
          x: session.x, y: session.y, state: session.state
        }, session.playerToken);
        break;
      }

      case "state_update": {
        if (!session) break;
        if (msg.hp    !== undefined) session.hp    = msg.hp;
        if (msg.maxHp !== undefined) session.maxHp = msg.maxHp;
        if (msg.level !== undefined) session.level = msg.level;
        session.lastSeen = Date.now();
        _broadcast(session.worldId, {
          type: "player_updated", player: _pub(session)
        }, session.playerToken);
        break;
      }

      case "use_ability": {
        if (!session) break;
        const world = worlds.get(session.worldId);
        if (!world?.ready) break;
        _resolveAbility(session, world, msg);
        break;
      }

      case "volley_place": {
        if (!session) break;
        const world = worlds.get(session.worldId);
        if (!world?.ready) break;
        const baseAbility = abilityDefs.get(msg.abilityId ?? "volley");
        const ability = getRankedAbility(baseAbility, msg.rank ?? 1);
        if (!ability) { console.warn("[Server] volley_place: not found:", msg.abilityId); break; }
        const { wx, wy } = msg;
        const radius = ability.aoe?.radius ?? 2, dmgPerTick = ability.damageMin ?? 4;
        session.cooldowns[msg.abilityId ?? "volley"] = ((ability.cooldown ?? 300) / 60) * 1000;
        _broadcast(session.worldId, { type: "volley_zone", wx, wy, radius, duration: 3000, attackerName: session.name });
        let tick = 0;
        const iv = setInterval(() => {
          try {
            tick++;
            const dexMod = Math.floor(((session.stats?.dex ?? 10) - 10) / 2);
            const dmg = Math.max(1, dmgPerTick + Math.floor(dexMod * 0.5));
            
            for (const npc of [...world.npcs.values()]) {
              if (npc.dead) continue;
              const dx = npc.x - wx, dy = npc.y - wy;
              if (Math.sqrt(dx*dx+dy*dy) <= radius) {
                const r = world.resolveAttack(npc.id, dmg, session);
                if (!r) continue;
                _broadcast(session.worldId, { type: "npc_damaged", npcId: npc.id, hp: r.hp, maxHp: r.maxHp, damage: dmg, attackerName: session.name, isDot: true });
                if (r.dead) _handleNPCKill(session, world, npc.id, r);
              }
            }
          } catch(e) { console.error("[Volley]", e.message); }
          if (tick >= 6) clearInterval(iv);
        }, 500);
        break;
      }

      // Legacy support — keep npc_attack for backward compat
      case "npc_attack": {
        if (!session) break;
        const world = worlds.get(session.worldId);
        if (!world?.ready) break;
        const ability = { damageMin: msg.damage, damageMax: msg.damage, range: 999, type: "melee" };
        const damage  = msg.damage;
        const result  = world.resolveAttack(msg.npcId, damage, session);
        if (!result) break;
        _broadcast(session.worldId, {
          type: "npc_damaged", npcId: msg.npcId,
          hp: result.hp, maxHp: result.maxHp,
          damage, attackerName: session.name
        });
        if (result.dead) {
          const count   = _playersInWorld(session.worldId).length;
          const xpShare = Math.floor(result.xpValue / Math.max(1, count));
          _broadcast(session.worldId, {
            type: "npc_killed", npcId: msg.npcId,
            killerName: session.name, xpShare, loot: result.loot
          });
        }
        break;
      }

      case "taunt": {
        if (!session) break;
        const world = worlds.get(session.worldId);
        if (!world?.ready) break;
        const count = world.resolveTaunt(session.playerToken, msg.radius ?? 6);
        _send(ws, { type: "taunt_result", count });
        break;
      }

      case "heal_threat": {
        // Healer generates threat on all NPCs targeting the healed player
        if (!session) break;
        const world = worlds.get(session.worldId);
        if (!world?.ready) break;
        const amount = msg.amount ?? 0;
        for (const npc of world.npcs.values()) {
          if (npc.dead) continue;
          if (npc.target === msg.targetToken) {
            world._addThreat(npc, session.playerToken, amount * 0.5, "heal");
          }
        }
        break;
      }

      case "respawn": {
        // Player respawned — reset HP on server
        if (!session) break;
        session.hp            = session.maxHp;
        session.buffActive    = null;
        session.buffExpiresAt = 0;
        // Clear all cooldowns
        session.cooldowns = {};
        // Send fresh stat update back
        _send(ws, {
          type:  "player_stat_update",
          hp:    session.hp,
          maxHp: session.maxHp,
          xp:    session.xp,
          gold:  session.gold
        });
        console.log(`[Server] ${session.name} respawned`);
        break;
      }

      case "ping": {
        if (session) session.lastSeen = Date.now();
        _send(ws, { type: "pong" });
        break;
      }

      case "leave": {
        if (session) { _removePlayer(session.playerToken); session = null; }
        break;
      }
    }
  });

  ws.on("close", () => { if (session) { _removePlayer(session.playerToken); session = null; } });
  ws.on("error", e  => console.warn("[Server] WS error:", e.message));
});

// ── Tick loop ─────────────────────────────────────────────────────────────
let tick = 0;
setInterval(() => {
  tick++;

  // Prune stale players
  const now = Date.now();
  for (const [token, s] of players) {
    if (now - s.lastSeen > STALE_MS) {
      console.log(`[Server] Stale player removed: ${s.name}`);
      _removePlayer(token);
      continue;
    }
    // Tick player cooldowns and regen mana
    for (const abilityId of Object.keys(s.cooldowns ?? {})) {
      s.cooldowns[abilityId] = Math.max(0, s.cooldowns[abilityId] - TICK_MS);
      if (s.cooldowns[abilityId] <= 0) delete s.cooldowns[abilityId];
    }
    // Mana regen — 0.5 mana per tick = 10 mana/sec
    if (s.mana !== undefined && s.maxMana) {
      s.mana = Math.min(s.maxMana, (s.mana ?? 0) + 0.5);
    }  }

  // Tick all worlds
  for (const world of worlds.values()) {
    if (!world.ready) continue;
    world.tick(TICK_MS);
    world.tickDoTs(TICK_MS);
    for (const token of world.players) {
      const s = players.get(token);
      if (s?.pendingCast && Date.now() >= s.pendingCast.resolveAt) {
        const cast = s.pendingCast; s.pendingCast = null;
        const saved = s.cooldowns[cast.abilityId]; s.cooldowns[cast.abilityId] = 0;
        _resolveAbility(s, world, { ...cast, skipCastTime: true });
        s.cooldowns[cast.abilityId] = saved;
      }
    }

    // Rage decay for fighters out of combat
    for (const token of world.players) {
      const s = players.get(token);
      if (s?.classId === "fighter" && (s.rage ?? 0) > 0) {
        const secsSinceCombat = (Date.now() - (s.lastCombatAt ?? 0)) / 1000;
        if (secsSinceCombat > 5) {
          s.rage = Math.max(0, s.rage - (0.8 * TICK_MS / 1000));
          _send(s.ws, { type: "rage_update", rage: s.rage });
        }
      }
    }

    // Broadcast NPC state every N ticks
    if (tick % NPC_BROADCAST_TICKS === 0) {
      const state = world.getNPCState();
      if (!state.length) continue;
      const raw = JSON.stringify({ type: "npc_state", npcs: state });
      for (const token of world.players) {
        const s = players.get(token);
        if (s?.ws.readyState === WebSocket.OPEN) s.ws.send(raw);
      }
    }
  }
}, TICK_MS);

// ── WorldInstance ─────────────────────────────────────────────────────────
class WorldInstance {
  constructor(worldId) {
    this.worldId = worldId;
    this.players = new Set();  // playerTokens
    this.npcs    = new Map();  // npcId -> ServerNPC
    this.ready   = false;
    this.width   = 256;
    this.height  = 256;
    this.tiles   = null;
  }

  async load() {
    try {
      // Load world tiles for walkability checks
      const rows = await sb(`worlds?id=eq.${this.worldId}&select=json`);
      if (rows?.length) {
        const data   = rows[0].json;
        this.width   = data.width  ?? this.width;
        this.height  = data.height ?? this.height;
        this.tiles   = Array.isArray(data.tiles) ? data.tiles : null;
      }

      // Load NPCs exclusively from Supabase world JSON spawns[]
      for (const s of (rows?.[0]?.json?.spawns ?? [])) {
        const def = monsterDefs.get(s.monsterId);
        if (!def) { console.warn(`[Server] Unknown monsterId: ${s.monsterId}`); continue; }
        const id = `${s.monsterId}_${s.x}_${s.y}`;
        this.npcs.set(id, {
          id,
          monsterId:    s.monsterId,
          name:         def.name,
          icon:         def.icon,
          tier:         def.tier              ?? 1,
          isElite:      def.is_elite          ?? false,
          isBoss:       def.is_boss           ?? false,
          x:            s.x,
          y:            s.y,
          homeX:        s.x,
          homeY:        s.y,
          hp:           def.combat.hp,
          maxHp:        def.combat.hp,
          ac:           def.combat.ac         ?? 8,
          damageMin:    def.combat.damage_min,
          damageMax:    def.combat.damage_max,
          attackType:   def.combat.attack_type  ?? "melee",
          attackRange:  def.combat.attack_range ?? 1,
          speed:        def.combat.speed,
          regenPerTick: def.combat.regen_per_tick ?? 0,
          perception:   def.behaviour.perception,
          roamRadius:   s.roamRadius ?? def.behaviour.roam_radius ?? 3,
          aggroType:    def.behaviour.aggro_type  ?? "aggressive",
          abilities:    def.behaviour.abilities   ?? [],
          stats:        def.stats ?? {},
          xpValue:      def.rewards.xp_value,
          state:        "roaming",
          target:       null,
          threat:       {},
          dead:         false,
          actionTimer:  1000 + Math.random() * 2000,
          moveTimer:    Math.random() * 1000,
          respawnSecs:  def.is_boss ? 600 : def.is_elite ? 420 : 300,
          deadAt:       null,
          dots:         []
        });
      }

      this.ready = true;
      const sample = [...this.npcs.values()][0];
      console.log(`[Server] Loaded world ${this.worldId} — ${this.npcs.size} NPCs`);
      if (sample) console.log(`[Server] Sample NPC: ${sample.id} speed=${sample.speed} perception=${sample.perception} dmg=${sample.damageMin}-${sample.damageMax}`);
    } catch (e) {
      console.warn(`[Server] World load error (${this.worldId}):`, e.message);
      this.ready = true;
    }
  }

  // ── Tick ───────────────────────────────────────────────────────────────

  tick(dt) {
    const playersHere = [...this.players]
      .map(t => players.get(t))
      .filter(Boolean);

    for (const npc of this.npcs.values()) {
      if (npc.dead) {
        this._tickRespawn(npc, dt);
        continue;
      }
      this._tickNPC(npc, playersHere, dt);
    }
  }

  _tickRespawn(npc, dt) {
    if (!npc.respawnSecs || !npc.deadAt) return;
    const elapsed = (Date.now() - npc.deadAt) / 1000;
    if (elapsed >= npc.respawnSecs) {
      // Respawn at home position
      npc.dead   = false;
      npc.hp     = npc.maxHp;
      npc.x      = npc.homeX;
      npc.y      = npc.homeY;
      npc.state  = "roaming";
      npc.target = null;
      npc.deadAt = null;
      console.log(`[Server] Respawned ${npc.id}`);
    }
  }

  _tickNPC(npc, playersHere, dt) {
    // Stunned NPCs skip all actions
    const now = Date.now();
    if (npc.stunnedUntil && now < npc.stunnedUntil) {
      npc.state = "stunned";
      return;
    }
    if (npc.stunnedUntil && now >= npc.stunnedUntil) {
      npc.stunnedUntil = null; // stun expired, slow lingers via slowedUntil
    }

    npc.actionTimer -= dt;
    npc.moveTimer   -= dt;

    // ── Threat decay ──
    this._decayThreat(npc);

    // ── Perception ──
    let nearest = null, nearestDist = Infinity;
    for (const p of playersHere) {
      const dx = p.x - npc.x, dy = p.y - npc.y;
      const d  = Math.sqrt(dx*dx + dy*dy);
      if (d < nearestDist) { nearestDist = d; nearest = p; }
    }

    // If NPC has a forced target from group aggro, use that player
    // even if they're outside normal perception range
    if (npc.target && npc.state === "alert") {
      const forcedTarget = playersHere.find(p => p.playerToken === npc.target);
      if (forcedTarget) {
        nearest     = forcedTarget;
        nearestDist = Math.sqrt(
          (forcedTarget.x - npc.x)**2 + (forcedTarget.y - npc.y)**2
        );
      }
    }

    // ── State machine ──
    if (nearest && nearestDist <= npc.perception) {
      npc.state  = "alert";
      npc.target = nearest.playerToken;
    } else if (npc.state === "alert" && npc.target) {
      // Stay alert if we have a target — only drop if target is gone and out of range
      const hasTarget = playersHere.some(p => p.playerToken === npc.target);
      if (!hasTarget && nearestDist > npc.perception * 2) {
        npc.state  = "roaming";
        npc.target = null;
      }
    }

    // ── Movement ──
    if (npc.moveTimer <= 0) {
      const isSlowed = npc.slowedUntil && Date.now() < npc.slowedUntil;
      npc.moveTimer = 1000 / ((isSlowed ? 0.5 : 1) * (npc.speed ?? 3));

      if (npc.state === "alert" && nearest) {
        const dx      = nearest.x - npc.x;
        const dy      = nearest.y - npc.y;
        const dist    = Math.sqrt(dx*dx + dy*dy);
        const stopAt  = npc.attackRange ?? 1;
        // Move toward player until within attack range, then hold position
        if (dist > stopAt + 0.5) {
          const nx = npc.x + Math.sign(dx);
          const ny = npc.y + Math.sign(dy);
          if (this._walkable(nx, npc.y))      npc.x = nx;
          else if (this._walkable(npc.x, ny)) npc.y = ny;
        }
      } else if (npc.state === "roaming") {
        const dx = npc.homeX - npc.x, dy = npc.homeY - npc.y;
        const d  = Math.sqrt(dx*dx + dy*dy);
        if (d > npc.roamRadius) {
          if (this._walkable(npc.x + Math.sign(dx), npc.y))      npc.x += Math.sign(dx);
          else if (this._walkable(npc.x, npc.y + Math.sign(dy))) npc.y += Math.sign(dy);
        } else if (Math.random() < 0.25) {
          const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
          const d2   = dirs[Math.floor(Math.random() * 4)];
          if (this._walkable(npc.x + d2.x, npc.y + d2.y)) {
            npc.x += d2.x; npc.y += d2.y;
          }
        }
      }
    }

    // ── Attack ──
    if (npc.state === "alert" && nearest && npc.actionTimer <= 0) {
      const dx       = nearest.x - npc.x, dy = nearest.y - npc.y;
      const d        = Math.sqrt(dx*dx + dy*dy);
      const atkRange = npc.attackRange ?? 1;
      if (d <= atkRange + 0.5) {
        npc.actionTimer = 1500;

        // Check if player has buff (divine shield etc)
        const playerSession = players.get(nearest.playerToken);
        if (playerSession?.buffActive && Date.now() < playerSession.buffExpiresAt) {
          // Player is invulnerable — notify but deal no damage
          _send(playerSession.ws, { type: "npc_attack_player", npcId: npc.id, damage: 0, blocked: true });
          return;
        }

        let dmg = npc.damageMin + Math.floor(
          Math.random() * (npc.damageMax - npc.damageMin + 1)
        );

        // Apply fortify damage reduction
        if (playerSession?.fortify && Date.now() < playerSession.fortify.expiresAt) {
          const reflected = Math.floor(dmg * (playerSession.fortify.reflect ?? 0));
          dmg = Math.floor(dmg * playerSession.fortify.magnitude);
          if (reflected > 0) {
            npc.hp = Math.max(0, npc.hp - reflected);
            _broadcast(playerSession.worldId, { type: "npc_damaged", npcId: npc.id, hp: npc.hp, maxHp: npc.maxHp, damage: reflected, attackerName: "reflect", isDot: true });
          }
        }

        // Apply damage to player session server-side
        if (playerSession) {
          playerSession.hp = Math.max(0, (playerSession.hp ?? 0) - dmg);
          // Generate rage for fighter on taking damage
          if (playerSession.classId === "fighter" && dmg > 0) {
            playerSession.rage = Math.min(100, (playerSession.rage ?? 0) + 5);
            playerSession.lastCombatAt = Date.now();
          }
          // Aura of Retribution — reflect holy damage back to attacker
          if (playerSession.activeAura === "aura_of_retribution" && playerSession.auraEffect && dmg > 0) {
            let reflectDmg = playerSession.auraEffect.reflectDamage ?? 8;
            if (playerSession.auraEffect.scalesWithMissingHp) {
              const missingPct = 1 - (playerSession.hp / (playerSession.maxHp ?? 1));
              reflectDmg = Math.round(reflectDmg * (1 + missingPct));
            }
            npc.hp = Math.max(0, npc.hp - reflectDmg);
            _broadcast(playerSession.worldId, { type: "npc_damaged", npcId: npc.id, hp: npc.hp, maxHp: npc.maxHp, damage: reflectDmg, attackerName: "Retribution", isDot: true });
            if (npc.hp <= 0 && !npc.dead) {
              npc.dead = true; npc.state = "dead"; npc.deadAt = Date.now();
              _handleNPCKill(playerSession, worlds.get(playerSession.worldId), npc.id, { hp:0, maxHp:npc.maxHp, dead:true, xpValue:npc.xpValue, loot: worlds.get(playerSession.worldId)?._rollLoot(npc) });
            }
          }
          _send(playerSession.ws, {
            type: "player_stat_update",
            hp: playerSession.hp, maxHp: playerSession.maxHp,
            xp: playerSession.xp, gold: playerSession.gold,
            rage: playerSession.rage ?? null
          });
        }

        // Notify player they were attacked
        _send(nearest.ws ?? playerSession?.ws, {
          type:        "npc_attack_player",
          npcId:       npc.id,
          targetToken: nearest.playerToken,
          damage:      dmg
        });
      }
    }
  }

  // ── Combat ─────────────────────────────────────────────────────────────

  // ── Threat & Aggro ─────────────────────────────────────────────────────

  /**
   * Add threat to an NPC from a player action.
   * Recalculates aggro target based on highest threat.
   *
   * @param {object} npc
   * @param {string} playerToken
   * @param {number} amount       - threat generated
   * @param {string} [type]       - "damage" | "heal" | "taunt"
   */
  _addThreat(npc, playerToken, amount, type = "damage") {
    if (!npc.threat) npc.threat = {};

    // Taunt multiplies threat massively
    const multiplier = type === "taunt" ? 5 : type === "heal" ? 0.5 : 1;
    const threat     = amount * multiplier;

    npc.threat[playerToken] = (npc.threat[playerToken] ?? 0) + threat;

    // Recalculate aggro target — highest threat player
    this._updateAggroTarget(npc);
  }

  /**
   * Set aggro target to the player with highest threat.
   * Only considers players currently in the world.
   */
  _updateAggroTarget(npc) {
    const playersHere = [...this.players]
      .map(t => players.get(t))
      .filter(Boolean);

    let topToken  = null;
    let topThreat = 0;

    for (const [token, threat] of Object.entries(npc.threat ?? {})) {
      const player = playersHere.find(p => p.playerToken === token);
      if (!player) continue; // player left
      if (threat > topThreat) {
        topThreat = threat;
        topToken  = token;
      }
    }

    if (topToken) {
      npc.target = topToken;
      npc.state  = "alert";
    }
  }

  /**
   * Decay all threat values over time (called in tick).
   * Prevents permanent aggro lock on AFK players.
   */
  _decayThreat(npc) {
    const DECAY = 0.999; // per tick — very slow decay
    for (const token of Object.keys(npc.threat ?? {})) {
      npc.threat[token] *= DECAY;
      if (npc.threat[token] < 0.1) delete npc.threat[token];
    }
  }

  /**
   * Group aggro — alert nearby NPCs and give them initial threat.
   */
  _triggerGroupAggro(attackedNPC, playerToken, damage) {
    const AGGRO_RADIUS = 8;
    for (const other of this.npcs.values()) {
      if (other.dead || other.id === attackedNPC.id) continue;
      const dx   = other.x - attackedNPC.x;
      const dy   = other.y - attackedNPC.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist <= AGGRO_RADIUS) {
        // Add partial threat (witnesses get less threat than the target)
        this._addThreat(other, playerToken, damage * 0.5, "damage");
      }
    }
  }

  resolveAttack(npcId, damage, attacker) {
    const npc = this.npcs.get(npcId);
    if (!npc || npc.dead) return null;

    npc.hp = Math.max(0, npc.hp - damage);

    // Add full threat for the attacker, partial for nearby NPCs
    this._addThreat(npc, attacker.playerToken, damage, "damage");
    this._triggerGroupAggro(npc, attacker.playerToken, damage);

    if (npc.hp <= 0) {
      npc.dead   = true;
      npc.state  = "dead";
      npc.deadAt = Date.now();
      // Clear threat on death
      npc.threat = {};
      return {
        hp:       0,
        maxHp:    npc.maxHp,
        dead:     true,
        xpValue:  npc.xpValue,
        loot:     this._rollLoot(npc)
      };
    }

    return { hp: npc.hp, maxHp: npc.maxHp, dead: false };
  }

  /**
   * Handle taunt ability — massively boost threat for the taunting player.
   */
  resolveTaunt(playerToken, radius = 6) {
    const taunter = players.get(playerToken);
    if (!taunter) return;

    let count = 0;
    for (const npc of this.npcs.values()) {
      if (npc.dead) continue;
      const dx   = npc.x - taunter.x;
      const dy   = npc.y - taunter.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist <= radius) {
        this._addThreat(npc, playerToken, 1000, "taunt");
        count++;
      }
    }
    console.log(`[Server] Taunt: ${taunter.name} taunted ${count} NPCs`);
    return count;
  }

  _rollLoot(npc) {
    const baseGold = npc.isBoss
      ? 50 + Math.floor(Math.random() * 100)
      : npc.isElite
        ? 20 + Math.floor(Math.random() * 40)
        : 3  + Math.floor(Math.random() * 10);

    const monsterId = npc.monsterId ?? npc.id.split('_')[0];
    const tier      = npc.tier ?? 1;
    console.log(`[loot] Rolling for ${monsterId} tier=${tier} elite=${npc.isElite} boss=${npc.isBoss} specific=${lootByMonster.get(monsterId)?.length ?? 0} pool=${lootByTier.get(tier)?.length ?? 0}`);
    const drops     = [];

    // 1. Monster-specific override table (elites/bosses always have one)
    const specific = lootByMonster.get(monsterId) ?? [];
    for (const entry of specific) {
      if (Math.random() < entry.drop_chance) {
        drops.push({ itemId: entry.id, name: entry.name, icon: entry.icon,
                     itemType: entry.item_type, rarity: entry.rarity,
                     qty: 1, ...(entry.data ?? {}) });
      }
    }

    // 2. Tier pool drop
    const baseDropChance = npc.isBoss ? 0.85 : npc.isElite ? 0.60 : 0.12;
    if (Math.random() < baseDropChance) {
      const pool = lootByTier.get(tier) ?? [];
      if (pool.length > 0) {
        const totalWeight = pool.reduce((sum, e) => sum + Number(e.drop_chance), 0);
        let roll = Math.random() * totalWeight;
        for (const entry of pool) {
          roll -= Number(entry.drop_chance);
          if (roll <= 0) {
            drops.push({ itemId: entry.id, name: entry.name, icon: entry.icon,
                         itemType: entry.item_type, rarity: entry.rarity,
                         qty: 1, ...(entry.data ?? {}) });
            break;
          }
        }
      }
    }

    return { gold: baseGold, items: drops };
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  // ── DoT System ────────────────────────────────────────────────────────────
  applyDoT(npcId, effect, duration, magnitude, attackerToken) {
    const npc = this.npcs.get(npcId);
    if (!npc || npc.dead) return;
    if (!npc.dots) npc.dots = [];
    // Replace existing DoT of same type
    npc.dots = npc.dots.filter(d => d.effect !== effect);
    npc.dots.push({
      effect,
      magnitude,        // damage per tick
      ticksRemaining:   Math.floor(duration / 50), // duration in ms / tick interval
      tickInterval:     40,                          // ticks between damage (every 2s at 50ms/tick)
      tickTimer:        0,
      attackerToken
    });
  }

  tickDoTs(dt) {
    for (const npc of this.npcs.values()) {
      if (npc.dead || !npc.dots?.length) continue;
      const expired = [];
      for (const dot of npc.dots) {
        dot.ticksRemaining -= 1;
        dot.tickTimer      += 1;
        if (dot.tickTimer >= dot.tickInterval) {
          dot.tickTimer = 0;
          // Apply dot damage
          const dmg = dot.magnitude;
          npc.hp = Math.max(0, npc.hp - dmg);
          // Broadcast tick damage
          const raw = JSON.stringify({
            type: "npc_damaged", npcId: npc.id,
            hp: npc.hp, maxHp: npc.maxHp,
            damage: dmg, attackerName: `${dot.effect}`,
            isDot: true
          });
          for (const token of this.players) {
            const s = players.get(token);
            if (s?.ws.readyState === 1) s.ws.send(raw);
          }
          if (npc.hp <= 0 && !npc.dead) {
            npc.dead = true;
            npc.state = "dead";
            npc.deadAt = Date.now();
            const attacker = players.get(dot.attackerToken);
            if (attacker) _handleNPCKill(attacker, this, npc.id, {
              hp: 0, maxHp: npc.maxHp, dead: true, xpValue: npc.xpValue,
              loot: this._rollLoot(npc)
            });
          }
        }
        if (dot.ticksRemaining <= 0) expired.push(dot);
      }
      npc.dots = npc.dots.filter(d => !expired.includes(d));
    }
  }

  _walkable(x, y) {
    if (!this.tiles) return true;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const WALKABLE = new Set([
      0,4,5,6,7,9,10,11,12,13,14,15,17,19,
      20,22,23,24,25,26,27,28,29,30,31,32,33,35
    ]);
    return WALKABLE.has(this.tiles[y * this.width + x]);
  }

  getNPCState() {
    return [...this.npcs.values()]
      .filter(n => !n.dead)
      .map(n => ({
        id:      n.id,
        name:    n.name,
        icon:    n.icon,
        x:       n.x,
        y:       n.y,
        hp:      n.hp,
        maxHp:   n.maxHp,
        state:   n.state,
        isBoss:  n.isBoss,
        target:  n.target ?? null   // who has aggro
      }));
  }

  addPlayer(t)    { this.players.add(t); }
  removePlayer(t) { this.players.delete(t); }
}

// ── Server registration ───────────────────────────────────────────────────
let _serverId = null;

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
  await loadLootTables();
  await loadAbilityDefs();

  // Initialize ability resolvers with server dependencies
  AbilityRouter.init({
    worlds,
    players,
    send:           _send,
    broadcast:      _broadcast,
    handleNPCKill:  _handleNPCKill,
    applyHeal:      _applyHeal,
  });

  
  try {
    await registerServer();
  } catch (e) {
    console.warn("[Server] Registration failed — continuing without Supabase registration:", e.message);
  }

  setInterval(pingServer, PING_INTERVAL_MS);
  server.listen(PORT);
})();