/**
 * MultiplayerSystem.js
 *
 * Connects to the Node.js game server via WebSocket.
 * Handles player presence, movement sync, and co-op combat.
 */

const MOVE_MS      = 100;   // broadcast position every 100ms
const PING_MS      = 10000; // keepalive ping every 10s
const PONG_TIMEOUT = 15000; // disconnect if no pong in 15s

export class MultiplayerSystem {
  constructor({ serverUrl, player, worldId, playerToken, onPlayerJoin, onPlayerLeave, onPlayerUpdate, onNPCDamaged, onNPCKilled, onNPCState, onNPCAttackPlayer }) {
    this.serverUrl    = serverUrl;
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
      // Check if pong is overdue — connection may be dead
      if (Date.now() - this._lastPong > PONG_TIMEOUT && this._connected) {
        console.warn("[MP] Pong timeout — connection likely dead, reconnecting");
        this._ws?.close();
      }
    }
  }

  // ─────────────────────────────────────────────
  // COMBAT API — called by Engine
  // ─────────────────────────────────────────────

  /**
   * Tell server this player attacked an NPC.
   * Server resolves damage and broadcasts result to all clients.
   */
  getRemotePlayers() {
    return [...this._remotePlayers.values()];
  }

  send(msg) {
    this._send(msg);
  }

  sendAbility({ abilityId, targetId, targetType }) {
    this._send({ type: "use_ability", abilityId, targetId, targetType });
  }

  sendAttack({ npcId, damage, abilityId }) {
    // Legacy — prefer sendAbility for new code
    this._send({ type: "npc_attack", npcId, damage, abilityId });
  }

  sendTaunt(radius = 6) {
    this._send({ type: "taunt", radius });
  }

  sendHealThreat(targetToken, amount) {
    this._send({ type: "heal_threat", targetToken, amount });
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
    if (!this.serverUrl) {
      console.log("[MP] No server URL configured — multiplayer disabled");
      return;
    }

    console.log(`[MP] Connecting to ${this.serverUrl}...`);

    try {
      this._ws = new WebSocket(this.serverUrl);
    } catch (e) {
      console.warn("[MP] WebSocket creation failed:", e.message);
      this._scheduleReconnect();
      return;
    }

    this._ws.addEventListener("open", () => {
      console.log("[MP] Connected to server");
      this._connected      = true;
      this._lastPong       = Date.now();
      this._reconnectDelay = 2000; // reset backoff
      clearTimeout(this._disconnectTimer); // cancel any pending disconnect dialog

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
        y:           p.y       ?? 0,
        gold:        p.gold    ?? 0,
        xp:          p.xp      ?? 0,
        mana:        Math.ceil(p.resource ?? 100),
        maxMana:     p.maxResource ?? 100
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
      if (!this._dead) {
        // Small grace period — ignore brief disconnects (tunnel hiccup)
        this._disconnectTimer = setTimeout(() => {
          if (!this._connected && !this._dead) {
            this._showDisconnectDialog();
          }
        }, 3000);
      }
    });

    this._ws.addEventListener("open", () => {
      // Clear any pending disconnect dialog timer
      clearTimeout(this._disconnectTimer);
    });

    this._ws.addEventListener("error", (e) => {
      console.warn("[MP] WebSocket error:", e.message ?? e);
    });
  }

  _showDisconnectDialog() {
    // Remove any existing dialog
    document.getElementById("mp-disconnect-dialog")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "mp-disconnect-dialog";
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.75);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      font-family: monospace;
    `;

    overlay.innerHTML = `
      <div style="
        background: #0d0d18;
        border: 1.5px solid #444466;
        border-radius: 10px;
        padding: 32px 40px;
        text-align: center;
        max-width: 340px;
      ">
        <div style="color:#cc4444; font-size:18px; margin-bottom:10px;">⚠ Disconnected</div>
        <div style="color:#aaaaaa; font-size:13px; margin-bottom:24px;">
          You have been disconnected from the server.
          Rejoin to continue playing with others.
        </div>
        <div style="display:flex; gap:12px; justify-content:center;">
          <button id="mp-rejoin-btn" style="
            background:#1a3a1a; color:#88ee88;
            border:1.5px solid #44aa44;
            border-radius:6px; padding:8px 24px;
            font-family:monospace; font-size:13px;
            cursor:pointer;
          ">Rejoin [Y]</button>
          <button id="mp-offline-btn" style="
            background:#1a1a2a; color:#888899;
            border:1.5px solid #444466;
            border-radius:6px; padding:8px 24px;
            font-family:monospace; font-size:13px;
            cursor:pointer;
          ">Play Offline [N]</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();

    document.getElementById("mp-rejoin-btn").onclick = () => {
      close();
      this._reconnectDelay = 2000;
      this._scheduleReconnect();
    };

    document.getElementById("mp-offline-btn").onclick = () => {
      close();
      this._dead = true; // stop reconnect attempts
    };

    // Keyboard shortcut Y/N
    const onKey = (e) => {
      if (e.key === "y" || e.key === "Y") {
        document.removeEventListener("keydown", onKey);
        document.getElementById("mp-rejoin-btn")?.click();
      } else if (e.key === "n" || e.key === "N") {
        document.removeEventListener("keydown", onKey);
        document.getElementById("mp-offline-btn")?.click();
      }
    };
    document.addEventListener("keydown", onKey);
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

      case "npc_state": {
        this.onNPCState(msg.npcs ?? []);
        break;
      }

      case "npc_attack_player": {
        if (msg.targetToken === this.playerToken) {
          this.onNPCAttackPlayer({ npcId: msg.npcId, damage: msg.damage, blocked: msg.blocked });
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
          npcId:      msg.npcId,
          killerName: msg.killerName,
          xpShare:    msg.xpShare,
          loot:       msg.loot
        });
        break;
      }

      case "player_stat_update": {
        // Server is authoritative — update local player stats
        if (this.onStatUpdate) {
          this.onStatUpdate({ hp: msg.hp, maxHp: msg.maxHp, xp: msg.xp, gold: msg.gold });
        }
        break;
      }

      case "ability_result": {
        // Server confirmed ability fired — trigger animations
        if (this.onAbilityResult) {
          this.onAbilityResult(msg);
        }
        break;
      }

      case "player_healed": {
        if (this.onPlayerHealed) {
          this.onPlayerHealed(msg);
        }
        break;
      }

      case "buff_applied": {
        if (this.onBuffApplied) {
          this.onBuffApplied(msg);
        }
        break;
      }

      case "pong": this._lastPong = Date.now(); break;

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
