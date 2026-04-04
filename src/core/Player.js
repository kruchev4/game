import { Entity } from "./Entity.js";

export class Player extends Entity {
  constructor({ x, y } = {}) {
    super({ x, y });
    this.type = "player";
  }
}
