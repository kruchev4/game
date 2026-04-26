"use strict";
/**
 * RangerResolver.js
 * Handles Ranger-specific ability specials: elemental_charge, eagles_eye.
 * Volley is handled separately via volley_place message.
 * Falls through to GenericResolver for standard ranged/multishot.
 */

const Generic = require("./GenericResolver");

const RANGER_SPECIALS = new Set(["elemental_charge", "eagles_eye"]);

function canHandle(ability) {
  return RANGER_SPECIALS.has(ability.special);
}

function resolve(session, world, ability, msg) {
  // Ranger specials are all self/buff type — fall through to generic
  Generic.resolve(session, world, ability, msg);
}

module.exports = { canHandle, resolve };