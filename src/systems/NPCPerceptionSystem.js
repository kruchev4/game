/**
 * NPCPerceptionSystem.js
 *
 * Handles NPC awareness. Only responsible for the roaming → alert transition.
 *
 * IMPORTANT: This system NEVER resets an NPC from alert back to roaming.
 * Once alert, an NPC stays alert until it dies or is leashed too far.
 * This prevents the "wanders off mid-combat" bug.
 *
 * Being attacked also sets state = "alert" directly via CombatSystem,
 * bypassing perception — so range doesn't matter when attacked.
 */

export class NPCPerceptionSystem {
  constructor({ npcs, player }) {
    this.npcs    = npcs;
    this.player  = player;

    this._cooldown = 0;
    this._interval = 10; // check every 10 frames (~6x/sec at 60fps)
  }

  update(dt = 1) {
    if (!this.player || this.player.dead) return;

    this._cooldown -= dt;
    if (this._cooldown > 0) return;
    this._cooldown = this._interval;

    for (const npc of this.npcs) {
      if (npc.dead) continue;

      // Already alert — don't touch its state
      if (npc.state === "alert") continue;

      const dist = Math.abs(npc.x - this.player.x) + Math.abs(npc.y - this.player.y);

      if (dist <= npc.perceptionRadius) {
        npc.state = "alert";
      }
      // NO else — we never reset alert → roaming here
    }
  }
}
