/**
 * DungeonSystem.js
 *
 * Manages dungeon-specific gameplay:
 *   - Fog of war: tracks visited tiles, broadcasts to Renderer for minimap
 *   - Vision radius: circular visibility overlay (handled by Renderer)
 *   - Chest entities: click-to-loot, rolls from loot tier
 *   - Room tracking: detects when player enters a room, triggers events
 *   - Dungeon reset: clears state when last player leaves
 *   - Exit detection: same pattern as TownSystem
 *
 * Usage (Engine._initDungeonSystem):
 *   this.dungeonSystem = new DungeonSystem({
 *     world, player, lootTables, itemDefs,
 *     onExit:        (exit) => this._exitTown(exit),
 *     onChestOpen:   (chest, loot) => this.gameEventHandler.handleDungeonEvent({ type: "chest_open", chest, loot }),
 *     onRoomEnter:   (room) => this.gameEventHandler.handleDungeonEvent({ type: "room_enter", room }),
 *     onBossKilled:  (boss) => this.gameEventHandler.handleDungeonEvent({ type: "boss_killed", boss }),
 *     onCleared:     () => this.gameEventHandler.handleDungeonEvent({ type: "dungeon_cleared" }),
 *   });
 */

export class DungeonSystem {
  /**
   * @param {object}   opts
   * @param {object}   opts.world         - loaded world object
   * @param {object}   opts.player        - player entity
   * @param {object}   opts.itemDefs      - item definitions map
   * @param {object}   opts.lootTiers     - loot tier definitions map (keyed by tier number)
   * @param {Function} opts.onExit        - (exit) => {} — player stepped on exit
   * @param {Function} opts.onChestOpen   - (chest, loot) => {} — chest looted
   * @param {Function} opts.onRoomEnter   - (room) => {} — player entered a room
   * @param {Function} opts.onBossKilled  - (boss) => {} — boss NPC died
   * @param {Function} opts.onCleared     - () => {} — all monsters and bosses dead
   */
  constructor({ world, player, itemDefs, lootTiers, onExit, onChestOpen, onRoomEnter, onBossKilled, onCleared }) {
    this.world       = world;
    this.player      = player;
    this.itemDefs    = itemDefs ?? {};
    this.lootTiers   = lootTiers ?? {};
    this.onExit      = onExit      ?? (() => {});
    this.onChestOpen = onChestOpen ?? (() => {});
    this.onRoomEnter = onRoomEnter ?? (() => {});
    this.onBossKilled  = onBossKilled  ?? (() => {});
    this.onCleared     = onCleared     ?? (() => {});

    // Fog of war — Set of "x,y" strings for visited tiles
    this.visitedTiles = new Set();

    // Chests — built from world.chests array in JSON
    // { id, x, y, tier, looted, loot: null | { gold, items } }
    this.chests = (world.chests ?? []).map((c, i) => ({
      id:     c.id ?? `chest_${i}`,
      x:      c.x,
      y:      c.y,
      tier:   c.tier ?? 2,
      looted: false,
      loot:   null,
      icon:   c.icon ?? "📦"
    }));

    // Rooms — built from world.rooms array in JSON
    // { id, label, x, y, w, h, entered, isBossRoom, bossId }
    this.rooms = (world.rooms ?? []).map(r => ({
      ...r,
      entered: false
    }));

    // Exit check timer (same pattern as TownSystem)
    this._exitCheckTimer = 0;

    // Vision radius in tiles — affects Renderer overlay
    this.visionRadius = world.visionRadius ?? 6;

    // Track cleared state
    this._cleared = false;
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────

  update(dt = 1, npcs = []) {
    this._revealAround(this.player.x, this.player.y);
    this._checkExit(dt);
    this._checkRoomEntry();
    this._checkCleared(npcs);
  }

  // ─────────────────────────────────────────────
  // FOG OF WAR
  // ─────────────────────────────────────────────

  /** Mark tiles around a position as visited */
  _revealAround(cx, cy) {
    const r = this.visionRadius;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          const x = cx + dx;
          const y = cy + dy;
          if (x >= 0 && y >= 0 && x < this.world.width && y < this.world.height) {
            this.visitedTiles.add(`${x},${y}`);
          }
        }
      }
    }
  }

  isTileVisible(x, y) {
    return this.visitedTiles.has(`${x},${y}`);
  }

  isInVisionRadius(x, y) {
    const dx = x - this.player.x;
    const dy = y - this.player.y;
    return dx * dx + dy * dy <= this.visionRadius * this.visionRadius;
  }

  // ─────────────────────────────────────────────
  // CHESTS
  // ─────────────────────────────────────────────

  /**
   * Called when player clicks a chest tile.
   * Returns loot object or null if already looted.
   */
  openChest(chestId) {
    const chest = this.chests.find(c => c.id === chestId);
    if (!chest || chest.looted) return null;

    chest.loot   = this._rollChestLoot(chest.tier);
    chest.looted = true;

    this.onChestOpen(chest, chest.loot);
    return chest.loot;
  }

  /** Get chest at world position */
  getChestAt(x, y) {
    return this.chests.find(c => c.x === x && c.y === y && !c.looted) ?? null;
  }

  _rollChestLoot(tier) {
    const table = this.lootTiers[tier] ?? this.lootTiers[1] ?? { entries: [] };
    const entries = table.entries ?? [];

    const gold = (tier * 10) + Math.floor(Math.random() * tier * 15);

    // Weighted random roll
    const totalWeight = entries.reduce((sum, e) => sum + (e.weight ?? 1), 0);
    let roll = Math.random() * totalWeight;
    let itemId = null;
    for (const entry of entries) {
      roll -= (entry.weight ?? 1);
      if (roll <= 0) {
        itemId = entry.itemId;
        break;
      }
    }

    return { gold, itemId, qty: 1 };
  }

  // ─────────────────────────────────────────────
  // ROOMS
  // ─────────────────────────────────────────────

  _checkRoomEntry() {
    const px = Math.round(this.player.x);
    const py = Math.round(this.player.y);

    for (const room of this.rooms) {
      if (room.entered) continue;
      if (px >= room.x && px < room.x + room.w &&
          py >= room.y && py < room.y + room.h) {
        room.entered = true;
        this.onRoomEnter(room);
      }
    }
  }

  // ─────────────────────────────────────────────
  // BOSS / CLEARED
  // ─────────────────────────────────────────────

  /** Call this from GameEventHandler when an NPC is killed */
  onNPCKilled(npc) {
    if (npc.isBoss) {
      this.onBossKilled(npc);
    }
  }

  _checkCleared(npcs) {
    if (this._cleared) return;
    const hasLiving = npcs.some(n => !n.dead);
    if (!hasLiving && npcs.length > 0) {
      this._cleared = true;
      this.onCleared();
    }
  }

  // ─────────────────────────────────────────────
  // EXIT CHECK (same pattern as TownSystem)
  // ─────────────────────────────────────────────

  _checkExit(dt) {
    this._exitCheckTimer -= dt;
    if (this._exitCheckTimer > 0) return;
    this._exitCheckTimer = 10;

    const px = Math.round(this.player.x);
    const py = Math.round(this.player.y);

    for (const exit of (this.world.exits ?? [])) {
      if (px === exit.x && py === exit.y) {
        this.onExit(exit);
        return;
      }
    }
  }

  // ─────────────────────────────────────────────
  // CLICK HANDLING
  // ─────────────────────────────────────────────

  /** Returns chest if player clicked one, null otherwise */
  handleClick(worldX, worldY) {
    const chest = this.getChestAt(worldX, worldY);
    if (chest) return chest;
    return null;
  }

  // ─────────────────────────────────────────────
  // RESET (called when dungeon should reset)
  // ─────────────────────────────────────────────

  reset() {
    this.visitedTiles.clear();
    this.chests.forEach(c => { c.looted = false; c.loot = null; });
    this.rooms.forEach(r => { r.entered = false; });
    this._cleared = false;
  }
}