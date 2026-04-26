"use strict";
/**
 * PaladinResolver.js
 * Handles all Paladin-specific ability specials:
 *   consecrate, ring_the_bell, lay_on_hands, word_of_renewal, aura_toggle
 */

const { _statMod, _applyHeal, _rollDamage, _send, _broadcast, _handleNPCKill, worlds } = require("./shared");

const PALADIN_SPECIALS = new Set(["consecrate", "ring_the_bell", "lay_on_hands", "word_of_renewal", "aura_toggle"]);

function canHandle(ability) {
  return PALADIN_SPECIALS.has(ability.special) ||
         ability.id === "lay_on_hands" ||
         ability.id === "word_of_renewal";
}

function resolve(session, world, ability, msg) {
  const { abilityId } = msg;

  // ── Consecrate — ground holy DoT zone ─────────────────────────────────────
  if (ability.special === "consecrate") {
    const ge            = ability.groundEffect ?? {};
    const radius        = ability.aoe?.radius ?? 3;
    const dotDmg        = ge.dot?.damage ?? 6;
    const dotIntervalMs = (ge.dot?.interval ?? 60) / 60 * 1000;
    const durationMs    = (ge.duration ?? 480) / 60 * 1000;
    const allyBuff      = ge.allyBuff ?? null;
    const zoneStarted   = Date.now();
    const zoneX = session.x, zoneY = session.y;

    _broadcast(session.worldId, { type: "consecrate_zone", x: zoneX, y: zoneY, radius, duration: ge.duration ?? 480, allyBuff });

    const iv = setInterval(() => {
      if (Date.now() > zoneStarted + durationMs) { clearInterval(iv); return; }
      const w = worlds.get(session.worldId);
      if (!w) { clearInterval(iv); return; }
      for (const npc of w.npcs.values()) {
        if (npc.dead) continue;
        const dx = npc.x - zoneX, dy = npc.y - zoneY;
        if (Math.sqrt(dx*dx + dy*dy) <= radius) {
          const r = w.resolveAttack(npc.id, dotDmg, session);
          if (!r) continue;
          _broadcast(session.worldId, { type: "npc_damaged", npcId: npc.id, hp: r.hp, maxHp: r.maxHp, damage: dotDmg, attackerName: "Consecrate", isDot: true });
          if (r.dead) _handleNPCKill(session, w, npc.id, r);
        }
      }
    }, dotIntervalMs);

    _send(session.ws, { type: "ability_result", abilityId, special: "consecrate" });
    return;
  }

  // ── Ring the Bell — channel + empowered next hit ───────────────────────────
  if (ability.special === "ring_the_bell") {
    const buffDurationMs = (ability.buffDuration ?? 300) / 60 * 1000;
    session.ringTheBell = {
      expiresAt:         Date.now() + buffDurationMs,
      normalMultiplier:  ability.normalMultiplier  ?? 3.0,
      executeMultiplier: ability.executeMultiplier ?? 4.0,
      executeThreshold:  ability.executeThreshold  ?? 0.30
    };
    const castMs = (ability.castTime ?? 120) / 60 * 1000;
    _send(session.ws, { type: "cast_start", abilityId, castTime: castMs });
    _send(session.ws, { type: "ability_result", abilityId, special: "ring_the_bell", castTime: castMs, buffDuration: buffDurationMs });
    return;
  }

  // ── Word of Renewal — stacking HoT ────────────────────────────────────────
  if (abilityId === "word_of_renewal") {
    const hot        = ability.hot ?? { amount: 8, interval: 60, duration: 300, stacks: 2 };
    const tickMs     = (hot.interval ?? 60) / 60 * 1000;
    const durationMs = (hot.duration ?? 300) / 60 * 1000;
    const stacks     = Math.min(hot.stacks ?? 2, (session.wordOfRenewalStacks ?? 0) + 1);
    session.wordOfRenewalStacks = stacks;
    const intMod      = _statMod(session.stats?.INT ?? session.stats?.int ?? 12);
    const healPerTick = (hot.amount ?? 8) * stacks + Math.floor(intMod * 0.8);
    if (session._wordOfRenewalTimer) clearInterval(session._wordOfRenewalTimer);
    let elapsed = 0;
    session._wordOfRenewalTimer = setInterval(() => {
      elapsed += tickMs;
      if (elapsed >= durationMs) {
        clearInterval(session._wordOfRenewalTimer);
        session.wordOfRenewalStacks = 0;
        return;
      }
      session.hp = Math.min(session.maxHp, (session.hp ?? 0) + healPerTick);
      _send(session.ws, { type: "player_stat_update", hp: session.hp, maxHp: session.maxHp, xp: session.xp, gold: session.gold });
    }, tickMs);
    _send(session.ws, { type: "buff_applied", abilityId, duration: hot.duration, stacks, healPerTick });
    return;
  }

  // ── Lay on Hands — massive heal ────────────────────────────────────────────
  if (abilityId === "lay_on_hands") {
    const intMod  = _statMod(session.stats?.INT ?? session.stats?.int ?? 12);
    const healAmt = (ability.healMin ?? 80) +
      Math.floor(Math.random() * ((ability.healMax ?? 90) - (ability.healMin ?? 80) + 1)) +
      Math.floor(intMod * 1.5);
    _applyHeal(session, healAmt, world);
    _send(session.ws, { type: "ability_result", abilityId, heal: healAmt });
    return;
  }

  // ── Aura toggle ────────────────────────────────────────────────────────────
  if (ability.special === "aura_toggle") {
    if (session.activeAura === abilityId) {
      delete session.activeAura;
      delete session.auraEffect;
      _send(session.ws, { type: "buff_applied", effect: "aura_off", abilityId });
    } else {
      session.activeAura = abilityId;
      session.auraEffect = ability.selfEffect;
      _send(session.ws, { type: "buff_applied", abilityId, effect: abilityId, selfEffect: ability.selfEffect });
    }
    return;
  }
}

module.exports = { canHandle, resolve };