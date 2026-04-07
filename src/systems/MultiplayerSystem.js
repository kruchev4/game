/**
 * MultiplayerSystem.js
 *
 * Connects to the Node.js game server via WebSocket.
 * Handles player presence, movement sync, and co-op combat.
 */

const SERVER_URL   = "wss://strings-feature-computer-emperor.trycloudflare.com";
const MOVE_MS      = 100;   // broadcast position every 100ms
const PING_MS      = 5000;  // keepalive ping every 5s

export class MultiplayerSystem {
  constructor({ player, worldId, playerToken, onPlayerJoin, onPlayerLeave, onPlayerUpdate, onNPCDamaged, onNPCKilled, onNPCState, onNPCAttackPlayer }) {
    this.player       = player;
    this.worldId      = worldId;
    this.playerToken  = playerToken;
    this.onPlayerJoin      = onPlayerJoin      ?? (() => {});
    this.onPlayerLeave     = onPlayerLeave     ?? (() => {});
    this.onPlayerUpdate    = onPlayerUpdate    ?? (() => {});
    this.onNPCDamaged      = onNPCDamaged      ?? (() => {});
    this.onNPCKilled       = onNPCKilled       ?? (() => {});
    this.onNPCState        = onNPCState        ?? (() => {});
    this.onNPCAttackPlayer = onNPCAttackPlayer ?? (() => {});

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
    if (!SERVER_URL) {
      console.log("[MP] No server URL configured — multiplayer disabled");
      return;
    }

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
  // Normalize common alternate server message names → your existing handlers
  const t = msg.type;

  // ---- Player presence (compat layer) ----
  if (t === "player_join") {
    // server.js uses { type:"player_join", player:{...} }
    this._addOrUpdateRemote(msg.player);
    return;
  }

  if (t === "player_update") {
    // server.js uses { type:"player_update", player:{...} }
    this._addOrUpdateRemote(msg.player);
    return;
  }

  if (t === "player_left") {
    // both protocols often use token; some use playerToken
    const tok = msg.token ?? msg.playerToken;
    const entity = this._remotePlayers.get(tok);
    if (entity) {
      this._remotePlayers.delete(tok);
      this.onPlayerLeave(tok);
    }
    return;
  }

  // Some servers send "move" with x,y and no token (that’s usually *self* only).
  // Others send "player_moved" with token. We handle both safely:
  if (t === "player_moved") {
    const entity = this._remotePlayers.get(msg.token);
    if (entity) {
      entity.x = msg.x;
      entity.y = msg.y;
      entity.state = msg.state;
      this.onPlayerUpdate(entity);
    }
    return;
  }

  if (t === "move") {
    // If server broadcasts move with a token, support it.
    // If it doesn't, ignore (it might be echo of our own move).
    const tok = msg.token ?? msg.playerToken;
    if (!tok || tok === this.playerToken) return;
    const entity = this._remotePlayers.get(tok);
    if (entity) {
      entity.x = msg.x;
      entity.y = msg.y;
      entity.state = msg.state;
      this.onPlayerUpdate(entity);
    }
    return;
  }

  // ---- NPC state / combat (compat layer) ----
  if (t === "npc_state") {
    this.onNPCState(msg.npcs ?? []);
    return;
  }

  // server.js I generated sends npc_damage, while your client expects npc_damaged
  if (t === "npc_damage") {
    this.onNPCDamaged({
      npcId: msg.npcId,
      hp: msg.hp,
      maxHp: msg.maxHp,
      damage: msg.damage,
      attackerName: msg.attackerName
    });
    return;
  }

  if (t === "npc_damaged") {
    this.onNPCDamaged({
      npcId: msg.npcId,
      hp: msg.hp,
      maxHp: msg.maxHp,
      damage: msg.damage,
      attackerName: msg.attackerName
    });
    return;
  }

  if (t === "npc_killed") {
    this.onNPCKilled({
      npcId: msg.npcId,
      killerName: msg.killerName,
      xpShare: msg.xpShare,
      loot: msg.loot
    });
    return;
  }

  if (t === "npc_attack_player") {
    if (msg.targetToken === this.playerToken) {
      this.onNPCAttackPlayer({ npcId: msg.npcId, damage: msg.damage });
    }
    return;
  }

  // Some servers answer ping with pong, some don't
  if (t === "pong") return;

  // ---- Existing protocol (your current cases) ----
  switch (t) {
    case "world_state": {
      for (const playerData of (msg.players ?? [])) {
        this._addOrUpdateRemote(playerData);
      }
      break;
    }

    case "player_joined": {
      this._addOrUpdateRemote(msg.player);
      break;
    }

    case "player_updated": {
      this._addOrUpdateRemote(msg.player);
      break;
    }

    // NOTE: player_left handled above

    default:
      console.log("[MP] Unknown message:", t, msg);
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
