/**
 * NPCAISystem.js
 *
 * Decides WHAT action each NPC takes when their action timer is ready.
 * Movement decisions live in NPCMovementSystem.
 * Combat resolution lives in CombatSystem.
 * This system is the bridge — it reads NPC state and calls
 * combatSystem.queueNPCAction() with the right ability and target.
 *
 * Design rule: this system never moves NPCs and never resolves damage.
 * It only queues actions.
 *
 * Current AI behaviour (simple, extensible):
 *   - If in combat and action timer is ready:
 *       - Find best ability that can reach the player
 *       - Queue it
 *   - Melee NPCs: use their only ability when adjacent
 *   - Ranged NPCs: use their ability when in range + LoS
 *   - If no ability is in range: do nothing (movement system handles closing)
 */

import { inRange } from "../world/LoS.js";

export class NPCAISystem {
  /**
   * @param {object} opts
   * @param {object}        opts.player
   * @param {object[]}      opts.npcs
   * @param {object}        opts.abilities   - abilities map (id -> def)
   * @param {CombatSystem}  opts.combatSystem
   */
  constructor({ player, npcs, abilities, combatSystem }) {
    this.player       = player;
    this.npcs         = npcs;
    this.abilities    = abilities;
    this.combatSystem = combatSystem;
  }

  /**
   * Called once per frame from Engine.loop(), after CombatSystem.update().
   * @param {object} world  - needed for LoS checks inside inRange
   */
  update(world) {
    for (const npc of this.npcs) {
      if (npc.dead) continue;
      if (!npc.inCombat) continue;
      if (!npc.actionReady) continue;  // timer not expired yet

      this._decideAction(npc, world);
    }
  }

  _decideAction(npc, world) {
    // Try each ability in order — use the first one that's in range
    for (const abilityId of (npc.abilities ?? [])) {
      const ability = this.abilities[abilityId];
      if (!ability) continue;

      if (inRange(world, npc, this.player, ability)) {
        this.combatSystem.queueNPCAction(npc, abilityId, this.player.id);
        return;
      }
    }

    // No ability in range — movement system is already closing the gap,
    // nothing to queue this tick.
  }
}
