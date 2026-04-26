"use strict";
/**
 * FighterResolver.js
 * Handles Fighter-specific ability specials: charge, execute, whirlwind,
 * battle_cry, fortify, disengage, second_wind.
 * Falls through to GenericResolver for standard melee/ranged.
 */

const { _rollDamage, _send, _broadcast, _handleNPCKill } = require("./shared");
const Generic = require("./GenericResolver");

const FIGHTER_SPECIALS = new Set(["charge", "execute", "disengage", "second_wind", "battle_cry", "fortify", "eagles_eye", "elemental_charge"]);

function canHandle(ability) {
  return FIGHTER_SPECIALS.has(ability.special);
}

function resolve(session, world, ability, msg) {
  const { abilityId, targetId } = msg;

  // ── Charge ─────────────────────────────────────────────────────────────────
  if (ability.special === "charge") {
    const npc = world.npcs.get(targetId);
    if (!npc || npc.dead) return;
    const dx  = npc.x - session.x, dy = npc.y - session.y;
    const len = Math.sqrt(dx*dx + dy*dy) || 1;
    session.x = Math.round(npc.x - Math.round(dx/len));
    session.y = Math.round(npc.y - Math.round(dy/len));
    const damage = _rollDamage(ability, session);
    const result = world.resolveAttack(targetId, damage, session);
    if (!result) return;
    const onHit = ability.onHit;
    if (onHit?.effect === "stun") {
      const stunMs = onHit.duration / 60 * 1000;
      npc.stunnedUntil = Date.now() + stunMs;
      npc.slowedUntil  = Date.now() + stunMs * 2;
      npc.state = "stunned";
    }
    session.rage = Math.min(100, (session.rage ?? 0) + 8);
    session.lastCombatAt = Date.now();
    _send(session.ws, { type: "rage_update", rage: session.rage });
    _broadcast(session.worldId, { type: "npc_damaged", npcId: targetId, hp: result.hp, maxHp: result.maxHp, damage, attackerName: session.name });
    _send(session.ws, { type: "ability_result", abilityId, targetId, damage, special: "charge", x: session.x, y: session.y });
    if (result.dead) _handleNPCKill(session, world, targetId, result);
    return;
  }

  // All other fighter specials fall through to generic
  Generic.resolve(session, world, ability, msg);
}

module.exports = { canHandle, resolve };