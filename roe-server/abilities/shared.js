"use strict";
/**
 * shared.js
 * Shared helpers exported to all ability resolvers.
 * Call init() once on server startup to wire in the live Maps and functions.
 */

let _worlds           = null;
let _players          = null;
let _send_fn          = null;
let _broadcast_fn     = null;
let _handleNPCKill_fn = null;
let _applyHeal_fn     = null;

function init({ worlds, players, send, broadcast, handleNPCKill, applyHeal }) {
  _worlds           = worlds;
  _players          = players;
  _send_fn          = send;
  _broadcast_fn     = broadcast;
  _handleNPCKill_fn = handleNPCKill;
  _applyHeal_fn     = applyHeal;
}

function _statMod(val) { return Math.floor(((val ?? 10) - 10) / 2); }

function _rollDamage(ability, session = null) {
  const min = ability.damageMin ?? 0;
  const max = ability.damageMax ?? 0;
  if (min === 0 && max === 0) return 0;
  let dmg = min + Math.floor(Math.random() * (max - min + 1));
  if (session) {
    const stats = session.stats ?? {};
    const type  = ability.type ?? "melee";
    if (type === "ranged") {
      dmg += Math.floor(_statMod(stats.dex ?? stats.DEX ?? 10) * (ability.scalingMult ?? 1.0));
      const critChance = 0.05 + _statMod(stats.dex ?? stats.DEX ?? 10) * 0.02;
      session._lastCrit = Math.random() < critChance;
      if (session._lastCrit) dmg = Math.floor(dmg * 2);
    } else if (type === "melee") {
      dmg += _statMod(stats.str ?? stats.STR ?? 10);
    }
  }
  return Math.max(1, dmg);
}

function _rollHeal(ability) {
  const min = ability.healMin ?? 0;
  const max = ability.healMax ?? 0;
  if (min === 0 && max === 0) return 0;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function _inRange(attacker, target, range) {
  const dx = Math.abs(attacker.x - target.x);
  const dy = Math.abs(attacker.y - target.y);
  return (dx + dy) <= range + 2;
}

function getRankedAbility(ability, rank) {
  if (!ability || !rank || rank <= 1) return ability;
  const override = ability.ranks?.[String(rank)];
  if (!override) return ability;
  return { ...ability, ...override };
}

function _send(ws, msg)                                { return _send_fn(ws, msg); }
function _broadcast(worldId, msg, excludeToken)        { return _broadcast_fn(worldId, msg, excludeToken); }
function _handleNPCKill(session, world, npcId, result) { return _handleNPCKill_fn(session, world, npcId, result); }
function _applyHeal(session, amount, world)            { return _applyHeal_fn(session, amount, world); }

function getWorld(worldId) { return _worlds?.get(worldId); }
function getPlayer(token)  { return _players?.get(token); }

const worlds  = { get: (k) => _worlds?.get(k),  values: () => _worlds?.values()  };
const players = { get: (k) => _players?.get(k), values: () => _players?.values() };

module.exports = {
  init,
  _statMod, _rollDamage, _rollHeal, _inRange, getRankedAbility,
  _send, _broadcast, _handleNPCKill, _applyHeal,
  worlds, players, getWorld, getPlayer
};