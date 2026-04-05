export class NPC {
  /**
   * @param {object} opts
   * @param {string}  opts.id           - unique id e.g. "goblin_melee_1"
   * @param {string}  opts.classId      - key into classes.json e.g. "goblinMelee"
   * @param {number}  opts.x
   * @param {number}  opts.y
   * @param {object}  opts.roamCenter   - { x, y }
   * @param {number}  [opts.roamRadius] - default 6
   * @param {object}  [opts.classDef]   - resolved class definition (injected by Engine)
   */
  constructor({ id, classId = "goblinMelee", x, y, roamCenter, roamRadius = 6, classDef = null }) {
    this.id      = id;
    this.classId = classId;
    this.type    = "npc";

    this.x = x;
    this.y = y;

    this.roamCenter  = roamCenter;
    this.roamRadius  = roamRadius;

    // ── Perception / AI state ──
    this.state            = "roaming"; // "roaming" | "alert"
    this.perceptionRadius = classDef?.perceptionRadius ?? 5;
    this.faction          = "hostile";

    // ── Chase state (used by NPCMovementSystem) ──
    this.chaseSteps    = 0;
    this.maxChaseSteps = 3;
    this._cooldown     = 0;

    // ── Combat stats (pulled from classDef if provided) ──
    const stats         = classDef?.baseStats ?? {};
    this.hp             = stats.hp              ?? 30;
    this.maxHp          = this.hp;
    this.actionSpeed    = classDef?.actionSpeed  ?? 70;
    this.actionTimer    = this.actionSpeed;
    this.actionReady    = false;
    this.abilities      = classDef?.abilities    ?? [];
    this.preferredRange = classDef?.preferredRange ?? 1;

    // ── Rendering ──
    this.color = classDef?.color ?? "#cc3333";

    // ── Runtime flags ──
    this.inCombat      = false;
    this.dead          = false;
    this._queuedAction = null;
  }
}
