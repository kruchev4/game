import { Entity } from "./Entity.js";

const BAG_SIZE    = 24; // 3 rows of 8
const QUICK_SLOTS = 4;  // slots 5-8

export class Player extends Entity {
  constructor({ x, y } = {}) {
    super({ x, y });

    this.id   = "player";
    this.type = "player";
    this.name = "Hero";

    // ── Combat stats ──
    this.hp          = 80;
    this.maxHp       = 80;
    this.actionSpeed = 60;
    this.actionTimer = 60;
    this.actionReady = false;
    this.classId     = null;
    this.abilities   = [];
    this.stats       = {};
    this.icon        = "🧙"; // overwritten by Engine._spawnPlayer from classDef     // rolled stats { STR, DEX, INT, CON, WIS, CHA }
    this.xp          = 0;
    this.level       = 1;

    // ── Resource (mana/rage — class dependent) ──
    this.resource    = 0;
    this.maxResource = 0;
    this.resourceDef = null;

    // ── Economy ──
    this.gold = 50;  // start with 50gp

    // ── Inventory ──
    // Bag: 24 slots, each null or { itemId, qty }
    this.bag = new Array(BAG_SIZE).fill(null);

    // Equipment slots — null or itemId string
    this.equipment = {
      head:     null,
      chest:    null,
      legs:     null,
      boots:    null,
      mainhand: null,
      offhand:  null,
      ring1:    null,
      ring2:    null,
      necklace: null,
    };

    // Quick slots: 4 slots (keybinds 5-8), each null or itemId string
    // Points to an itemId in the bag — item is consumed from bag on use
    this.quickSlots = new Array(QUICK_SLOTS).fill(null);

    // ── Cooldowns (written by CombatSystem) ──
    this.abilityCooldowns = {};

    // ── Flags ──
    this.inCombat = false;
    this.dead     = false;

    // ── Movement (written by MovementSystem) ──
    this.moveTarget = null;
    this.movePath   = null;
  }

  /**
   * Serialize for save data.
   * Called by Engine.getSaveData().
   */
  toSaveData() {
    return {
      gold:          this.gold,
      xp:            this.xp,
      level:         this.level,
      bag:           this.bag,
      equipment:     this.equipment,
      quickSlots:    this.quickSlots,
      learnedSkills: this.learnedSkills ?? {},
      abilities:     this.abilities ?? [],
    };
  }

  fromSaveData(data) {
    if (!data) return;
    this.gold          = data.gold          ?? 50;
    this.xp            = data.xp            ?? 0;
    this.level         = data.level         ?? 1;
    this.bag           = data.bag           ?? new Array(BAG_SIZE).fill(null);
    this.equipment     = data.equipment     ?? this.equipment;
    this.quickSlots    = data.quickSlots    ?? new Array(QUICK_SLOTS).fill(null);
    this.learnedSkills = data.learnedSkills ?? {};
    if (data.abilities?.length) this.abilities = data.abilities;

    while (this.bag.length < BAG_SIZE) this.bag.push(null);
    this.bag = this.bag.slice(0, BAG_SIZE);
    while (this.quickSlots.length < QUICK_SLOTS) this.quickSlots.push(null);
    this.quickSlots = this.quickSlots.slice(0, QUICK_SLOTS);
  }
}
