/**
 * Corpse.js
 *
 * A world entity spawned when an NPC dies.
 * Holds loot (gold + items) and despawns after DESPAWN_TICKS.
 * Left-clicking it opens the loot window.
 *
 * Rendered by Renderer — appears as a dark X on the tile.
 * Pulses/glows if it has loot remaining.
 */

const DESPAWN_TICKS = 1800; // ~30 seconds at 60fps

export class Corpse {
  /**
   * @param {object} opts
   * @param {string} opts.id
   * @param {number} opts.x
   * @param {number} opts.y
   * @param {string} opts.npcClassId    - for display name
   * @param {number} opts.gold          - gold in this corpse
   * @param {Array}  opts.items         - array of { itemId, qty }
   */
  constructor({ id, x, y, npcClassId, gold = 0, items = [] }) {
    this.id         = id;
    this.type       = "corpse";
    this.x          = x;
    this.y          = y;
    this.npcClassId = npcClassId;
    this.gold       = gold;
    this.items      = items;   // [{ itemId, qty }, ...]

    this._age       = 0;
    this.dead       = false;   // set true when despawned
    this.looted     = false;   // true when all loot taken
  }

  get hasLoot() {
    return this.gold > 0 || this.items.length > 0;
  }

  get despawnProgress() {
    return this._age / DESPAWN_TICKS; // 0→1
  }

  /**
   * Call once per frame. Returns true if the corpse should be removed.
   */
  tick(dt = 1) {
    this._age += dt;
    if (this._age >= DESPAWN_TICKS) {
      this.dead = true;
      return true;
    }
    return false;
  }
}
