export class NPCPerceptionSystem {
  constructor({ npcs, player }) {
    this.npcs = npcs;
    this.player = player;
  }

  update() {
    if (!this.player) return;

    for (const npc of this.npcs) {
      const dx = npc.x - this.player.x;
      const dy = npc.y - this.player.y;

      // Manhattan distance (cheap + consistent with grid movement)
      const dist = Math.abs(dx) + Math.abs(dy);

      if (dist <= npc.perceptionRadius) {
        if (npc.state !== "alert") {
          npc.state = "alert";
          // Later: record lastSeenPos, time, etc.
        }
      } else {
        if (npc.state !== "roaming") {
          npc.state = "roaming";
        }
      }
    }
  }
}
