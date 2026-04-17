/**
 * EffectSystem.js
 *
 * Handles all timed effects: DoTs, HoTs, buffs, debuffs.
 *
 * Effect definition shape:
 * {
 *   id:        string,      // unique effect type id e.g. "bleed", "slow"
 *   name:      string,      // display name
 *   icon:      string,      // emoji icon for UI
 *   category:  string,      // "dot" | "hot" | "buff" | "debuff"
 *   duration:  number,      // total frames the effect lasts
 *   tickRate:  number,      // frames between ticks (for dot/hot)
 *   magnitude: number,      // damage/heal per tick, or buff strength
 *   maxStacks: number,      // 1 = refresh only, >1 = stackable
 *   stackMode: string,      // "refresh" | "stack" | "extend"
 *   stat:      string,      // for buffs/debuffs: which stat is modified
 *   color:     string,      // particle color for visual feedback
 * }
 *
 * Applied effect instance shape:
 * {
 *   ...definition fields,
 *   sourceId:  string,      // who applied this effect
 *   elapsed:   number,      // frames since application
 *   tickTimer: number,      // frames until next tick
 *   stacks:    number,      // current stack count
 *   remaining: number,      // computed: duration - elapsed
 * }
 */

// ── Effect Definitions ────────────────────────────────────────────────────

export const EFFECTS = {

  // ── Damage over Time ───────────────────────────────────────────────────

  bleed: {
    id: "bleed", name: "Bleeding", icon: "🩸",
    category: "dot",
    duration: 180,   // 3 seconds at 60fps
    tickRate: 30,    // tick every 0.5s
    magnitude: 4,    // 4 damage per tick
    maxStacks: 3,    // stacks up to 3
    stackMode: "stack",
    color: "#cc2200"
  },

  poison: {
    id: "poison", name: "Poisoned", icon: "☠️",
    category: "dot",
    duration: 240,   // 4 seconds
    tickRate: 40,    // tick every ~0.67s
    magnitude: 3,
    maxStacks: 1,
    stackMode: "refresh",
    color: "#44aa00"
  },

  burn: {
    id: "burn", name: "Burning", icon: "🔥",
    category: "dot",
    duration: 180,
    tickRate: 20,    // fast ticks, lower damage
    magnitude: 2,
    maxStacks: 1,
    stackMode: "refresh",
    color: "#ff6600"
  },

  shadow_wound: {
    id: "shadow_wound", name: "Shadow Wound", icon: "🌑",
    category: "dot",
    duration: 120,
    tickRate: 30,
    magnitude: 5,
    maxStacks: 1,
    stackMode: "refresh",
    color: "#6622cc"
  },

  // ── Heal over Time ─────────────────────────────────────────────────────

  rejuvenation: {
    id: "rejuvenation", name: "Rejuvenation", icon: "🌿",
    category: "hot",
    duration: 300,   // 5 seconds
    tickRate: 60,    // tick every second
    magnitude: 8,
    maxStacks: 1,
    stackMode: "refresh",
    color: "#44ee66"
  },

  renew: {
    id: "renew", name: "Renew", icon: "✨",
    category: "hot",
    duration: 180,
    tickRate: 30,
    magnitude: 6,
    maxStacks: 1,
    stackMode: "refresh",
    color: "#aaffcc"
  },

  // ── Debuffs ────────────────────────────────────────────────────────────

  slow: {
    id: "slow", name: "Slowed", icon: "🧊",
    category: "debuff",
    stat: "speed",
    duration: 90,    // 1.5 seconds
    tickRate: 0,     // no ticks — applied once
    magnitude: 0.5,  // 50% speed reduction
    maxStacks: 1,
    stackMode: "refresh",
    color: "#88aaff"
  },

  stun: {
    id: "stun", name: "Stunned", icon: "💫",
    category: "debuff",
    stat: "stunned",
    duration: 90,    // 1.5 seconds
    tickRate: 0,
    magnitude: 1,    // binary — either stunned or not
    maxStacks: 1,
    stackMode: "refresh",
    color: "#ffff00"
  },

  weaken: {
    id: "weaken", name: "Weakened", icon: "💔",
    category: "debuff",
    stat: "damage",
    duration: 180,
    tickRate: 0,
    magnitude: 0.3,  // 30% damage reduction
    maxStacks: 1,
    stackMode: "refresh",
    color: "#ff8888"
  },

  vulnerable: {
    id: "vulnerable", name: "Vulnerable", icon: "🎯",
    category: "debuff",
    stat: "defense",
    duration: 120,
    tickRate: 0,
    magnitude: 0.25, // take 25% more damage
    maxStacks: 1,
    stackMode: "refresh",
    color: "#ffaa00"
  },

  // ── Buffs ──────────────────────────────────────────────────────────────

  haste: {
    id: "haste", name: "Haste", icon: "⚡",
    category: "buff",
    stat: "actionSpeed",
    duration: 480,   // 8 seconds
    tickRate: 0,
    magnitude: 0.7,  // 30% faster actions (multiply speed by 0.7)
    maxStacks: 1,
    stackMode: "refresh",
    color: "#ffff44"
  },

  shield: {
    id: "shield", name: "Shield", icon: "🛡️",
    category: "buff",
    stat: "absorb",
    duration: 300,
    tickRate: 0,
    magnitude: 20,   // absorbs 20 damage before breaking
    maxStacks: 1,
    stackMode: "refresh",
    color: "#4488ff"
  },

  fortify: {
    id: "fortify", name: "Fortified", icon: "🏰",
    category: "buff",
    stat: "damageReduction",
    duration: 180,
    tickRate: 0,
    magnitude: 0.5,  // 50% damage reduction
    maxStacks: 1,
    stackMode: "refresh",
    color: "#8888ff"
  },

  eagles_eye: {
    id: "eagles_eye", name: "Eagle's Eye", icon: "🦅",
    category: "buff",
    stat: "range",
    duration: 360,   // 6 seconds
    tickRate: 0,
    magnitude: 4,    // +4 tiles range
    maxStacks: 1,
    stackMode: "refresh",
    color: "#aaeeaa"
  },

  battle_cry: {
    id: "battle_cry", name: "Battle Cry", icon: "⚔️",
    category: "buff",
    stat: "actionSpeed",
    duration: 480,
    tickRate: 0,
    magnitude: 0.7,
    maxStacks: 1,
    stackMode: "refresh",
    color: "#ffaa00"
  },

  next_crit: {
    id: "next_crit", name: "Next Crit", icon: "💥",
    category: "buff",
    stat: "nextCrit",
    duration: 600,   // 10 seconds — expires if not used
    tickRate: 0,
    magnitude: 2.0,  // 200% damage multiplier
    maxStacks: 1,
    stackMode: "refresh",
    color: "#ff4400"
  },

  divine_protection: {
    id: "divine_protection", name: "Divine Protection", icon: "😇",
    category: "buff",
    stat: "absorb",
    duration: 300,
    tickRate: 0,
    magnitude: 40,
    maxStacks: 1,
    stackMode: "refresh",
    color: "#ffffaa"
  }
};

// ── EffectSystem class ────────────────────────────────────────────────────

export class EffectSystem {
  /**
   * @param {object} opts
   * @param {object}   opts.player   - player entity
   * @param {Array}    opts.npcs     - npc array
   * @param {Function} opts.onEvent  - (event) => {} for damage/heal/effect notifications
   */
  constructor({ player, npcs, onEvent }) {
    this.player   = player;
    this.npcs     = npcs;
    this.onEvent  = onEvent ?? (() => {});

    // Map of entityId -> [AppliedEffect, ...]
    this._effects = new Map();
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Apply an effect to an entity.
   * @param {object|string} entity   - entity object or entity id "player"
   * @param {string}        effectId - key from EFFECTS
   * @param {string}        sourceId - who applied it
   * @param {object}        [overrides] - override magnitude/duration
   */
  apply(entity, effectId, sourceId, overrides = {}) {
    const def = EFFECTS[effectId];
    if (!def) {
      console.warn(`[EffectSystem] Unknown effect: ${effectId}`);
      return;
    }

    const target   = typeof entity === "string" ? this._findEntity(entity) : entity;
    if (!target) return;

    const existing = this._getEffects(target.id);
    const current  = existing.find(e => e.id === effectId);

    if (current) {
      // Handle stacking
      if (def.stackMode === "refresh") {
        current.elapsed   = 0;
        current.magnitude = overrides.magnitude ?? def.magnitude;
      } else if (def.stackMode === "stack" && current.stacks < def.maxStacks) {
        current.stacks++;
        current.elapsed = 0; // refresh duration on stack
      } else if (def.stackMode === "extend") {
        current.elapsed = Math.max(0, current.elapsed - def.duration);
      }
      return;
    }

    // New effect
    const applied = {
      ...def,
      ...overrides,
      sourceId,
      elapsed:   0,
      tickTimer: def.tickRate,
      stacks:    1
    };

    existing.push(applied);
    this._effects.set(target.id, existing);

    // Immediate application for buffs/debuffs
    this._applyStatModifier(target, applied, true);

    this.onEvent({
      type:     "effect_applied",
      entity:   target,
      effect:   applied,
      sourceId
    });
  }

  /**
   * Remove a specific effect from an entity.
   */
  remove(entity, effectId) {
    const target = typeof entity === "string" ? this._findEntity(entity) : entity;
    if (!target) return;

    const effects = this._getEffects(target.id);
    const idx     = effects.findIndex(e => e.id === effectId);
    if (idx === -1) return;

    const [removed] = effects.splice(idx, 1);
    this._applyStatModifier(target, removed, false);

    this.onEvent({ type: "effect_expired", entity: target, effect: removed });
  }

  /**
   * Remove all effects from an entity (e.g. on death or cleanse).
   */
  removeAll(entityId) {
    const effects = this._getEffects(entityId);
    const target  = this._findEntity(entityId);
    for (const effect of effects) {
      if (target) this._applyStatModifier(target, effect, false);
    }
    this._effects.delete(entityId);
  }

  /**
   * Get all active effects on an entity.
   */
  getEffects(entityId) {
    return this._getEffects(entityId);
  }

  /**
   * Check if entity has a specific effect active.
   */
  hasEffect(entityId, effectId) {
    return this._getEffects(entityId).some(e => e.id === effectId);
  }

  /**
   * Check if entity is stunned.
   */
  isStunned(entityId) {
    return this.hasEffect(entityId, "stun");
  }

  /**
   * Get total magnitude of a stat modifier (e.g. all slows combined).
   */
  getStatModifier(entityId, stat) {
    const effects = this._getEffects(entityId);
    let total = 0;
    for (const e of effects) {
      if (e.stat === stat && (e.category === "buff" || e.category === "debuff")) {
        total += e.magnitude * e.stacks;
      }
    }
    return total;
  }

  /**
   * Get damage multiplier for an entity (accounting for buffs/debuffs).
   */
  getDamageMultiplier(entityId) {
    let mult = 1;
    const effects = this._getEffects(entityId);

    // Next crit — consumed on use
    const crit = effects.find(e => e.id === "next_crit");
    if (crit) {
      mult *= crit.magnitude;
      this.remove(this._findEntity(entityId), "next_crit");
    }

    // Weaken
    if (this.hasEffect(entityId, "weaken")) mult *= 0.7;

    return mult;
  }

  /**
   * Get incoming damage after absorb shields and damage reduction.
   * Returns modified damage value.
   */
  applyIncomingDamage(entityId, rawDamage) {
    const effects = this._getEffects(entityId);
    let damage    = rawDamage;

    // Fortify — flat reduction
    const fortify = effects.find(e => e.id === "fortify" || e.id === "divine_protection");
    if (fortify) damage *= (1 - fortify.magnitude);

    // Vulnerable — increase damage taken
    if (this.hasEffect(entityId, "vulnerable")) damage *= 1.25;

    // Absorb shield — consume shield charges
    const shield = effects.find(e => e.stat === "absorb");
    if (shield) {
      const absorbed = Math.min(shield.magnitude, damage);
      shield.magnitude -= absorbed;
      damage           -= absorbed;
      if (shield.magnitude <= 0) this.remove(this._findEntity(entityId), shield.id);
    }

    return Math.max(0, Math.round(damage));
  }

  // ── Update ────────────────────────────────────────────────────────────

  update() {
    for (const [entityId, effects] of this._effects) {
      const target = this._findEntity(entityId);

      for (let i = effects.length - 1; i >= 0; i--) {
        const effect = effects[i];
        effect.elapsed++;
        effect.remaining = Math.max(0, effect.duration - effect.elapsed);

        // Tick-based effects (DoT/HoT)
        if (effect.tickRate > 0) {
          effect.tickTimer--;
          if (effect.tickTimer <= 0) {
            effect.tickTimer = effect.tickRate;
            this._tick(target, effect);
          }
        }

        // Expire
        if (effect.elapsed >= effect.duration) {
          effects.splice(i, 1);
          if (target) this._applyStatModifier(target, effect, false);
          this.onEvent({ type: "effect_expired", entity: target, effect });
        }
      }

      // Clean up empty arrays
      if (effects.length === 0) this._effects.delete(entityId);
    }
  }

  // ── Private ───────────────────────────────────────────────────────────

  _tick(target, effect) {
    if (!target || target.dead) return;

    const amount = effect.magnitude * effect.stacks;

    if (effect.category === "dot") {
      const damage  = Math.max(1, Math.round(amount));
      target.hp     = Math.max(0, target.hp - damage);
      this.onEvent({
        type:   "dot_tick",
        entity: target,
        effect,
        damage
      });
      if (target.hp <= 0 && target.id !== "player") {
        target.dead = true;
        this.onEvent({ type: "kill", attacker: { id: effect.sourceId }, target });
      } else if (target.hp <= 0 && target.id === "player") {
        this.onEvent({ type: "player_death", attacker: { id: effect.sourceId }, target });
      }

    } else if (effect.category === "hot") {
      const heal    = Math.max(1, Math.round(amount));
      target.hp     = Math.min(target.maxHp, target.hp + heal);
      this.onEvent({
        type:   "hot_tick",
        entity: target,
        effect,
        heal
      });
    }
  }

  /**
   * Apply or remove a stat modifier from an entity.
   * For buffs/debuffs that directly modify entity stats.
   */
  _applyStatModifier(target, effect, apply) {
    if (!target) return;
    const sign = apply ? 1 : -1;

    switch (effect.stat) {
      case "actionSpeed":
        // Store base if not stored
        if (apply && !target._baseActionSpeed) {
          target._baseActionSpeed = target.actionSpeed;
        }
        target.actionSpeed = apply
          ? Math.round((target._baseActionSpeed ?? target.actionSpeed) * effect.magnitude)
          : (target._baseActionSpeed ?? target.actionSpeed);
        break;

      case "range":
        target._rangeBonus = (target._rangeBonus ?? 0) + sign * effect.magnitude;
        break;

      // absorb, stunned, damageReduction, nextCrit — handled at damage calc time
      // speed — handled in movement system check
      default:
        break;
    }
  }

  _getEffects(entityId) {
    if (!this._effects.has(entityId)) this._effects.set(entityId, []);
    return this._effects.get(entityId);
  }

  _findEntity(entityId) {
    if (entityId === "player" || entityId === this.player?.id) return this.player;
    return this.npcs?.find(n => n.id === entityId) ?? null;
  }
}
