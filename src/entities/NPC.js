export class NPC {
  constructor({ id, x, y, roamCenter, roamRadius = 6 }) {
    this.id = id;
    this.type = "npc";

    this.x = x;
    this.y = y;

    this.roamCenter = roamCenter;
    this.roamRadius = roamRadius;

    // ✅ perception
    this.perceptionRadius = 5;
    this.state = "roaming"; // "roaming" | "alert"

    // movement timing
    this._cooldown = 0;

    // future hooks
    this.faction = "hostile";
  }
}
