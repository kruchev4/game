/**
 * LootSystem.js
 *
 * Responsibilities:
 *   - Roll loot when an NPC dies (using loot tables)
 *   - Spawn a Corpse entity on the world
 *   - Tick corpses and remove expired ones
 *   - Apply consumable item effects when used
 *   - Add items/gold to player inventory
 *
 * NOT responsible for:
 *   - Rendering corpses (Renderer does that)
 *   - Opening the loot window (Engine does that on corpse click)
 *   - Saving inventory (SaveProvider handles that on zone change)
 */

import { Corpse } from "../entities/Corpse.js";

export class LootSystem {
  /**
   * @param {object}   opts
   * @param {object}   opts.player       - player entity
   * @param {object}   opts.lootTables   - parsed loot.json
   * @param {object}   opts.itemDefs     - parsed items.json
   * @param {Function} opts.onCorpseSpawn  - (corpse) => {} — add to world entities
   * @param {Function} opts.onCorpseRemove - (corpse) => {} — remove from world entities
   * @param {Function} opts.onEvent        - combat-log style event callback
   */
  constructor({ player, itemDefs, onCorpseSpawn, onCorpseRemove, onEvent }) {
    this.player         = player;
    this.itemDefs       = itemDefs;
    // lootTables removed — server is sole source of truth for loot rolling
    this.onCorpseSpawn  = onCorpseSpawn  ?? (() => {});
    this.onCorpseRemove = onCorpseRemove ?? (() => {});
    this.onEvent        = onEvent        ?? (() => {});

    this.corpses = []; // active Corpse entities
    this._nextId = 1;
  }

  // ─────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────

  /**
   * Called when the server confirms an NPC kill.
   * Server is the sole source of truth for loot — no client-side rolling.
   * @param {object} npc        - dead NPC entity (for position/classId)
   * @param {object} serverLoot - { gold, itemId, qty } from server
   */
  onNPCKilled(npc, serverLoot) {
    const gold  = serverLoot?.gold ?? 0;
    const items = [];

    if (serverLoot?.itemId &&
        serverLoot.itemId !== "nothing" &&
        serverLoot.itemId !== "gold" &&
        this.itemDefs[serverLoot.itemId]) {
      items.push({ itemId: serverLoot.itemId, qty: serverLoot.qty ?? 1 });
    }

    // Always spawn corpse — even gold-only drops deserve a clickable corpse
    const corpse = new Corpse({
      id:         `corpse_${this._nextId++}`,
      x:          npc.x,
      y:          npc.y,
      npcClassId: npc.classId,
      gold,
      items
    });

    this.corpses.push(corpse);
    this.onCorpseSpawn(corpse);
  }

  /**
   * Loot all items from a corpse into the player's inventory.
   * Called when the player interacts with the corpse.
   * Returns the loot that was taken { gold, items }.
   * @param {Corpse} corpse
   */
  lootCorpse(corpse) {
    if (!corpse.hasLoot) return { gold: 0, items: [] };

    const taken = { gold: corpse.gold, items: [...corpse.items] };

    // Add gold to player
    if (corpse.gold > 0) {
      this.player.gold = (this.player.gold ?? 0) + corpse.gold;
      corpse.gold = 0;
      this.onEvent({ type: "loot_gold", amount: taken.gold });
    }

    // Add items to player bag
    for (const drop of corpse.items) {
      this._addToBag(drop.itemId, drop.qty);
    }
    corpse.items  = [];
    corpse.looted = true;

    return taken;
  }

  /**
   * Use an item from inventory (bag or quick slot).
   * @param {string} itemId
   * @returns {boolean} true if item was used successfully
   */
  useItem(itemId) {
    const def = this.itemDefs[itemId];
    if (!def?.onUse) return false;

    // Check player has it
    const bagSlot = this.player.bag.find(s => s?.itemId === itemId);
    if (!bagSlot) return false;

    const effect = def.onUse;

    if (effect.effect === "heal") {
      const before = this.player.hp;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + effect.amount);
      const healed = this.player.hp - before;
      this.onEvent({ type: "item_used", item: def, healed });
    }

    if (effect.effect === "restore_resource") {
      const before = this.player.resource;
      this.player.resource = Math.min(
        this.player.maxResource,
        (this.player.resource ?? 0) + effect.amount
      );
      const restored = this.player.resource - before;
      this.onEvent({ type: "item_used", item: def, restored });
    }

    // Consume one from stack
    this._removeFromBag(itemId, 1);
    return true;
  }

  /**
   * Add an item directly to the player bag (for shops, rewards, etc.)
   */
  giveItem(itemId, qty = 1) {
    this._addToBag(itemId, qty);
  }

  /**
   * Equip an item from the bag into its equipment slot.
   * Returns the previously equipped item (if any) to the bag.
   */
  equipItem(itemId) {
    const def = this.itemDefs[itemId];
    if (!def || def.type !== "equipment") return;

    const slot = def.slot;
    if (!slot) return;

    // Unequip current item in that slot → back to bag
    const current = this.player.equipment[slot];
    if (current) {
      this._addToBag(current, 1);
    }

    // Remove new item from bag
    this._removeFromBag(itemId, 1);

    // Equip
    this.player.equipment[slot] = itemId;
    this.onEvent({ type: "item_equipped", item: def });
  }

  /**
   * Unequip an item from a slot back into the bag.
   */
  unequipItem(slot) {
    const itemId = this.player.equipment[slot];
    if (!itemId) return;

    this._addToBag(itemId, 1);
    this.player.equipment[slot] = null;
    this.onEvent({ type: "item_unequipped", slot });
  }

  /**
   * Assign a bag item to a quick slot (0-based, 0-3 = slots 5-8).
   */
  assignQuickSlot(quickSlotIndex, itemId) {
    this.player.quickSlots[quickSlotIndex] = itemId ?? null;
  }

  /**
   * Use a quick slot item by index.
   */
  useQuickSlot(index) {
    const itemId = this.player.quickSlots[index];
    if (!itemId) return false;
    return this.useItem(itemId);
  }

  // ─────────────────────────────────────────────
  // TICK
  // ─────────────────────────────────────────────

  update(dt = 1) {
    const toRemove = [];
    for (const corpse of this.corpses) {
      if (corpse.tick(dt)) {
        toRemove.push(corpse);
      }
    }
    for (const c of toRemove) {
      this.corpses = this.corpses.filter(x => x.id !== c.id);
      this.onCorpseRemove(c);
    }
  }

  // ─────────────────────────────────────────────
  // BAG HELPERS
  // ─────────────────────────────────────────────

  _addToBag(itemId, qty) {
    const def = this.itemDefs[itemId];
    if (!def) return;

    if (def.stackable) {
      // Find existing stack
      const existing = this.player.bag.find(s => s?.itemId === itemId);
      if (existing) {
        existing.qty += qty;
        return;
      }
    }

    // Find empty slot
    const emptyIndex = this.player.bag.findIndex(s => s === null);
    if (emptyIndex === -1) {
      this.onEvent({ type: "bag_full", itemId });
      return;
    }

    this.player.bag[emptyIndex] = { itemId, qty };
  }

  _removeFromBag(itemId, qty) {
    for (let i = 0; i < this.player.bag.length; i++) {
      const slot = this.player.bag[i];
      if (!slot || slot.itemId !== itemId) continue;

      slot.qty -= qty;
      if (slot.qty <= 0) {
        this.player.bag[i] = null;

        // Clear from quick slots too if qty hits 0
        for (let q = 0; q < this.player.quickSlots.length; q++) {
          if (this.player.quickSlots[q] === itemId) {
            this.player.quickSlots[q] = null;
          }
        }
      }
      return;
    }
  }
}