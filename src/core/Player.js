import { Entity } from "./Entity.js";

export class Player extends Entity {
  constructor({ x, y } = {}) {
    super({ x, y });

    this.id   = "player";
    this.type = "player";

    // Combat stats — overwritten by class data at character creation
    this.hp          = 80;
    this.maxHp       = 80;
    this.actionSpeed = 60;
    this.actionTimer = 60;
    this.actionReady = false;
    this.classId     = null;
    this.abilities   = [];

    // Cooldown state — populated by CombatSystem._tickCooldowns()
    // Structure: { abilityId -> { remaining: number, max: number } }
    this.abilityCooldowns = {};

    this.inCombat = false;
    this.dead     = false;

    // Click-to-move state (set by MovementSystem)
    this.moveTarget = null;
    this.movePath   = null;
  }
}
