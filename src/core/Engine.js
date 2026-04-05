import { Player }              from "../core/Player.js";
import { NPC }                 from "../entities/NPC.js";
import { MovementSystem }      from "../systems/MovementSystem.js";
import { ClickToMoveSystem }   from "../systems/ClickToMoveSystem.js";
import { NPCMovementSystem }   from "../systems/NPCMovementSystem.js";
import { NPCPerceptionSystem } from "../systems/NPCPerceptionSystem.js";
import { CombatSystem }        from "../systems/CombatSystem.js";
import { findNearestWalkable } from "../world/findNearestWalkable.js";

export class Engine {
  constructor({ worldProvider, renderer }) {
    this.worldProvider = worldProvider;
    this.renderer      = renderer;

    this.world    = null;
    this.player   = null;
    this.npcs     = [];
    this.entities = [];

    this.movementSystem      = null;
    this.clickToMoveSystem   = null;
    this.npcMovementSystem   = null;
    this.npcPerceptionSystem = null;
    this.combatSystem        = null;

    this.running = false;

    // Data
    this._abilities = null;
    this._classes   = null;

    // Targeting state
    this._currentTarget = null;

    // Test player class — will be set at character creation later
    this._playerClassId = "ranger"; // swap to "fighter" to test melee
  }

  // ─────────────────────────────────────────────
  // DATA LOADING
  // ─────────────────────────────────────────────

  async _loadData() {
    const [abilitiesRes, classesRes] = await Promise.all([
      fetch("./src/data/abilities.json"),
      fetch("./src/data/classes.json")
    ]);
    if (!abilitiesRes.ok) throw new Error("Failed to load abilities.json");
    if (!classesRes.ok)   throw new Error("Failed to load classes.json");

    this._abilities = await abilitiesRes.json();
    this._classes   = await classesRes.json();
  }

  // ─────────────────────────────────────────────
  // WORLD LOADING
  // ─────────────────────────────────────────────

  async loadWorld(worldId) {
    await Promise.all([
      this._loadData(),
      this._loadWorldFromProvider(worldId)
    ]);

    this._spawnPlayer();
    this._spawnTestNPCs();
    this._buildSystems();
    this._bindInput();
  }

  async _loadWorldFromProvider(worldId) {
    this.world = await this.worldProvider.load(worldId);
  }

  _spawnPlayer() {
    const cx = Math.floor(this.world.width  / 2);
    const cy = Math.floor(this.world.height / 2);
    const { x, y } = findNearestWalkable(this.world, cx, cy);

    this.player = new Player({ x, y });
    this._spawnX = x;
    this._spawnY = y;

    // Give player their class abilities
    const classDef = this._classes[this._playerClassId];
    if (classDef) {
      this.player.hp          = classDef.baseStats.hp;
      this.player.maxHp       = classDef.baseStats.hp;
      this.player.actionSpeed = classDef.actionSpeed;
      this.player.actionTimer = classDef.actionSpeed;
      this.player.classId     = this._playerClassId;
      this.player.abilities   = classDef.abilities ?? [];
    }
  }

  _spawnTestNPCs() {
    const x = this._spawnX;
    const y = this._spawnY;

    const goblinMeleeDef  = this._classes["goblinMelee"];
    const goblinArcherDef = this._classes["goblinArcher"];

    const goblinWarrior = new NPC({
      id:         "goblin_warrior_1",
      classId:    "goblinMelee",
      classDef:   goblinMeleeDef,
      x:          x + 6,
      y:          y,
      roamCenter: { x: x + 6, y },
      roamRadius: goblinMeleeDef?.roamRadius ?? 6
    });

    const goblinArcher = new NPC({
      id:         "goblin_archer_1",
      classId:    "goblinArcher",
      classDef:   goblinArcherDef,
      x:          x + 10,
      y:          y - 3,
      roamCenter: { x: x + 10, y: y - 3 },
      roamRadius: goblinArcherDef?.roamRadius ?? 6
    });

    this.npcs     = [goblinWarrior, goblinArcher];
    this.entities = [this.player, ...this.npcs];
  }

  // ─────────────────────────────────────────────
  // SYSTEM WIRING
  // ─────────────────────────────────────────────

  _buildSystems() {
    const { world, player, npcs, renderer } = this;

    this.npcPerceptionSystem = new NPCPerceptionSystem({ npcs, player });

    this.npcMovementSystem = new NPCMovementSystem({ world, npcs, player });

    this.movementSystem = new MovementSystem({ world, player });

    this.clickToMoveSystem = new ClickToMoveSystem({
      canvas:         renderer.canvas,
      camera:         renderer.camera,
      world,
      movementSystem: this.movementSystem,
      npcs,
      onTarget: (npc) => this._setTarget(npc)
    });

    this.combatSystem = new CombatSystem({
      world,
      player,
      npcs,
      abilities: this._abilities,
      onEvent:   (e) => this._onCombatEvent(e)
    });

    // Push player abilities and ability data into renderer for HUD
    const classDef = this._classes[this._playerClassId];
    renderer.playerAbilities = (classDef?.abilities ?? [])
      .map(id => this._abilities[id])
      .filter(Boolean);
    renderer.abilities = this._abilities;

    // Initial camera snap
    renderer.camera.centerOn(player.x, player.y, world);
  }

  // ─────────────────────────────────────────────
  // INPUT BINDING
  // ─────────────────────────────────────────────

  _bindInput() {
    // Keybinds 1–4: fire ability in slot N against current target
    window.addEventListener("keydown", (e) => {
      const slot = parseInt(e.key) - 1; // "1" -> 0, "2" -> 1, etc.
      if (slot >= 0 && slot <= 3) {
        this._useAbilitySlot(slot);
      }
    });

    // Left click on ability bar slots
    this.renderer.canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;

      const rect   = this.renderer.canvas.getBoundingClientRect();
      const scaleX = this.renderer.canvas.width  / rect.width;
      const scaleY = this.renderer.canvas.height / rect.height;
      const px     = (e.clientX - rect.left) * scaleX;
      const py     = (e.clientY - rect.top)  * scaleY;

      const slot = this.renderer.getAbilitySlotAt(px, py);
      if (slot >= 0) {
        this._useAbilitySlot(slot);
      }
    });
  }

  // ─────────────────────────────────────────────
  // TARGETING
  // ─────────────────────────────────────────────

  _setTarget(npc) {
    this._currentTarget = npc;
    this.renderer.currentTarget = npc; // renderer reads this for HUD + highlight
    if (npc) {
      console.log(`[Target] ${npc.id} selected`);
    } else {
      console.log("[Target] cleared");
    }
  }

  // ─────────────────────────────────────────────
  // ABILITY FIRING
  // ─────────────────────────────────────────────

  _useAbilitySlot(slotIndex) {
    const classDef = this._classes[this._playerClassId];
    if (!classDef) return;

    const abilityId = classDef.abilities[slotIndex];
    if (!abilityId) return;

    const target = this._currentTarget;
    if (!target || target.dead) {
      console.log("[Combat] No valid target selected");
      return;
    }

    this.combatSystem.queuePlayerAction(abilityId, target.id);
  }

  // ─────────────────────────────────────────────
  // COMBAT EVENTS
  // ─────────────────────────────────────────────

  _onCombatEvent(event) {
    switch (event.type) {
      case "engage":
        console.log(`[Combat] ${event.entity.id} entered combat`);
        break;

      case "disengage":
        console.log(`[Combat] ${event.entity.id} left combat`);
        break;

      case "hit":
        console.log(
          `[Combat] ${event.attacker.id} hit ${event.target.id} ` +
          `with ${event.ability.name} for ${event.damage} dmg ` +
          `(${event.target.hp}/${event.target.maxHp} HP)`
        );
        break;

      case "out_of_range":
        console.log(
          `[Combat] ${event.ability.name} failed — ` +
          `${event.target.id} out of range or LoS blocked`
        );
        break;

      case "kill":
        console.log(`[Combat] ${event.target.id} killed by ${event.attacker.id}`);
        // Remove dead entity from lists so it stops rendering and being targeted
        this.entities = this.entities.filter(e => e.id !== event.target.id);
        this.npcs     = this.npcs.filter(n => n.id !== event.target.id);
        // Clear target if it was the dead NPC
        if (this._currentTarget?.id === event.target.id) {
          this._setTarget(null);
        }
        break;

      case "combat_end":
        console.log("[Combat] All enemies defeated — combat ended");
        break;

      case "effect_applied":
        console.log(
          `[Combat] ${event.effect.type} on ${event.entity.id} ` +
          `for ${event.effect.duration} ticks`
        );
        break;

      case "effect_expired":
        console.log(`[Combat] ${event.effect.type} expired on ${event.entity?.id}`);
        break;
    }
  }

  // ─────────────────────────────────────────────
  // GAME LOOP
  // ─────────────────────────────────────────────

  start() {
    if (!this.world) throw new Error("Engine started without a world");
    this.running = true;
    this.loop();
  }

  loop() {
    if (!this.running) return;

    this.npcPerceptionSystem?.update();  // 1. awareness
    this.npcMovementSystem?.update();    // 2. NPC movement
    this.combatSystem?.update();         // 3. action timers + resolution
    this.movementSystem?.update();       // 4. player movement

    if (this.player) {
      this.renderer.camera.centerOn(this.player.x, this.player.y, this.world);
    }

    this.renderer.render(this.world, this.entities);

    requestAnimationFrame(() => this.loop());
  }
}
