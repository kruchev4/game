import { Entity } from "./Entity.js";

export class Player extends Entity {
  constructor({ x, y } = {}) {
    super({ x, y });

    this.id     = "player";
    this.type   = "player";

    // Combat stats — set properly at character creation,
    // these are safe defaults for testing
    this.hp          = 80;
    this.maxHp       = 80;
    this.actionSpeed = 60;  // ticks between actions
    this.actionTimer = 60;  // current countdown (exposed for UI)
    this.actionReady = false;

    this.inCombat    = false;
    this.dead        = false;

    // Set by MovementSystem for click-to-move rendering
    this.moveTarget  = null;
    this.movePath    = null;
  }
}
