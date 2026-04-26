"use strict";
/**
 * abilities/index.js
 * Routes ability casts to the correct resolver.
 * Priority: special-keyed class resolver → GenericResolver
 */

const Shared   = require("./shared");
const Generic  = require("./GenericResolver");
const Fighter  = require("./FighterResolver");
const Ranger   = require("./RangerResolver");
const Paladin  = require("./PaladinResolver");

// Map of ability.special → resolver
const SPECIAL_MAP = {
  // Paladin
  consecrate:    Paladin,
  ring_the_bell: Paladin,
  aura_toggle:   Paladin,
  // Fighter
  charge:        Fighter,
  // Generic (handled inside Generic/self-buff path)
  execute:       Generic,
  disengage:     Generic,
  second_wind:   Generic,
};

// Map of abilityId → resolver (for abilities without a special tag)
const ID_MAP = {
  lay_on_hands:    Paladin,
  word_of_renewal: Paladin,
};

function route(session, world, ability, msg) {
  const resolver =
    SPECIAL_MAP[ability.special] ??
    ID_MAP[msg.abilityId]        ??
    Generic;

  resolver.resolve(session, world, ability, msg);
}

module.exports = { route, init: Shared.init };