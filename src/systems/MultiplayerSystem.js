/**
 * MultiplayerSystem.js
 *
 * Connects to the Node.js game server via WebSocket.
 * Handles player presence, movement sync, and co-op combat.
 */

const SERVER_URL   = "ws://192.168.68.62:8080";
const MOVE_MS      = 100;   // broadcast position every 100ms
const PING_MS      = 5000;  // keepalive ping every 5s

export class MultiplayerSystem {
  constructor({ player, worldId, playerToken, onPlayerJoin, onPlayerLeave, onPlayerUpdate, onNPCDamaged, onNPCKilled }) {
    this.player       = player;
    this.worldId      = worldId;
    this.playerToken  = playerToken;
    this.onPlayerJoin   = onPlayerJoin   ?? (() => {});
    this.onPlayerLeave  = onPlayerLeave  ?? (() => {});
    this.onPlayerUpdate = onPlayerUpdate ?? (() => {});
    this.onNPCDamaged   = onNPCDamaged   ?? (() => {});
    this.onNPCKilled    = onNPCKilled    ?? (() => {});

    this._ws             = null;
    this._remotePlayers  = new Map(); // token -> entity
    this._moveTimer      = 0;
    this._pingTimer      = 0;
    this._connected      = false;
    this._reconnectDelay = 2000;
    this._dead           = false;    // set true on leave() to stop reconnects
  }

  // ─────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────

  join() {
    this._dead = false;
    this._connect();
    window.addEventListener("beforeunload", () => this.leave());
  }

  leave() {
    this._dead = true;
    if (this._ws) {
      this._send({ type: "leave" });
      this._ws.close();
      this._ws = null;
    }
    for (const token of this._remotePlayers.keys()) {
      this.onPlayerLeave(token);
    }
    this._remotePlayers.clear();
    this._connected = false;
  }

  // ─────────────────────────────────────────────
  // UPDATE — call once per frame
  // ─────────────────────────────────────────────

  update(dt = 1) {
    if (!this._connected) return;

    const frameMs = dt * (1000 / 60);

    // Position broadcast
    this._moveTimer += frameMs;
    if (this._moveTimer >= MOVE_MS) {
      this._moveTimer = 0;
      this._broadcastMove();
    }

    // Keepalive ping
    this._pingTimer += frameMs;
    if (this._pingTimer >= PING_MS) {
      this._pingTimer = 0;
      this._send({ type: "ping" });
    }
  }

  // ─────────────────────────────────────────────
  // COMBAT API — called by Engine
  // ─────────────────────────────────────────────

  /**
   * Tell server this player attacked an NPC.
   * Server resolves damage and broadcasts result to all clients.
   */
  sendAttack({ npcId, damage, abilityId }) {
    this._send({ type: "npc_attack", npcId, damage, abilityId });
  }

  /**
   * Register an NPC with the server so it can track HP.
   * Call when spawning NPCs.
   */
  registerNPC(npc) {
    this._send({
      type: "npc_register",
      npc: {
        id:       npc.id,
        classId:  npc.classId,
        hp:       npc.hp,
        maxHp:    npc.maxHp,
        xpValue:  npc.xpValue ?? 30,
      }
    });
  }

  /**
   * Broadcast state change (HP, level etc) to other players.
   */
  broadcastState() {
    const p = this.player;
    this._send({
      type:  "state_update",
      hp:    Math.ceil(p.hp),
      maxHp: p.maxHp,
      level: p.level
    });
  }

  // ─────────────────────────────────────────────
  // WEBSOCKET
  // ─────────────────────────────────────────────

  _connect() {
    if (this._dead) return;

    console.log(`[MP] Connecting to ${SERVER_URL}...`);

    try {
      this._ws = new WebSocket(SERVER_URL);
    } catch (e) {
      console.warn("[MP] WebSocket creation failed:", e.message);
      this._scheduleReconnect();
      return;
    }

    this._ws.addEventListener("open", () => {
      console.log("[MP] Connected to server");
      this._connected      = true;
      this._reconnectDelay = 2000; // reset backoff

      // Send join message
      const p = this.player;
      this._send({
        type:        "join",
        playerToken: this.playerToken,
        worldId:     this.worldId,
        name:        p.name    ?? "Hero",
        classId:     p.classId ?? "fighter",
        icon:        p.icon    ?? "🧙",
        hp:          Math.ceil(p.hp ?? 80),
        maxHp:       p.maxHp   ?? 80,
        level:       p.level   ?? 1,
        x:           p.x       ?? 0,
        y:           p.y       ?? 0
      });
    });

    this._ws.addEventListener("message", (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      this._onMessage(msg);
    });

    this._ws.addEventListener("close", () => {
      this._connected = false;
      console.log("[MP] Disconnected from server");
      this._scheduleReconnect();
    });

    this._ws.addEventListener("error", (e) => {
      console.warn("[MP] WebSocket error:", e.message ?? e);
    });
  }

  _scheduleReconnect() {
    if (this._dead) return;
    console.log(`[MP] Reconnecting in ${this._reconnectDelay}ms...`);
    setTimeout(() => this._connect(), this._reconnectDelay);
    this._reconnectDelay = Math.min(this._reconnectDelay * 2, 30000); // exponential backoff, max 30s
  }

  _send(msg) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(msg));
    }
  }

  _broadcastMove() {
    const p = this.player;
    this._send({
      type:  "move",
      x:     Math.round(p.x),
      y:     Math.round(p.y),
      state: p.inCombat ? "combat" : "idle"
    });
  }

  // ─────────────────────────────────────────────
  // MESSAGE HANDLER
  // ─────────────────────────────────────────────

  _onMessage(msg) {
    switch (msg.type) {

      case "world_state": {
        // Initial state — list of players already in this world
        for (const playerData of (msg.players ?? [])) {
          this._addOrUpdateRemote(playerData);
        }
        break;
      }

      case "player_joined": {
        this._addOrUpdateRemote(msg.player);
        break;
      }

      case "player_moved": {
        const entity = this._remotePlayers.get(msg.token);
        if (entity) {
          entity.x     = msg.x;
          entity.y     = msg.y;
          entity.state = msg.state;
          this.onPlayerUpdate(entity);
        }
        break;
      }

      case "player_updated": {
        this._addOrUpdateRemote(msg.player);
        break;
      }

      case "player_left": {
        const entity = this._remotePlayers.get(msg.token);
        if (entity) {
          this._remotePlayers.delete(msg.token);
          this.onPlayerLeave(msg.token);
        }
        break;
      }

      case "npc_damaged": {
        this.onNPCDamaged({
          npcId:        msg.npcId,
          hp:           msg.hp,
          maxHp:        msg.maxHp,
          damage:       msg.damage,
          attackerName: msg.attackerName
        });
        break;
      }

      case "npc_killed": {
        this.onNPCKilled({
          npcId:       msg.npcId,
          killerName:  msg.killerName,
          xpShare:     msg.xpShare,
          loot:        msg.loot
        });
        break;
      }

      case "pong": break; // keepalive response

      default:
        console.log("[MP] Unknown message:", msg.type);
    }
  }

  // ─────────────────────────────────────────────
  // REMOTE PLAYER MANAGEMENT
  // ─────────────────────────────────────────────

  _addOrUpdateRemote(data) {
    const token = data.playerToken;
    if (!token || token === this.playerToken) return;

    const existing = this._remotePlayers.get(token);
    if (existing) {
      existing.x      = data.x;
      existing.y      = data.y;
      existing.hp     = data.hp;
      existing.maxHp  = data.maxHp;
      existing.level  = data.level;
      existing.state  = data.state;
      this.onPlayerUpdate(existing);
    } else {
      const entity = {
        id:          `remote_${token}`,
        type:        "remote_player",
        playerToken: token,
        x:           data.x,
        y:           data.y,
        name:        data.name    ?? "Hero",
        classId:     data.classId ?? "fighter",
        icon:        data.icon    ?? "🧙",
        hp:          data.hp      ?? 80,
        maxHp:       data.maxHp   ?? 80,
        level:       data.level   ?? 1,
        state:       data.state   ?? "idle",
        dead:        false,
        isRemote:    true
      };
      this._remotePlayers.set(token, entity);
      this.onPlayerJoin(entity);
    }
  }

  get remotePlayers() {
    return [...this._remotePlayers.values()];
  }

  getRemotePlayer(token) {
    return this._remotePlayers.get(token) ?? null;
  }
}
