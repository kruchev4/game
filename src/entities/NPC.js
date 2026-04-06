export class NPC {
  constructor({ id, classId = "goblinMelee", x, y, roamCenter, roamRadius = 6, classDef = null }) {
    this.id      = id;
    this.classId = classId;
    this.type    = "npc";

    this.x = x;
    this.y = y;

    this.roamCenter = roamCenter;
    this.roamRadius = roamRadius;

    // ── Perception / AI state ──
    this.state            = "roaming";
    this.perceptionRadius = classDef?.perceptionRadius ?? 5;
    this.faction          = "hostile";

    // ── Chase state ──
    this.chaseSteps    = 0;
    this.maxChaseSteps = 3;
    this._cooldown     = 0;

    // ── Combat stats ──
    const stats         = classDef?.baseStats ?? {};
    this.hp             = stats.hp              ?? 30;
    this.maxHp          = this.hp;
    this.actionSpeed    = classDef?.actionSpeed  ?? 70;
    this.actionTimer    = this.actionSpeed;
    this.actionReady    = false;
    this.abilities      = classDef?.abilities    ?? [];
    this.preferredRange = classDef?.preferredRange ?? 1;
    this.level          = classDef?.level         ?? 1;
    this.xpValue        = classDef?.xpValue       ?? 20;

    // Cooldown state — populated by CombatSystem._tickCooldowns()
    // Structure: { abilityId -> { remaining: number, max: number } }
    this.abilityCooldowns = {};

    // ── Rendering ──
    this.color          = classDef?.color  ?? "#cc3333";
    this.icon           = classDef?.icon   ?? "👾";

    // ── Runtime flags ──
    this.inCombat      = false;
    this.dead          = false;
    this._queuedAction = null;
  }
}
