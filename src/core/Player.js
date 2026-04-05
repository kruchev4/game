import { Entity } from "./Entity.js";

export class Player extends Entity {
  constructor({ x, y } = {}) {
    super({ x, y });

    this.id   = "player";
    this.type = "player";

    // ── Combat stats — overwritten by class data at character creation ──
    this.hp          = 80;
    this.maxHp       = 80;
    this.actionSpeed = 60;
    this.actionTimer = 60;
    this.actionReady = false;
    this.classId     = null;
    this.abilities   = [];

    // ── Resource (mana / rage / energy — class dependent) ──
    // resourceDef mirrors the `resource` block from classes.json
    this.resource    = 0;
    this.maxResource = 0;
    this.resourceDef = null; // { type, label, color, max, regenPerTick, ... }

    // ── Cooldown state — written by CombatSystem ──
    // { abilityId -> { remaining, max } }
    this.abilityCooldowns = {};

    // ── Flags ──
    this.inCombat = false;
    this.dead     = false;

    // ── Click-to-move state — written by MovementSystem ──
    this.moveTarget = null;
    this.movePath   = null;
  }
}
