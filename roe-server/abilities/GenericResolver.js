"use strict";
/**
 * GenericResolver.js
 * Handles all standard ability types: melee, ranged, heal, aoe, buff, self.
 * Class-specific specials are routed to their own resolver before this runs.
 */

const { _rollDamage, _rollHeal, _statMod, _inRange, _applyHeal,
        _send, _broadcast, _handleNPCKill, getRankedAbility,
        worlds, players } = require("./shared");

function resolve(session, world, ability, msg) {
  const { abilityId, targetId } = msg;
  const type          = ability.type ?? "melee";
  const isMultiTarget = (ability.targets ?? 1) > 1;
  const isCenteredAoe = ability.aoe?.centeredOnSelf === true;

  // ── AOE ────────────────────────────────────────────────────────────────────
  if (type === "aoe" || isMultiTarget || isCenteredAoe) {
    const radius     = ability.aoe?.radius ?? ability.range ?? 3;
    const maxTargets = ability.targets ?? ability.aoe?.maxTargets ?? 12;
    const npcsHit    = [...world.npcs.values()]
      .filter(n => !n.dead && _inRange(session, n, radius))
      .slice(0, maxTargets);

    let aoeChargeEffect = null, aoeBonusDamage = 0;
    if (session.elementalCharge && Date.now() < session.elementalCharge.expiresAt) {
      aoeChargeEffect = session.elementalCharge.onHitEffect;
      aoeBonusDamage  = session.elementalCharge.bonusDamage;
      session.elementalCharge = null;
    }

    let totalDamage = 0;
    for (const npc of npcsHit) {
      const dmg    = _rollDamage(ability, session) + aoeBonusDamage;
      const result = world.resolveAttack(npc.id, dmg, session);
      if (!result) continue;
      totalDamage += dmg;
      _broadcast(session.worldId, {
        type: "npc_damaged", npcId: npc.id,
        hp: result.hp, maxHp: result.maxHp,
        damage: dmg, attackerName: session.name
      });
      if (result.dead) _handleNPCKill(session, world, npc.id, result);
    }

    if (ability.healMin > 0) {
      const healAmt = _rollHeal(ability);
      _applyHeal(session, healAmt, world);
    }

    _send(session.ws, { type: "ability_result", abilityId, aoe: true, targetsHit: npcsHit.length, totalDamage });
    return;
  }

  // ── Heal ───────────────────────────────────────────────────────────────────
  if (type === "heal") {
    const healAmt = _rollHeal(ability);
    const target  = targetId === "player" || !targetId
      ? session
      : players.get(targetId) ?? session;

    const oldHp  = target.hp;
    target.hp    = Math.min(target.maxHp, target.hp + healAmt);
    const actual = target.hp - oldHp;

    _send(target.ws, { type: "player_stat_update", hp: target.hp, maxHp: target.maxHp, gold: target.gold, xp: target.xp });
    _broadcast(session.worldId, { type: "player_healed", healerToken: session.playerToken, targetToken: target.playerToken, amount: actual });
    _send(session.ws, { type: "ability_result", abilityId, heal: actual });
    return;
  }

  // ── Self / Buff ────────────────────────────────────────────────────────────
  if (type === "self" || type === "buff") {
    const fx = ability.selfEffect ?? null;

    if (abilityId === "second_wind") {
      const healPct = ability.healPercent ?? 0.20;
      const conMod  = _statMod(session.stats?.con ?? session.stats?.CON ?? 10);
      const actual  = Math.floor((session.maxHp ?? 80) * (healPct + conMod * 0.02));
      session.hp    = Math.min(session.maxHp, (session.hp ?? 0) + actual);
      _send(session.ws, { type: "ability_result", abilityId, heal: actual });
      _send(session.ws, { type: "player_stat_update", hp: session.hp, maxHp: session.maxHp, xp: session.xp, gold: session.gold });
      return;
    }
    if (abilityId === "divine_shield") {
      session.buffActive    = abilityId;
      session.buffExpiresAt = Date.now() + 6000;
      _send(session.ws, { type: "buff_applied", abilityId, duration: 6000 });
      return;
    }
    if (fx?.effect === "elemental_charge") {
      const durationMs = (fx.duration ?? 600) / 60 * 1000;
      session.elementalCharge = { element: fx.element, bonusDamage: fx.bonusDamage ?? 0, onHitEffect: fx.onHitEffect ?? null, expiresAt: Date.now() + durationMs };
      _send(session.ws, { type: "buff_applied", abilityId, buffType: "elemental_charge", element: fx.element, duration: durationMs });
      return;
    }
    if (fx?.effect === "battle_cry") {
      const durationMs = (fx.duration ?? 480) / 60 * 1000;
      session.battleCry = { expiresAt: Date.now() + durationMs, magnitude: fx.magnitude ?? 0.7 };
      if (fx.rageBonus > 0) session.rage = Math.min(100, (session.rage ?? 0) + fx.rageBonus);
      _send(session.ws, { type: "buff_applied", abilityId, buffType: "battle_cry", magnitude: fx.magnitude ?? 0.7, duration: durationMs, rage: session.rage });
      return;
    }
    if (fx?.effect === "eagles_eye") {
      const durationMs = (fx.duration ?? 360) / 60 * 1000;
      session.eaglesEye = { expiresAt: Date.now() + durationMs, rangeBonus: fx.magnitude ?? 4, damageMult: fx.damageMult ?? 1.0 };
      _send(session.ws, { type: "buff_applied", abilityId, buffType: "eagles_eye", rangeBonus: fx.magnitude ?? 4, duration: durationMs });
      return;
    }
    if (fx?.effect === "fortify") {
      const durationMs = (fx.duration ?? 180) / 60 * 1000;
      session.fortify = { expiresAt: Date.now() + durationMs, magnitude: fx.magnitude ?? 0.5, reflect: fx.reflect ?? 0 };
      _send(session.ws, { type: "buff_applied", abilityId, buffType: "fortify", magnitude: fx.magnitude ?? 0.5, duration: durationMs });
      return;
    }
    if (fx?.effect === "disengage") {
      _send(session.ws, { type: "ability_result", abilityId, special: "disengage", magnitude: fx.magnitude ?? 3 });
      return;
    }
    // Generic self buff
    _send(session.ws, { type: "buff_applied", abilityId, duration: (fx?.duration ?? 300) / 60 * 1000 });
    return;
  }

  // ── Taunt ──────────────────────────────────────────────────────────────────
  if (type === "taunt") {
    const count = world.resolveTaunt(session.playerToken, ability.range ?? 6);
    _send(session.ws, { type: "taunt_result", count });
    return;
  }

  // ── Melee / Ranged — single target ────────────────────────────────────────
  const npc = world.npcs.get(targetId);
  if (!npc || npc.dead) return;

  // Execute — massive bonus damage below HP threshold
  if (ability.special === "execute") {
    const threshold = ability.executeThreshold ?? 0.25;
    const mult      = (npc.hp / npc.maxHp) <= threshold ? (ability.executeMultiplier ?? 2.0) : 1.0;
    const damage    = Math.floor(_rollDamage(ability, session) * mult);
    if (session.classId === "fighter") { session.rage = Math.min(100, (session.rage ?? 0) + 8); session.lastCombatAt = Date.now(); }
    const result = world.resolveAttack(targetId, damage, session);
    if (!result) return;
    _broadcast(session.worldId, { type: "npc_damaged", npcId: targetId, hp: result.hp, maxHp: result.maxHp, damage, attackerName: session.name, execute: mult > 1 });
    _send(session.ws, { type: "ability_result", abilityId, targetId, damage, execute: mult > 1 });
    if (result.dead) _handleNPCKill(session, world, targetId, result);
    return;
  }

  // Range check
  const abilityRange    = ability.range ?? 1;
  const eaglesEyeBonus  = (session.eaglesEye && Date.now() < session.eaglesEye.expiresAt) ? session.eaglesEye.rangeBonus : 0;
  const ddx = session.x - npc.x, ddy = session.y - npc.y;
  const dist = Math.sqrt(ddx*ddx + ddy*ddy);
  if (dist - eaglesEyeBonus > abilityRange + 2) {
    _send(session.ws, { type: "ability_result", abilityId, outOfRange: true });
    return;
  }

  let damage = _rollDamage(ability, session);

  // Eagles eye damage mult
  if (session.eaglesEye && Date.now() < session.eaglesEye.expiresAt) {
    damage = Math.floor(damage * (session.eaglesEye.damageMult ?? 1));
  }

  // Elemental charge
  let chargeEffect = null;
  if (session.elementalCharge && Date.now() < session.elementalCharge.expiresAt && ability.type === "ranged") {
    damage       += session.elementalCharge.bonusDamage;
    chargeEffect  = session.elementalCharge.onHitEffect;
    session.elementalCharge = null;
  }

  const result = world.resolveAttack(targetId, damage, session);
  if (!result) return;

  // onHit effects
  const onHitFx = ability.onHit ?? chargeEffect ?? null;
  if (onHitFx && !result.dead) {
    _applyOnHit(onHitFx, npc, targetId, session, world);
  }

  // Rage generation for fighter
  if (session.classId === "fighter") {
    session.rage = Math.min(100, (session.rage ?? 0) + 8);
    session.lastCombatAt = Date.now();
    _send(session.ws, { type: "rage_update", rage: session.rage });
  }

  _broadcast(session.worldId, { type: "npc_damaged", npcId: targetId, hp: result.hp, maxHp: result.maxHp, damage, attackerName: session.name, chargeEffect, crit: session._lastCrit ?? false });
  _send(session.ws, { type: "ability_result", abilityId, targetId, damage, hp: result.hp, maxHp: result.maxHp, chargeEffect, crit: session._lastCrit ?? false });
  if (result.dead) _handleNPCKill(session, world, targetId, result);
}

function _applyOnHit(fx, npc, targetId, session, world) {
  if (["poison","burn","bleed"].includes(fx.effect)) {
    world.applyDoT(targetId, fx.effect, fx.duration*(1000/60), fx.magnitude, session.playerToken);
  }
  if (fx.effect === "stun") {
    const stunMs = fx.duration / 60 * 1000;
    npc.stunnedUntil = Date.now() + stunMs;
    npc.slowedUntil  = Date.now() + stunMs * 2;
    npc.state = "stunned";
    _broadcast(session.worldId, { type: "npc_effect", npcId: npc.id, effect: "stun", duration: stunMs });
  }
  if (fx.effect === "slow") {
    npc.slowedUntil = Date.now() + (fx.duration / 60 * 1000);
    _broadcast(session.worldId, { type: "npc_effect", npcId: npc.id, effect: "slow", duration: fx.duration });
  }
  if (fx.effect === "judged") {
    npc._judged = { casterId: session.playerToken, expiresAt: Date.now() + fx.duration / 60 * 1000, damageBonus: fx.damageBonus ?? 0.15 };
  }
  if (fx.effect === "condemned") {
    npc._condemned = { casterId: session.playerToken, expiresAt: Date.now() + fx.duration / 60 * 1000, damageAmplify: fx.damageAmplify ?? 0.20 };
  }
}

module.exports = { resolve, _applyOnHit };