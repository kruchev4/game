/**
 * TownSystem.js
 *
 * Manages friendly NPCs in town maps:
 *   - Slow wandering within roam radius
 *   - Click detection to open dialogs
 *   - Exit tile detection to trigger world transition
 *
 * Does NOT handle inn/shop UI — that's InnWindow and ShopWindow.
 * Does NOT load worlds — that's Engine.transition().
 */

import { findNearestWalkable } from "../world/findNearestWalkable.js";

const WANDER_INTERVAL = 180; // ticks between wander steps (~3 sec)

export class TownSystem {
  /**
   * @param {object}   opts
   * @param {object}   opts.townData    - parsed town JSON
   * @param {object}   opts.world       - world object with getTile()
   * @param {object}   opts.player      - player entity
   * @param {Function} opts.onInteract  - (npc) => {} — NPC was clicked
   * @param {Function} opts.onExit      - (exit) => {} — player stepped on exit tile
   */
  constructor({ townData, world, player, onInteract, onExit }) {
    this.townData    = townData;
    this.world       = world;
    this.player      = player;
    this.onInteract  = onInteract ?? (() => {});
    this.onExit      = onExit     ?? (() => {});

    // Instantiate friendly NPCs from town data
    this.npcs = (townData.friendlyNPCs ?? []).map(def => ({
      ...def,
      _homeX:        def.x,
      _homeY:        def.y,
      _wanderTimer:  Math.floor(Math.random() * WANDER_INTERVAL),
      dead:          false,
      type:          "friendly_npc",
      state:         "roaming",
      hp:            999,
      maxHp:         999,
      perceptionRadius: 0
    }));

    this._exitCheckTimer = 0;
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────

  update(dt = 1) {
    this._tickWander(dt);
    this._checkExit(dt);
  }

  // ─────────────────────────────────────────────
  // CLICK HANDLING
  // ─────────────────────────────────────────────

  /**
   * Call when player left-clicks a world tile.
   * Returns true if an NPC was hit (so Engine can stop further click handling).
   */
  handleClick(worldX, worldY) {
    for (const npc of this.npcs) {
      if (npc.x === worldX && npc.y === worldY) {
        this.onInteract(npc);
        return true;
      }
    }
    return false;
  }

  // ─────────────────────────────────────────────
  // PRIVATE
  // ─────────────────────────────────────────────

  _tickWander(dt) {
    for (const npc of this.npcs) {
      npc._wanderTimer -= dt;
      if (npc._wanderTimer > 0) continue;
      npc._wanderTimer = WANDER_INTERVAL + Math.floor(Math.random() * 60);

      // Pick a random step within roam radius from home
      const radius = npc.roamRadius ?? 3;
      const dx = Math.floor(Math.random() * (radius * 2 + 1)) - radius;
      const dy = Math.floor(Math.random() * (radius * 2 + 1)) - radius;

      const tx = Math.max(0, Math.min(this.world.width  - 1, npc._homeX + dx));
      const ty = Math.max(0, Math.min(this.world.height - 1, npc._homeY + dy));

      // Only move if tile is walkable and not occupied by another NPC
      const tileId = this.world.getTile(tx, ty);
      if (tileId == null) continue;

      const occupied = this.npcs.some(
        other => other !== npc && other.x === tx && other.y === ty
      );
      if (!occupied) {
        npc.x = tx;
        npc.y = ty;
      }
    }
  }

  _checkExit(dt) {
    this._exitCheckTimer -= dt;
    if (this._exitCheckTimer > 0) return;
    this._exitCheckTimer = 10; // check every 10 ticks

    const px = this.player.x;
    const py = this.player.y;

    for (const exit of (this.townData.exits ?? [])) {
      if (px === exit.x && py === exit.y) {
        this.onExit(exit);
        return;
      }
    }
  }
}
