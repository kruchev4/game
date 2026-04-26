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

  /**
   * Multiplayer mode — server owns NPC AI and attacks.
   * Only tick player cooldowns and resolve queued player actions.
   * Skip NPC engagement checks, NPC actions, and dead combatant cleanup.
   */
  updatePlayerOnly(dt = 1) {
    this._tickTimers(dt);
    this._tickCooldowns(dt);
    this._tickEffects(dt);
    this._resolvePlayerAction();
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
    // Engage as soon as alert — don't wait for attack range
    this._engage(npc);
    if (!this.combatants.has(this.player.id)) {
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

  // Public alias so Engine can start cooldowns directly in multiplayer
  startCooldown(entityId, abilityId) {
    this._startCooldown(entityId, abilityId);
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

    // Auto-engage player if not in combatants (multiplayer mode)
    if (!this.combatants.has(this.player.id)) {
      this._engage(this.player);
    }

    const timer = this._actionTimers.get(this.player.id) ?? 1;
    if (timer > 0) return;

    const { abilityId, targetId } = this._playerAction;
    this._playerAction = null;

    const ability = this.abilities[abilityId];
    if (!ability) return;

    let fired = false;

    switch (ability.type) {
      case "heal":
        fired = this._resolveHeal(this.player, targetId, ability);
        break;
      case "rez":
        fired = this._resolveRez(this.player, targetId, ability);
        break;
      case "aoe":
        fired = this._resolveAOE(this.player, ability);
        break;
      case "buff":
        fired = this._resolveBuff(this.player, ability);
        break;
      case "taunt":
        fired = this._resolveTaunt(this.player, ability);
        break;
      default:
        // melee / ranged — single target
        const target = this._findNPC(targetId);
        if (target && !target.dead) {
          fired = this._resolveAction(this.player, target, ability);
        }
    }

    if (fired) {
      this._startCooldown(this.player.id, abilityId);
      this._actionTimers.set(this.player.id, this.player.actionSpeed ?? 60);
    }
  }

  // ── Heal ─────────────────────────────────────────────────────────────────
  _resolveHeal(caster, targetId, ability) {
    // Heal self if no valid target, or target is the player
    const target = targetId === "player" || !targetId
      ? this.player
      : this._findNPC(targetId) ?? this.player;

    const healDef = ability.heal ?? { base: 20, variance: 5 };
    const amount  = healDef.base + Math.floor(Math.random() * (healDef.variance + 1));

    target.hp = Math.min(target.maxHp, (target.hp ?? 0) + amount);

    this.onEvent({ type: "heal", caster, target, ability, amount });
    return true;
  }

  // ── Resurrection ─────────────────────────────────────────────────────────
  _resolveRez(caster, targetId, ability) {
    // In multiplayer, rez targets remote players — fire event for Engine to handle
    this.onEvent({ type: "rez", caster, targetId, ability });
    return true;
  }

  // ── AOE ───────────────────────────────────────────────────────────────────
  _resolveAOE(caster, ability) {
    const aoe        = ability.aoe ?? {};
    const radius     = aoe.radius    ?? 3;
    const maxTargets = aoe.maxTargets ?? 6;
    const isSelf     = aoe.centeredOnSelf ?? true;
    const cx         = isSelf ? caster.x : caster.x;
    const cy         = isSelf ? caster.y : caster.y;

    // For cone (multishot) — get targets in front of player relative to current target
    let targets = [];
    if (aoe.shape === "cone") {
      targets = this._getConeTargets(caster, ability, maxTargets);
    } else {
      // Radius — all NPCs within range
      targets = this.npcs
        .filter(n => !n.dead)
        .map(n => ({
          npc:  n,
          dist: Math.sqrt((n.x - cx)**2 + (n.y - cy)**2)
        }))
        .filter(({ dist }) => dist <= radius)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, maxTargets)
        .map(({ npc }) => npc);
    }

    if (!targets.length) return false;

    let hitCount = 0;
    for (const target of targets) {
      const damage = this._rollDamage(ability);
      target.hp = Math.max(0, (target.hp ?? 0) - damage);
      this.onEvent({ type: "hit", attacker: caster, target, ability, abilityId: ability.id, damage });

      if (target.hp <= 0) {
        target.dead = true;
        this._disengage(target);
        this.onEvent({ type: "kill", attacker: caster, target });
      }
      hitCount++;
    }

    // AOE heal component (divine storm)
    if (ability.heal) {
      this._resolveHeal(caster, "player", ability);
    }

    this.onEvent({ type: "aoe", caster, ability, hitCount });
    return hitCount > 0;
  }

  // ── Cone (multishot) ──────────────────────────────────────────────────────
  _getConeTargets(caster, ability, maxTargets) {
    const range  = ability.range    ?? 6;
    const spread = ability.aoe?.spread ?? 2; // tile spread at max range

    // Get direction from caster to current target
    // Use the last targeted NPC as cone direction
    const primaryTarget = this.npcs.find(n =>
      !n.dead && Math.sqrt((n.x - caster.x)**2 + (n.y - caster.y)**2) <= range
    );
    if (!primaryTarget) return [];

    const dx  = primaryTarget.x - caster.x;
    const dy  = primaryTarget.y - caster.y;
    const len = Math.sqrt(dx*dx + dy*dy) || 1;
    const ux  = dx / len;
    const uy  = dy / len;

    // Find all NPCs in cone — project each NPC onto the cone axis
    return this.npcs
      .filter(n => !n.dead)
      .map(n => {
        const ex    = n.x - caster.x;
        const ey    = n.y - caster.y;
        const dist  = Math.sqrt(ex*ex + ey*ey);
        const proj  = ex*ux + ey*uy;           // distance along cone axis
        const perp  = Math.abs(ex*uy - ey*ux); // perpendicular distance
        const maxPerp = (proj / range) * spread; // spread widens with distance
        return { npc: n, dist, proj, perp, maxPerp };
      })
      .filter(({ dist, proj, perp, maxPerp }) =>
        proj > 0 && proj <= range && perp <= maxPerp + 0.5 && dist <= range
      )
      .sort((a, b) => a.dist - b.dist)
      .slice(0, maxTargets)
      .map(({ npc }) => npc);
  }

  // ── Buff ──────────────────────────────────────────────────────────────────
  _resolveBuff(caster, ability) {
    this.onEvent({ type: "buff", caster, ability });
    return true;
  }

  // ── Taunt ─────────────────────────────────────────────────────────────────
  _resolveTaunt(caster, ability) {
    // In multiplayer, server handles actual threat — just fire event
    this.onEvent({ type: "taunt", caster, ability });
    return true;
  }

  _resolveNPCActions() {
    for (const npc of this.npcs) {
      if (!this.combatants.has(npc.id)) continue;
      if (!npc._queuedAction) continue;

      // Never attack a dead player
      if (this.player.dead) {
        npc._queuedAction = null;
        continue;
      }

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
   * Returns true if the action actually fired.
   */
  _resolveAction(attacker, target, ability) {
    if (target.dead) return false;

    // In multiplayer, skip range check only for NPC attacks (server is authoritative)
    // Player abilities still check range locally for responsiveness
    const skipRange = this.multiplayerMode && attacker.id !== "player";
    if (!skipRange && !inRange(this.world, attacker, target, ability)) {
      this.onEvent({ type: "out_of_range", attacker, target, ability });
      return false;
    }

    const damage = this._rollDamage(ability);
    target.hp    = Math.max(0, (target.hp ?? 0) - damage);

    if (ability.onHit) this._applyEffect(target, ability.onHit);

    this.onEvent({ type: "hit", attacker, target, ability, abilityId: ability.id, damage });

    // selfEffect — buff on the attacker
    if (ability.selfEffect) {
      this.onEvent({ type: "self_effect", attacker, ability });
    }

    if (target.hp <= 0) {
      target.dead = true;
      this._disengage(target);

      if (target.id === this.player.id) {
        console.log("[CombatSystem] Player died — firing player_death event");
        this.onEvent({ type: "player_death", attacker, target });
      } else {
        this.onEvent({ type: "kill", attacker, target });
      }
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
      if (!entity?.dead) continue;

      // Player death is handled by Engine via player_death event —
      // don't disengage or modify player.dead here
      if (id === this.player.id) continue;

      this._disengage(entity);
    }

    // End combat only if all NPCs are gone and player is alive
    if (
      !this.player.dead &&
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
