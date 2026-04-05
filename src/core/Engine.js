import { Player }             from "../entities/Player.js";
import { NPC }                from "../entities/NPC.js";
import { MovementSystem }     from "../systems/MovementSystem.js";
import { ClickToMoveSystem }  from "../systems/ClickToMoveSystem.js";
import { NPCMovementSystem }  from "../systems/NPCMovementSystem.js";
import { NPCPerceptionSystem} from "../systems/NPCPerceptionSystem.js";
import { CombatSystem }       from "../systems/CombatSystem.js";
import { findNearestWalkable }from "../world/findNearestWalkable.js";

export class Engine {
  constructor({ worldProvider, renderer }) {
    this.worldProvider = worldProvider;
    this.renderer      = renderer;

    this.world   = null;
    this.player  = null;
    this.npcs    = [];
    this.entities = [];

    this.movementSystem     = null;
    this.clickToMoveSystem  = null;
    this.npcMovementSystem  = null;
    this.npcPerceptionSystem = null;
    this.combatSystem       = null;

    this.running = false;

    // Loaded from data/
    this._abilities = null;
    this._classes   = null;
  }

  // ─────────────────────────────────────────────
  // DATA LOADING
  // ─────────────────────────────────────────────

  /**
   * Load abilities and classes JSON before the world.
   * These are static data files — no Supabase needed.
   */
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
    // Load data files in parallel with world fetch
    await Promise.all([
      this._loadData(),
      this._loadWorldFromProvider(worldId)
    ]);

    this._spawnPlayer();
    this._spawnTestNPCs();
    this._buildSystems();
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
  }

  /**
   * Spawn two test NPCs:
   *   1. Goblin Warrior  — melee, chases the player up close
   *   2. Goblin Archer   — ranged, hangs back and slings rocks
   *
   * Both are positioned near the player spawn for easy testing.
   */
  _spawnTestNPCs() {
    const { x, y } = { x: this._spawnX, y: this._spawnY };

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

    this.npcs    = [goblinWarrior, goblinArcher];
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
      canvas:          renderer.canvas,
      camera:          renderer.camera,
      world,
      movementSystem:  this.movementSystem
    });

    this.combatSystem = new CombatSystem({
      world,
      player,
      npcs,
      abilities: this._abilities,
      onEvent:   (e) => this._onCombatEvent(e)
    });

    // Initial camera snap
    renderer.camera.centerOn(player.x, player.y, world);
  }

  // ─────────────────────────────────────────────
  // COMBAT EVENTS
  // ─────────────────────────────────────────────

  /**
   * Central handler for all combat events.
   * Right now just logs to console — wire to CombatLog UI later.
   *
   * Event types:
   *   engage, disengage, hit, out_of_range, kill, combat_end,
   *   effect_applied, effect_expired
   */
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
          `with ${event.ability.name} for ${event.damage} damage ` +
          `(${event.target.hp}/${event.target.maxHp} HP remaining)`
        );
        break;

      case "out_of_range":
        console.log(
          `[Combat] ${event.attacker.id} tried ${event.ability.name} ` +
          `but ${event.target.id} is out of range or LoS`
        );
        break;

      case "kill":
        console.log(`[Combat] ${event.target.id} was killed by ${event.attacker.id}`);
        // Remove dead NPC from entity list so it stops rendering
        this.entities = this.entities.filter(e => e.id !== event.target.id);
        this.npcs     = this.npcs.filter(n => n.id !== event.target.id);
        break;

      case "combat_end":
        console.log("[Combat] Combat ended — all enemies defeated");
        break;

      case "effect_applied":
        console.log(
          `[Combat] ${event.effect.type} applied to ${event.entity.id} ` +
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

    // ── Update order (exactly once per frame) ──
    this.npcPerceptionSystem?.update();   // 1. awareness
    this.npcMovementSystem?.update();     // 2. NPC movement
    this.combatSystem?.update();          // 3. combat timers + resolution
    this.movementSystem?.update();        // 4. player movement

    // ── Camera follow ──
    if (this.player) {
      this.renderer.camera.centerOn(this.player.x, this.player.y, this.world);
    }

    // ── Render once ──
    this.renderer.render(this.world, this.entities);

    // ── Schedule next frame once ──
    requestAnimationFrame(() => this.loop());
  }
}
