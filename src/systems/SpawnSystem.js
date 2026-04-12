/**
 * SpawnSystem.js
 *
 * Reads spawnGroups and randomEncounters from the world's spawn data.
 * Responsibilities:
 *   - Spawn NPCs from defined groups on world load
 *   - Track which NPCs belong to which group
 *   - Respawn dead NPCs after respawnSeconds
 *   - Roll random encounters periodically near the player
 *
 * Design rules:
 *   - Never spawns on non-walkable tiles (uses findNearestWalkable)
 *   - Safe zones (tier 0) get no spawns
 *   - Random encounters despawn if player moves too far away
 *   - All spawned NPCs are added via onSpawn callback (Engine manages entity list)
 */

import { NPC }                from "../entities/NPC.js";
import { findNearestWalkable} from "../world/findNearestWalkable.js";

const TICKS_PER_SECOND = 60;
const SAFE_RADIUS      = 15; // tiles around capitol with no random encounters

export class SpawnSystem {
  /**
   * @param {object}   opts
   * @param {object}   opts.world         - world with getTile(x,y), width, height
   * @param {object}   opts.spawnData     - parsed spawnGroups.json
   * @param {object}   opts.classes       - parsed classes.json
   * @param {object}   opts.player        - player entity
   * @param {Function} opts.onSpawn       - (npc) => {} — add NPC to world
   * @param {Function} opts.onDespawn     - (npc) => {} — remove NPC from world
   */
  constructor({ world, spawnData, classes, player, onSpawn, onDespawn }) {
    this.world     = world;
    this.spawnData = spawnData;
    this.classes   = classes;
    this.player    = player;
    this.onSpawn   = onSpawn   ?? (() => {});
    this.onDespawn = onDespawn ?? (() => {});

    // Map of groupId → { group def, active NPCs[], respawnQueue[] }
    this._groups  = new Map();
    // Random encounter NPCs tracked separately
    this._randoms = [];

    this._randomTick = 0;
    this._idCounter  = 1;

    // Capitol position — read from world data or default to center
    const cap = world.capitol ?? { x: Math.floor(world.width / 2), y: Math.floor(world.height / 2) };
    this._capitolX = cap.x;
    this._capitolY = cap.y;
  }

  // ─────────────────────────────────────────────
  // INITIALISATION
  // ─────────────────────────────────────────────

  /**
   * Spawn all defined groups. Call once after world loads.
   */
  spawnAll() {
    const groups = this.spawnData?.spawnGroups ?? [];
    for (const group of groups) {
      if (group.safe) continue; // skip safe zones
      this._groups.set(group.id, {
        def:          group,
        activeNPCs:   [],
        respawnQueue: [] // [{ npcDef, readyAtTick }]
      });
      this._spawnGroup(group.id);
    }
  }

  // ─────────────────────────────────────────────
  // UPDATE — called once per frame
  // ─────────────────────────────────────────────

  update(dt = 1) {
    this._tickRespawns(dt);
    this._tickRandomEncounters(dt);
    this._tickRandomDespawns();
  }

  // ─────────────────────────────────────────────
  // NPC DEATH — call when an NPC from a group dies
  // ─────────────────────────────────────────────

  onNPCDied(npc) {
    const groupId = npc._spawnGroupId;
    if (!groupId) return; // random encounter or untracked

    const entry = this._groups.get(groupId);
    if (!entry) return;

    // Remove from active list
    entry.activeNPCs = entry.activeNPCs.filter(n => n.id !== npc.id);

    // Queue respawn
    const respawnTicks = (entry.def.respawnSeconds ?? 300) * TICKS_PER_SECOND;
    entry.respawnQueue.push({
      classId:      npc.classId,
      readyAtTick:  this._tick + respawnTicks,
      centerX:      entry.def.centerX,
      centerY:      entry.def.centerY,
      radius:       entry.def.radius
    });
  }

  // ─────────────────────────────────────────────
  // PRIVATE — GROUP SPAWNING
  // ─────────────────────────────────────────────

  _spawnGroup(groupId) {
    const entry = this._groups.get(groupId);
    if (!entry) return;

    const { def } = entry;

    for (const npcDef of (def.npcs ?? [])) {
      for (let i = 0; i < (npcDef.count ?? 1); i++) {
        const npc = this._spawnNPC(
          npcDef.classId,
          def.centerX,
          def.centerY,
          def.radius,
          groupId
        );
        if (npc) entry.activeNPCs.push(npc);
      }
    }
  }

  _spawnNPC(classId, centerX, centerY, radius, groupId = null) {
    const classDef = this.classes[classId];
    if (!classDef) {
      console.warn(`[SpawnSystem] Unknown classId: ${classId}`);
      return null;
    }

    // Pick random position within radius
    const angle  = Math.random() * Math.PI * 2;
    const dist   = Math.random() * radius;
    const tryX   = Math.round(centerX + Math.cos(angle) * dist);
    const tryY   = Math.round(centerY + Math.sin(angle) * dist);

    // Clamp to world bounds
    const clampedX = Math.max(0, Math.min(this.world.width  - 1, tryX));
    const clampedY = Math.max(0, Math.min(this.world.height - 1, tryY));

    // Find nearest walkable
    let pos;
    try {
      pos = findNearestWalkable(this.world, clampedX, clampedY, 8);
    } catch {
      return null; // no walkable tile nearby — skip
    }

    const id  = `${classId}_${groupId ?? "random"}_${this._idCounter++}`;
    const npc = new NPC({
      id,
      classId,
      classDef,
      x:          pos.x,
      y:          pos.y,
      roamCenter: { x: pos.x, y: pos.y },
      roamRadius: classDef.roamRadius ?? 6
    });

    npc._spawnGroupId = groupId;
    npc._spawnCenter  = { x: centerX, y: centerY };

    this.onSpawn(npc);
    return npc;
  }

  // ─────────────────────────────────────────────
  // PRIVATE — RESPAWN
  // ─────────────────────────────────────────────

  _tick = 0;

  _tickRespawns(dt) {
    this._tick += dt;

    for (const [groupId, entry] of this._groups) {
      const ready = [];
      const waiting = [];

      for (const item of entry.respawnQueue) {
        if (this._tick >= item.readyAtTick) {
          ready.push(item);
        } else {
          waiting.push(item);
        }
      }

      entry.respawnQueue = waiting;

      for (const item of ready) {
        const npc = this._spawnNPC(
          item.classId,
          item.centerX,
          item.centerY,
          item.radius ?? 6,
          groupId
        );
        if (npc) entry.activeNPCs.push(npc);
      }
    }
  }

  // ─────────────────────────────────────────────
  // PRIVATE — RANDOM ENCOUNTERS
  // ─────────────────────────────────────────────

  _tickRandomEncounters(dt) {
    const re = this.spawnData?.randomEncounters;
    if (!re?.enabled) return;

    this._randomTick += dt;
    const interval = re.checkIntervalTicks ?? 600;
    if (this._randomTick < interval) return;
    this._randomTick = 0;

    const maxActive = re.maxActiveRandom ?? 6;
    if (this._randoms.length >= maxActive) return;

    // Don't spawn random encounters in safe zone
    const distFromCapitol = Math.abs(this.player.x - this._capitolX) +
                            Math.abs(this.player.y - this._capitolY);
    if (distFromCapitol < SAFE_RADIUS) return;

    // Find which tier the player is in
    const tiers = re.tiers ?? [];
    const tier  = tiers.find(t =>
      distFromCapitol >= t.distanceMin &&
      distFromCapitol <  t.distanceMax
    );

    if (!tier) return;
    if (Math.random() > tier.spawnChance) return;

    // Spawn encounter NPCs near player
    const spawnedThisEncounter = [];
    for (const npcDef of (tier.npcs ?? [])) {
      for (let i = 0; i < (npcDef.count ?? 1); i++) {
        const npc = this._spawnNPC(
          npcDef.classId,
          this.player.x,
          this.player.y,
          12,      // spawn within 12 tiles of player
          null     // no group — random encounter
        );
        if (npc) {
          npc._isRandomEncounter = true;
          npc._encounterSpawnTick = this._tick;
          this._randoms.push(npc);
          spawnedThisEncounter.push(npc);
        }
      }
    }

    if (spawnedThisEncounter.length > 0) {
      console.log(`[SpawnSystem] Random encounter! ${spawnedThisEncounter.length} NPCs near player (tier ${tier.tier})`);
    }
  }

  _tickRandomDespawns() {
    // Despawn random encounter NPCs that are dead
    const toRemove = this._randoms.filter(n => n.dead);
    for (const npc of toRemove) {
      this._randoms = this._randoms.filter(n => n.id !== npc.id);
    }
  }

  // ─────────────────────────────────────────────
  // ACCESSORS
  // ─────────────────────────────────────────────

  /** All currently active NPCs across all groups + randoms */
  get allNPCs() {
    const npcs = [];
    for (const entry of this._groups.values()) {
      npcs.push(...entry.activeNPCs.filter(n => !n.dead));
    }
    npcs.push(...this._randoms.filter(n => !n.dead));
    return npcs;
  }
}
