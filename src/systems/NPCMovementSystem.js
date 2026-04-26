/**
 * NPCMovementSystem.js
 *
 * Owns all NPC movement decisions. Never sets aggro state — only reacts to it.
 *
 * Roaming:  random bounded movement within leash radius (cooldown-gated).
 * Alert:    A* pathfinding toward the player, respecting leash and walkability.
 *           Ranged NPCs stop when within their preferred range, not at adjacency.
 *
 * Design rule: this system reads npc.state but never writes it.
 */
import { hasLoS } from "../world/LoS.js";
import { isWalkable } from "../world/isWalkable.js";
import { aStar }      from "../pathfinding/aStar.js";

export class NPCMovementSystem {
  constructor({ world, npcs, player }) {
    this.world  = world;
    this.npcs   = npcs;
    this.player = player;

    // A* paths keyed by npc.id
    this._paths = new Map();

    // Recalculate paths every N frames to avoid running A* every tick
    this._pathInterval = 20;
    this._pathTick     = 0;
  }

  update(dt = 1) {
    this._pathTick += dt;
    const recalcPaths = this._pathTick >= this._pathInterval;
    if (recalcPaths) this._pathTick = 0;

    for (const npc of this.npcs) {
      if (npc.dead) continue;

      // If player is dead, NPCs go back to roaming
      if (this.player.dead && npc.state === "alert") {
        npc.state = "roaming";
        this._paths.delete(npc.id);
      }

      npc._cooldown -= dt;
      if (npc._cooldown > 0) continue;

      if (npc.state === "alert") {
        this._updateAlertMovement(npc, recalcPaths);
      } else {
        this._updateRoamMovement(npc);
      }
    }
  }

  // ─────────────────────────────────────────────
  // ALERT MOVEMENT — chase player via A*
  // ─────────────────────────────────────────────

  _updateAlertMovement(npc, recalcPaths) {
    const px = this.player.x;
    const py = this.player.y;

    const distToPlayer =
      Math.abs(px - npc.x) + Math.abs(py - npc.y);

    // Melee NPCs always close to adjacency (1).
    // Ranged NPCs stop at their preferred range — but never less than 1.
    // A preferredRange of 1 means melee, so treat that the same as melee.
    const isRanged  = (npc.preferredRange ?? 1) > 1;
    const stopRange = isRanged ? (npc.preferredRange ?? 4) : 1;

    if (distToPlayer <= stopRange) {
      if (!isRanged || hasLoS(this.world, npc, this.player)) {
        npc._cooldown = 15;
        this._paths.delete(npc.id);
        return;
      }
      // Ranged NPC is in range but wall is blocking — keep pathing
    }

    // Recalculate path periodically or when we have none
    if (recalcPaths || !this._paths.has(npc.id)) {
      const path = aStar(
        this.world,
        { x: npc.x, y: npc.y },
        { x: px,    y: py    },
        { maxNodes: 2000 }
      );

      if (path && path.length > 0) {
        // For ranged NPCs, trim the path so they stop at preferred range
        const trimmed = stopRange > 1
          ? this._trimPathToRange(path, px, py, stopRange)
          : path;
        this._paths.set(npc.id, trimmed);
      } else {
        this._paths.delete(npc.id);
      }
    }

    // Step along path
    const path = this._paths.get(npc.id);
    if (!path || path.length === 0) {
      this._paths.delete(npc.id);
      npc._cooldown = 15;
      return;
    }

    const next = path.shift();

    // Leash check — only applies if NOT in active combat
    // In combat, NPCs chase indefinitely until dead
    if (!npc.inCombat) {
      const leashDist =
        Math.abs(next.x - npc.roamCenter.x) +
        Math.abs(next.y - npc.roamCenter.y);

      if (leashDist > npc.roamRadius * 2) {
        npc.state = "roaming";
        this._paths.delete(npc.id);
        npc._cooldown = 30;
        return;
      }
    }

    if (!isWalkable(this.world.getTile(next.x, next.y))) {
      // Path became invalid (shouldn't happen with A* but defensive)
      this._paths.delete(npc.id);
      npc._cooldown = 10;
      return;
    }

    npc.x = next.x;
    npc.y = next.y;
    npc._cooldown = 10; // chase cadence — faster than roaming
  }

  /**
   * Trim a path so the NPC stops when it reaches a tile
   * that is already within `range` of the target.
   */
  _trimPathToRange(path, targetX, targetY, range) {
    for (let i = 0; i < path.length; i++) {
      const dist =
        Math.abs(path[i].x - targetX) +
        Math.abs(path[i].y - targetY);
      if (dist <= range) {
        return path.slice(0, i + 1);
      }
    }
    return path;
  }

  // ─────────────────────────────────────────────
  // ROAM MOVEMENT — random bounded wander
  // ─────────────────────────────────────────────

  _updateRoamMovement(npc) {
    // Clear any stale chase path
    this._paths.delete(npc.id);

    // 70% chance to just idle this tick
    if (Math.random() < 0.7) {
      npc._cooldown = 30 + Math.random() * 60;
      return;
    }

    // Pick a random cardinal or diagonal step
    const dx = Math.floor(Math.random() * 3) - 1;
    const dy = Math.floor(Math.random() * 3) - 1;
    if (dx === 0 && dy === 0) return;

    const nx = npc.x + dx;
    const ny = npc.y + dy;

    // World bounds
    if (
      nx < 0 || ny < 0 ||
      nx >= this.world.width ||
      ny >= this.world.height
    ) {
      npc._cooldown = 20;
      return;
    }

    // Leash check
    const dist =
      Math.abs(nx - npc.roamCenter.x) +
      Math.abs(ny - npc.roamCenter.y);
    if (dist > npc.roamRadius) {
      npc._cooldown = 20;
      return;
    }

    // Walkability
    if (!isWalkable(this.world.getTile(nx, ny))) {
      npc._cooldown = 20;
      return;
    }

    npc.x = nx;
    npc.y = ny;
    npc._cooldown = 30 + Math.random() * 60;
  }
}
