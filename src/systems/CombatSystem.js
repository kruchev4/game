/**
 * CombatSystem.js
 *
 * Governs all combat in Realm of Echoes.
 *
 * DESIGN RULES:
 * - Movement is always free and real-time. CombatSystem never blocks movement.
 * - Only ACTIONS (attacks, abilities) are turn-gated via per-entity action timers.
 * - Combat lives on the overworld — no mode switch, no separate grid.
 * - Melee: requires adjacency (Manhattan distance <= ability.range, default 1).
 * - Ranged: requires distance check + Line of Sight.
 * - Combat starts when: player explicitly targets an enemy OR an NPC stays
 *   adjacent to the player for ADJACENCY_TICKS_TO_ENGAGE ticks.
 *
 * RESPONSIBILITIES:
 * - Track which entities are "in combat"
 * - Manage per-entity action timers (counts down each tick)
 * - Accept queued actions from player input and NPC AI
 * - Resolve actions: validate range/LoS, roll damage, apply effects
 * - Emit combat events for the UI / combat log
 * - Remove dead entities and end combat cleanly
 *
 * NOT RESPONSIBLE FOR:
 * - Rendering (Renderer reads entity state)
 * - Movement (MovementSystem owns that)
 * - NPC decision-making (AISystem will own what action NPCs queue)
 */

import { inRange, manhattanDist } from "../world/LoS.js";

// How many consecutive ticks an NPC must be adjacent before auto-engaging
const ADJACENCY_TICKS_TO_ENGAGE = 3;

export class CombatSystem {
  /**
   * @param {object} opts
   * @param {object}   opts.world       - world with getTile(x,y)
   * @param {object}   opts.player      - player entity
   * @param {object[]} opts.npcs        - all NPC entities
   * @param {object}   opts.abilities   - ability definitions (from abilities.json)
   * @param {Function} opts.onEvent     - callback for combat events (log, UI, sound)
   */
  constructor({ world, player, npcs, abilities, onEvent = () => {} }) {
    this.world = world;
    this.player = player;
    this.npcs = npcs;
    this.abilities = abilities;
    this.onEvent = onEvent;

    // Set of entity ids currently in combat
    this.combatants = new Set();

    // Per-entity action timers. Key: entity id, Value: ticks remaining
    // When timer reaches 0 the entity CAN act. Timer resets after acting.
    this._actionTimers = new Map();

    // Queued player action: { ability, targetId }
    // Set by player input (UI click, keybind). Consumed each tick.
    this._playerAction = null;

    // Tracks consecutive adjacency ticks per NPC id for auto-engage
    this._adjacencyTicks = new Map();

    // Active effects on entities: Map<entityId, Effect[]>
    this._effects = new Map();
  }

  // ─────────────────────────────────────────────
  // PUBLIC API — called by Engine, UI, AI
  // ─────────────────────────────────────────────

  /**
   * Player explicitly targets an enemy and queues an action.
   * Called by UI/input system when player clicks an enemy or uses a keybind.
   *
   * @param {string} abilityId
   * @param {string} targetId
   */
  queuePlayerAction(abilityId, targetId) {
    const ability = this.abilities[abilityId];
    if (!ability) {
      console.warn(`[CombatSystem] Unknown ability: ${abilityId}`);
      return;
    }

    // Entering combat by player choice — engage immediately
    if (!this.combatants.has(this.player.id)) {
      this._engage(this.player);
    }

    const target = this._findNPC(targetId);
    if (target && !this.combatants.has(targetId)) {
      this._engage(target);
    }

    this._playerAction = { abilityId, targetId };
  }

  /**
   * NPC AI queues an action. Called by AISystem.
   *
   * @param {object} npc
   * @param {string} abilityId
   * @param {string} targetId
   */
  queueNPCAction(npc, abilityId, targetId) {
    if (!this.combatants.has(npc.id)) return; // NPC must be in combat to act
    npc._queuedAction = { abilityId, targetId };
  }

  /**
   * Main update — call once per frame from Engine.loop().
   * @param {number} dt - ticks elapsed (usually 1)
   */
  update(dt = 1) {
    this._checkAdjacencyEngagement(dt);
    this._tickTimers(dt);
    this._tickEffects(dt);
    this._resolvePlayerAction();
    this._resolveNPCActions();
    this._removeDeadCombatants();
  }

  // ─────────────────────────────────────────────
  // COMBAT ENTRY & EXIT
  // ─────────────────────────────────────────────

  /**
   * Bring an entity into combat. Sets their action timer.
   */
  _engage(entity) {
    if (this.combatants.has(entity.id)) return;

    this.combatants.add(entity.id);
    entity.inCombat = true;

    // Action timer starts at the entity's full action speed
    const speed = entity.actionSpeed ?? 60;
    this._actionTimers.set(entity.id, speed);

    this.onEvent({ type: "engage", entity });
  }

  /**
   * Remove entity from combat. Called on death or when combat ends.
   */
  _disengage(entity) {
    this.combatants.delete(entity.id);
    entity.inCombat = false;
    this._actionTimers.delete(entity.id);
    this._adjacencyTicks.delete(entity.id);
    this._effects.delete(entity.id);

    this.onEvent({ type: "disengage", entity });
  }

  /**
   * Auto-engage: if an NPC stays adjacent to the player for
   * ADJACENCY_TICKS_TO_ENGAGE ticks, combat is forced.
   */
  _checkAdjacencyEngagement(dt) {
    for (const npc of this.npcs) {
      if (npc.state !== "alert") {
        this._adjacencyTicks.delete(npc.id);
        continue;
      }

      const dist = manhattanDist(npc, this.player);

      if (dist <= 1) {
        const ticks = (this._adjacencyTicks.get(npc.id) ?? 0) + dt;
        this._adjacencyTicks.set(npc.id, ticks);

        if (ticks >= ADJACENCY_TICKS_TO_ENGAGE) {
          this._engage(npc);
          this._engage(this.player);
          this._adjacencyTicks.delete(npc.id);
        }
      } else {
        this._adjacencyTicks.delete(npc.id);
      }
    }
  }

  // ─────────────────────────────────────────────
  // TIMERS
  // ─────────────────────────────────────────────

  /**
   * Tick down all action timers. When a timer hits 0 the entity
   * is "ready to act" — their queued action will fire this tick.
   */
  _tickTimers(dt) {
    for (const [id, timer] of this._actionTimers) {
      const next = Math.max(0, timer - dt);
      this._actionTimers.set(id, next);

      // Expose readiness on the entity for UI rendering
      const entity = this._findEntityById(id);
      if (entity) {
        entity.actionReady = next === 0;
        entity.actionTimer = next;
      }
    }
  }

  // ─────────────────────────────────────────────
  // ACTION RESOLUTION
  // ─────────────────────────────────────────────

  _resolvePlayerAction() {
    if (!this._playerAction) return;
    if (!this.combatants.has(this.player.id)) return;

    const timer = this._actionTimers.get(this.player.id) ?? 1;
    if (timer > 0) return; // not ready yet

    const { abilityId, targetId } = this._playerAction;
    this._playerAction = null;

    const ability = this.abilities[abilityId];
    const target = this._findNPC(targetId);

    if (!target) return;

    this._resolveAction(this.player, target, ability);

    // Reset action timer
    this._actionTimers.set(this.player.id, this.player.actionSpeed ?? 60);
  }

  _resolveNPCActions() {
    for (const npc of this.npcs) {
      if (!this.combatants.has(npc.id)) continue;
      if (!npc._queuedAction) continue;

      const timer = this._actionTimers.get(npc.id) ?? 1;
      if (timer > 0) continue;

      const { abilityId, targetId } = npc._queuedAction;
      npc._queuedAction = null;

      const ability = this.abilities[abilityId];
      const target = targetId === this.player.id
        ? this.player
        : this._findNPC(targetId);

      if (!target || !ability) continue;

      this._resolveAction(npc, target, ability);

      // Reset action timer
      this._actionTimers.set(npc.id, npc.actionSpeed ?? 70);
    }
  }

  /**
   * Core resolution: validate range + LoS, roll damage, apply effects.
   */
  _resolveAction(attacker, target, ability) {
    // Range + LoS check
    if (!inRange(this.world, attacker, target, ability)) {
      this.onEvent({
        type: "out_of_range",
        attacker,
        target,
        ability
      });
      return;
    }

    // Roll damage: base + random variance
    const damage = this._rollDamage(ability, attacker);

    // Apply damage
    target.hp = Math.max(0, (target.hp ?? 0) - damage);

    // Apply on-hit effects (e.g. slow from Frost Arrow)
    if (ability.onHit) {
      this._applyEffect(target, ability.onHit);
    }

    this.onEvent({
      type: "hit",
      attacker,
      target,
      ability,
      damage
    });

    if (target.hp <= 0) {
      this.onEvent({ type: "kill", attacker, target });
      this._disengage(target);
      target.dead = true;
    }
  }

  // ─────────────────────────────────────────────
  // EFFECTS
  // ─────────────────────────────────────────────

  _applyEffect(entity, effectDef) {
    const effects = this._effects.get(entity.id) ?? [];

    // Replace existing effect of the same type (refresh duration)
    const existing = effects.findIndex(e => e.type === effectDef.effect);
    const effect = {
      type: effectDef.effect,
      duration: effectDef.duration,
      magnitude: effectDef.magnitude
    };

    if (existing >= 0) {
      effects[existing] = effect;
    } else {
      effects.push(effect);
    }

    this._effects.set(entity.id, effects);

    // Apply stat changes immediately (e.g. slow reduces actionSpeed)
    this._applyStatEffect(entity, effect);

    this.onEvent({ type: "effect_applied", entity, effect });
  }

  _applyStatEffect(entity, effect) {
    if (effect.type === "slow") {
      // Store base speed for restoration
      entity._baseActionSpeed = entity._baseActionSpeed ?? entity.actionSpeed;
      entity.actionSpeed = Math.round(
        entity._baseActionSpeed / effect.magnitude
      );
    }
  }

  _removeStatEffect(entity, effect) {
    if (effect.type === "slow") {
      entity.actionSpeed = entity._baseActionSpeed ?? entity.actionSpeed;
      delete entity._baseActionSpeed;
    }
  }

  _tickEffects(dt) {
    for (const [id, effects] of this._effects) {
      const entity = this._findEntityById(id);
      const remaining = [];

      for (const effect of effects) {
        effect.duration -= dt;
        if (effect.duration <= 0) {
          if (entity) this._removeStatEffect(entity, effect);
          this.onEvent({ type: "effect_expired", entity, effect });
        } else {
          remaining.push(effect);
        }
      }

      if (remaining.length > 0) {
        this._effects.set(id, remaining);
      } else {
        this._effects.delete(id);
      }
    }
  }

  // ─────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────

  _removeDeadCombatants() {
    for (const id of [...this.combatants]) {
      const entity = this._findEntityById(id);
      if (entity?.dead) {
        this._disengage(entity);
      }
    }

    // If only the player is left in combat (all enemies dead/fled), end combat
    if (
      this.combatants.size === 1 &&
      this.combatants.has(this.player.id)
    ) {
      this._disengage(this.player);
      this.onEvent({ type: "combat_end" });
    }
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  _rollDamage(ability, attacker) {
    const { base, variance } = ability.damage;
    return base + Math.floor(Math.random() * (variance + 1));
  }

  _findNPC(id) {
    return this.npcs.find(n => n.id === id) ?? null;
  }

  _findEntityById(id) {
    if (this.player.id === id) return this.player;
    return this._findNPC(id);
  }
}
