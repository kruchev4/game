/**
 * MultiplayerSystem.js
 *
 * Phase 1 — Presence and movement sync.
 *
 * Each client:
 *   - Writes its own row to roe2_presence on join
 *   - Broadcasts position/state every BROADCAST_MS milliseconds
 *   - Subscribes to Realtime changes on roe2_presence
 *   - Maintains a map of remote player entities
 *   - Deletes its row on leave/disconnect
 *
 * Remote players are rendered by Renderer as friendly entities
 * with name tags. They have no combat AI — they just move.
 *
 * NPC state is NOT synced in Phase 1 — each client runs its own
 * simulation. Phase 2 will add server-authoritative NPC state.
 */

import { createClient }          from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config/supabaseConfig.js";

const BROADCAST_MS   = 100;   // how often we send our position
const STALE_MS       = 8000;  // remove remote player if no update for 8s
const PRESENCE_TABLE = "roe2_presence";

export class MultiplayerSystem {
  /**
   * @param {object}   opts
   * @param {object}   opts.player       - local player entity
   * @param {string}   opts.worldId      - current world ID
   * @param {string}   opts.playerToken  - unique player identifier
   * @param {Function} opts.onPlayerJoin   - (remotePlayer) => {}
   * @param {Function} opts.onPlayerLeave  - (playerToken) => {}
   * @param {Function} opts.onPlayerUpdate - (remotePlayer) => {}
   */
  constructor({ player, worldId, playerToken, onPlayerJoin, onPlayerLeave, onPlayerUpdate }) {
    this.player       = player;
    this.worldId      = worldId;
    this.playerToken  = playerToken;
    this.onPlayerJoin   = onPlayerJoin   ?? (() => {});
    this.onPlayerLeave  = onPlayerLeave  ?? (() => {});
    this.onPlayerUpdate = onPlayerUpdate ?? (() => {});

    this._supabase      = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this._channel       = null;
    this._remotePlayers = new Map(); // token -> { entity, lastSeen }
    this._broadcastTimer = 0;
    this._staleTimer     = 0;
    this._joined         = false;
    this._presenceId     = null; // uuid of our row
  }

  // ─────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────

  async join() {
    if (this._joined) return;
    this._joined = true;

    // Write our presence row
    await this._upsertPresence();

    // Subscribe to realtime changes on this world
    this._channel = this._supabase
      .channel(`world:${this.worldId}`)
      .on(
        "postgres_changes",
        {
          event:  "*",
          schema: "public",
          table:  PRESENCE_TABLE,
          filter: `world_id=eq.${this.worldId}`
        },
        (payload) => this._onPresenceChange(payload)
      )
      .subscribe();

    // Load existing players already in this world
    await this._loadExistingPlayers();

    // Clean up on page unload
    window.addEventListener("beforeunload", () => this.leave());

    console.log(`[MP] Joined world ${this.worldId} as ${this.player.name}`);
  }

  async leave() {
    if (!this._joined) return;
    this._joined = false;

    // Remove our presence row
    if (this._presenceId) {
      await this._supabase
        .from(PRESENCE_TABLE)
        .delete()
        .eq("id", this._presenceId);
    }

    // Unsubscribe
    if (this._channel) {
      await this._supabase.removeChannel(this._channel);
      this._channel = null;
    }

    // Notify engine to remove all remote players
    for (const token of this._remotePlayers.keys()) {
      this.onPlayerLeave(token);
    }
    this._remotePlayers.clear();

    console.log("[MP] Left world");
  }

  // ─────────────────────────────────────────────
  // UPDATE — call once per frame from Engine
  // ─────────────────────────────────────────────

  update(dt = 1) {
    if (!this._joined) return;

    // Broadcast our position at BROADCAST_MS intervals
    this._broadcastTimer += dt * (1000 / 60); // dt is frames, convert to ms
    if (this._broadcastTimer >= BROADCAST_MS) {
      this._broadcastTimer = 0;
      this._upsertPresence().catch(() => {});
    }

    // Clean up stale remote players
    this._staleTimer += dt * (1000 / 60);
    if (this._staleTimer >= 2000) {
      this._staleTimer = 0;
      this._pruneStale();
    }
  }

  // ─────────────────────────────────────────────
  // PRESENCE
  // ─────────────────────────────────────────────

  async _upsertPresence() {
    const p = this.player;
    const payload = {
      player_token: this.playerToken,
      world_id:     this.worldId,
      x:            Math.round(p.x),
      y:            Math.round(p.y),
      name:         p.name    ?? "Hero",
      classid:      p.classId ?? "fighter",
      icon:         p.icon    ?? "🧙",
      hp:           Math.ceil(p.hp     ?? 0),
      max_hp:       p.maxHp   ?? 80,
      level:        p.level   ?? 1,
      state:        p.inCombat ? "combat" : "idle",
      updated_at:   new Date().toISOString()
    };

    const { data, error } = await this._supabase
      .from(PRESENCE_TABLE)
      .upsert(payload, { onConflict: "player_token" })
      .select("id")
      .single();

    if (error) {
      console.warn("[MP] Presence upsert failed:", error.message);
    } else if (data?.id && !this._presenceId) {
      this._presenceId = data.id;
    }
  }

  async _loadExistingPlayers() {
    const { data, error } = await this._supabase
      .from(PRESENCE_TABLE)
      .select("*")
      .eq("world_id", this.worldId)
      .neq("player_token", this.playerToken);

    if (error) { console.warn("[MP] Load existing failed:", error.message); return; }

    for (const row of (data ?? [])) {
      // Skip stale rows
      if (Date.now() - new Date(row.updated_at).getTime() > STALE_MS) continue;
      this._addOrUpdateRemote(row);
    }
  }

  // ─────────────────────────────────────────────
  // REALTIME HANDLER
  // ─────────────────────────────────────────────

  _onPresenceChange(payload) {
    const { eventType, new: newRow, old: oldRow } = payload;

    if (eventType === "DELETE") {
      const token = oldRow?.player_token;
      if (token && token !== this.playerToken) {
        this._remotePlayers.delete(token);
        this.onPlayerLeave(token);
      }
      return;
    }

    // INSERT or UPDATE
    const row = newRow;
    if (!row || row.player_token === this.playerToken) return;

    this._addOrUpdateRemote(row);
  }

  _addOrUpdateRemote(row) {
    const token = row.player_token;
    const entry = this._remotePlayers.get(token);

    if (entry) {
      // Update existing remote player entity
      const e = entry.entity;
      e.x      = row.x;
      e.y      = row.y;
      e.hp     = row.hp;
      e.maxHp  = row.max_hp;
      e.level  = row.level;
      e.state  = row.state;
      entry.lastSeen = Date.now();
      this.onPlayerUpdate(e);
    } else {
      // New remote player — create entity
      const entity = this._makeRemoteEntity(row);
      this._remotePlayers.set(token, { entity, lastSeen: Date.now() });
      this.onPlayerJoin(entity);
    }
  }

  _makeRemoteEntity(row) {
    return {
      id:           `remote_${row.player_token}`,
      type:         "remote_player",
      playerToken:  row.player_token,
      x:            row.x,
      y:            row.y,
      name:         row.name   ?? "Hero",
      classId:      row.classid ?? "fighter",
      icon:         row.icon   ?? "🧙",
      hp:           row.hp     ?? 80,
      maxHp:        row.max_hp ?? 80,
      level:        row.level  ?? 1,
      state:        row.state  ?? "idle",
      dead:         false,
      isRemote:     true
    };
  }

  _pruneStale() {
    const now = Date.now();
    for (const [token, entry] of this._remotePlayers) {
      if (now - entry.lastSeen > STALE_MS) {
        this._remotePlayers.delete(token);
        this.onPlayerLeave(token);
        console.log(`[MP] Pruned stale player ${entry.entity.name}`);
      }
    }
  }

  // ─────────────────────────────────────────────
  // ACCESSORS
  // ─────────────────────────────────────────────

  get remotePlayers() {
    return [...this._remotePlayers.values()].map(e => e.entity);
  }

  getRemotePlayer(token) {
    return this._remotePlayers.get(token)?.entity ?? null;
  }
}
