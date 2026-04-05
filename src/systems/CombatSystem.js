/**
 * CombatSystem.js
 *
 * DESIGN RULES:
 * - Movement is always free and real-time. CombatSystem never blocks movement.
 * - Only ACTIONS (attacks, abilities) are turn-gated via per-entity action timers.
 * - Each ability also has its own cooldown. Firing an ability starts its cooldown.
 *   The ability cannot be used again until the cooldown reaches zero.
 * - Action timer  = global "how often can this entity act"
 * - Ability cooldown = per-ability "this specific skill isn't ready yet"
 * - Both must be zero for an action to fire.
 * - Combat lives on the overworld — no mode switch, no separate grid.
 * - Melee: Manhattan distance <= ability.range. No LoS needed.
 * - Ranged: distance check + Line of Sight required.
 * - Combat starts when:
 *     (a) Player explicitly fires an ability at an NPC, OR
 *     (b) An NPC reaches attack range while alert
 * - Being hit ALWAYS aggroes an NPC regardless of distance.
 */

import { inRange, manhattanDist } from "../world/LoS.js";

export class CombatSystem {
  constructor({ world, player, npcs, abilities, onEvent = () => {} }) {
    this.world     = world;
    this.player    = player;
    this.npcs      = npcs;
    this.abilities = abilities;
    this.onEvent   = onEvent;

    // Set of entity ids currently in combat
    this.combatants = new Set();

    // Per-entity action timers { entityId -> ticksRemaining }
    this._actionTimers = new Map();

    // Per-entity per-ability cooldowns { entityId -> { abilityId -> ticksRemaining } }
    // Also stores maxCooldown for rendering the sweep ring
    // Structure: { entityId -> { abilityId -> { remaining, max } } }
    this._cooldowns = new Map();

    // Queued player action { abilityId, targetId }
    this._playerAction = null;

    // Active effects { entityId -> Effect[] }
    this._effects = new Map();
  }

  // ─────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────

  /**
   * Player fires an ability at a target.
   * Blocked if ability is on cooldown.
   */
  queuePlayerAction(abilityId, targetId) {
    const ability = this.abilities[abilityId];
    if (!ability) {
      console.warn(`[CombatSystem] Unknown ability: ${abilityId}`);
      return;
    }

    // Check ability cooldown
    if (this._isOnCooldown(this.player.id, abilityId)) {
      this.onEvent({ type: "on_cooldown", entity: this.player, ability });
      return;
    }

    if (!this.combatants.has(this.player.id)) {
      this._engage(this.player);
    }

    const target = this._findNPC(targetId);
    if (target && !target.dead) {
      target.state = "alert"; // being attacked always aggroes
      if (!this.combatants.has(targetId)) {
        this._engage(target);
      }
    }

    this._playerAction = { abilityId, targetId };
  }

  /**
   * NPC AI queues an action. Blocked if ability is on cooldown.
   */
  queueNPCAction(npc, abilityId, targetId) {
    if (!this.combatants.has(npc.id)) return;
    if (this._isOnCooldown(npc.id, abilityId)) return;
    npc._queuedAction = { abilityId, targetId };
  }

  /**
   * Returns cooldown info for a given entity + ability.
   * Used by Renderer to draw the sweep ring.
   * @returns {{ remaining: number, max: number } | null}
   */
  getCooldown(entityId, abilityId) {
    return this._cooldowns.get(entityId)?.[abilityId] ?? null;
  }

  /**
   * Called once per frame from Engine.loop().
   */
  update(dt = 1) {
    this._checkNPCEngagement();
    this._tickTimers(dt);
    this._tickCooldowns(dt);
    this._tickEffects(dt);
    this._resolvePlayerAction();
    this._resolveNPCActions();
    this._removeDeadCombatants();
  }

  // ─────────────────────────────────────────────
  // COMBAT ENTRY & EXIT
  // ─────────────────────────────────────────────

  _engage(entity) {
    if (this.combatants.has(entity.id)) return;
    this.combatants.add(entity.id);
    entity.inCombat = true;
    this._actionTimers.set(entity.id, entity.actionSpeed ?? 60);
    this.onEvent({ type: "engage", entity });
  }

  _disengage(entity) {
    if (!this.combatants.has(entity.id)) return;
    this.combatants.delete(entity.id);
    entity.inCombat    = false;
    entity.actionReady = false;
    this._actionTimers.delete(entity.id);
    this._effects.delete(entity.id);
    // Note: cooldowns persist after combat — intentional.
    // You can't re-engage with a fresh cooldown slate.
    this.onEvent({ type: "disengage", entity });
  }

  _checkNPCEngagement() {
    for (const npc of this.npcs) {
      if (npc.dead || npc.state !== "alert") continue;
      if (this.combatants.has(npc.id)) continue;

      const primaryAbilityId = npc.abilities?.[0];
      if (!primaryAbilityId) continue;

      const ability = this.abilities[primaryAbilityId];
      if (!ability) continue;

      if (inRange(this.world, npc, this.player, ability)) {
        this._engage(npc);
        this._engage(this.player);
      }
    }
  }

  // ─────────────────────────────────────────────
  // TIMERS & COOLDOWNS
  // ─────────────────────────────────────────────

  _tickTimers(dt) {
    for (const [id, timer] of this._actionTimers) {
      const next = Math.max(0, timer - dt);
      this._actionTimers.set(id, next);

      const entity = this._findEntityById(id);
      if (entity) {
        entity.actionReady = next === 0;
        entity.actionTimer = next;
      }
    }
  }

  _tickCooldowns(dt) {
    for (const [entityId, cdMap] of this._cooldowns) {
      for (const abilityId of Object.keys(cdMap)) {
        const cd = cdMap[abilityId];
        cd.remaining = Math.max(0, cd.remaining - dt);
      }

      // Expose cooldown map on entity for renderer access
      const entity = this._findEntityById(entityId);
      if (entity) entity.abilityCooldowns = cdMap;
    }
  }

  _isOnCooldown(entityId, abilityId) {
    const cd = this._cooldowns.get(entityId)?.[abilityId];
    return cd ? cd.remaining > 0 : false;
  }

  _startCooldown(entityId, abilityId) {
    const ability = this.abilities[abilityId];
    if (!ability?.cooldown) return;

    if (!this._cooldowns.has(entityId)) {
      this._cooldowns.set(entityId, {});
    }

    this._cooldowns.get(entityId)[abilityId] = {
      remaining: ability.cooldown,
      max:       ability.cooldown
    };
  }

  // ─────────────────────────────────────────────
  // ACTION RESOLUTION
  // ─────────────────────────────────────────────

  _resolvePlayerAction() {
    if (!this._playerAction) return;
    if (!this.combatants.has(this.player.id)) return;

    const timer = this._actionTimers.get(this.player.id) ?? 1;
    if (timer > 0) return;

    const { abilityId, targetId } = this._playerAction;
    this._playerAction = null;

    const ability = this.abilities[abilityId];
    const target  = this._findNPC(targetId);
    if (!target || target.dead) return;

    const fired = this._resolveAction(this.player, target, ability);
    if (fired) {
      this._startCooldown(this.player.id, abilityId);
      this._actionTimers.set(this.player.id, this.player.actionSpeed ?? 60);
    }
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
      const target  = targetId === this.player.id
        ? this.player
        : this._findNPC(targetId);

      if (!target || !ability) continue;

      const fired = this._resolveAction(npc, target, ability);
      if (fired) {
        this._startCooldown(npc.id, abilityId);
        this._actionTimers.set(npc.id, npc.actionSpeed ?? 70);
      }
    }
  }

  /**
   * Core resolution: validate range + LoS, roll damage, apply effects.
   * Returns true if the action actually fired (hit or miss due to range).
   */
  _resolveAction(attacker, target, ability) {
    if (!inRange(this.world, attacker, target, ability)) {
      this.onEvent({ type: "out_of_range", attacker, target, ability });
      return false;
    }

    const damage = this._rollDamage(ability);
    target.hp    = Math.max(0, (target.hp ?? 0) - damage);

    if (ability.onHit) this._applyEffect(target, ability.onHit);

    this.onEvent({ type: "hit", attacker, target, ability, damage });

    if (target.hp <= 0) {
      this.onEvent({ type: "kill", attacker, target });
      this._disengage(target);
      target.dead = true;
    }

    return true;
  }

  // ─────────────────────────────────────────────
  // EFFECTS
  // ─────────────────────────────────────────────

  _applyEffect(entity, effectDef) {
    const effects  = this._effects.get(entity.id) ?? [];
    const existing = effects.findIndex(e => e.type === effectDef.effect);
    const effect   = {
      type:      effectDef.effect,
      duration:  effectDef.duration,
      magnitude: effectDef.magnitude
    };

    if (existing >= 0) effects[existing] = effect;
    else effects.push(effect);

    this._effects.set(entity.id, effects);
    this._applyStatEffect(entity, effect);
    this.onEvent({ type: "effect_applied", entity, effect });
  }

  _applyStatEffect(entity, effect) {
    if (effect.type === "slow") {
      entity._baseActionSpeed = entity._baseActionSpeed ?? entity.actionSpeed;
      entity.actionSpeed = Math.round(entity._baseActionSpeed / effect.magnitude);
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
      const entity    = this._findEntityById(id);
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

      if (remaining.length > 0) this._effects.set(id, remaining);
      else                       this._effects.delete(id);
    }
  }

  // ─────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────

  _removeDeadCombatants() {
    for (const id of [...this.combatants]) {
      const entity = this._findEntityById(id);
      if (entity?.dead) this._disengage(entity);
    }

    if (this.combatants.size === 1 && this.combatants.has(this.player.id)) {
      this._disengage(this.player);
      this.onEvent({ type: "combat_end" });
    }
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  _rollDamage(ability) {
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
