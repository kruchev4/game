export class NPCPerceptionSystem {
  constructor({ npcs, player }) {
    this.npcs = npcs;
    this.player = player;

    // run perception every N frames
    this._cooldown = 0;
    this._interval = 10; // ✅ every 10 frames (~6x/sec @ 60fps)
  }

  update(dt = 1) {
    
    if (!this.player) return;

    this._cooldown -= dt;
    if (this._cooldown > 0) return;

    // reset timer
    this._cooldown = this._interval;

    for (const npc of this.npcs) {
      const dx = npc.x - this.player.x;
      const dy = npc.y - this.player.y;

      // Manhattan distance (cheap + grid-consistent)
      const dist = Math.abs(dx) + Math.abs(dy);

      if (dist <= npc.perceptionRadius) {
        if (npc.state !== "alert") {
          npc.state = "alert";
        }
      } else {
        if (npc.state !== "roaming") {
          npc.state = "roaming";
        }
      }
    }
  }
}
