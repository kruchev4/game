export class NPC {
  constructor({ id, x, y, roamCenter, roamRadius = 6 }) {
    this.id = id;
    this.type = "npc";

    this.x = x;
    this.y = y;

    // roaming constraints
    this.roamCenter = roamCenter; // {x,y}
    this.roamRadius = roamRadius;

    // movement state
    this._cooldown = 0;
    this._target = null;

    // future hooks
    this.faction = "hostile"; // placeholder
    this.state = "roaming";
  }
}
``
