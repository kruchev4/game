import { Player }              from "../core/Player.js";
import { NPC }                 from "../entities/NPC.js";
import { MovementSystem }      from "../systems/MovementSystem.js";
import { ClickToMoveSystem }   from "../systems/ClickToMoveSystem.js";
import { NPCMovementSystem }   from "../systems/NPCMovementSystem.js";
import { NPCPerceptionSystem } from "../systems/NPCPerceptionSystem.js";
import { NPCAISystem }         from "../systems/NPCAISystem.js";
import { CombatSystem }        from "../systems/CombatSystem.js";
import { CombatLog }           from "../ui/CombatLog.js";
import { DeathScreen }         from "../ui/DeathScreen.js";
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
    this.npcAISystem         = null;
    this.combatSystem        = null;

    this.running = false;

    this._abilities     = null;
    this._classes       = null;
    this._currentTarget = null;
    this.combatLog      = null;
    this._deathScreen   = null;

    // Save system — set by main.js before loadWorld()
    this.saveSlot     = null;
    this.saveProvider = null;

    // Called by main.js — fires when player quits to title after death
    this.onQuitToTitle = null;

    // Fallback class for testing only — overridden by character data
    this._playerClassId = null;
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

  /**
   * @param {string} worldId
   * @param {{ name: string, classId: string, stats: object }} [character]
   *   If omitted, falls back to this._playerClassId for testing.
   */
  async loadWorld(worldId, character = null) {
    // Store character data before loading (data load reads classes)
    this._characterData = character;

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

    // Use confirmed character data if available, else fall back to test class
    const char     = this._characterData;
    const classId  = char?.classId ?? this._playerClassId;
    const classDef = this._classes[classId];

    if (classDef) {
      this.player.name        = char?.name ?? "Hero";
      this.player.classId     = classId;
      this.player.abilities   = classDef.abilities ?? [];
      this.player.actionSpeed = classDef.actionSpeed;
      this.player.actionTimer = classDef.actionSpeed;

      // If rolled stats provided, use them; otherwise use class base stats
      const stats = char?.stats ?? classDef.baseStats;
      this.player.hp    = classDef.baseStats.hp; // HP always from class
      this.player.maxHp = classDef.baseStats.hp;

      // Store rolled stats for future use (skills, checks, etc.)
      this.player.stats = stats;

      // Resource
      const res = classDef.resource ?? null;
      if (res) {
        this.player.resourceDef  = res;
        this.player.maxResource  = res.max;
        this.player.resource     = res.startAt ?? res.max;
      }
    }

    // Update test class fallback to match
    this._playerClassId = classId;
  }

  /**
   * Spawn test NPCs on guaranteed walkable tiles near player spawn.
   * Each NPC offset is passed through findNearestWalkable so they
   * never land on mountains, water, or void.
   */
  _spawnTestNPCs() {
    const bx = this._spawnX;
    const by = this._spawnY;

    const spawn = (classId, offsetX, offsetY) => {
      const classDef = this._classes[classId];
      const { x, y } = findNearestWalkable(
        this.world,
        bx + offsetX,
        by + offsetY
      );
      return new NPC({
        id:         `${classId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        classId,
        classDef,
        x,
        y,
        roamCenter: { x, y },
        roamRadius: classDef?.roamRadius ?? 6
      });
    };

    this.npcs     = [
      spawn("goblinMelee",  6,  0),   // melee goblin — nearby
      spawn("goblinArcher", 10, -3)   // ranged goblin — further back
    ];
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
      onTarget:       (npc) => this._setTarget(npc)
    });

    this.combatSystem = new CombatSystem({
      world,
      player,
      npcs,
      abilities: this._abilities,
      onEvent:   (e) => this._onCombatEvent(e)
    });

    // AI system wired to combatSystem so it can queue actions
    this.npcAISystem = new NPCAISystem({
      player,
      npcs,
      abilities:    this._abilities,
      combatSystem: this.combatSystem
    });

    // Push player abilities to renderer for HUD
    const classDef = this._classes[this._playerClassId];
    renderer.playerAbilities = (classDef?.abilities ?? [])
      .map(id => this._abilities[id])
      .filter(Boolean);
    renderer.abilities     = this._abilities;
    renderer.currentTarget = null;
    renderer.player        = player; // needed for cooldown ring reads

    this.combatLog         = new CombatLog();
    renderer.combatLog     = this.combatLog;

    renderer.camera.centerOn(player.x, player.y, world);
  }

  // ─────────────────────────────────────────────
  // INPUT BINDING
  // ─────────────────────────────────────────────

  _bindInput() {
    // Keybinds 1–4
    window.addEventListener("keydown", (e) => {
      const slot = parseInt(e.key) - 1;
      if (slot >= 0 && slot <= 3) this._useAbilitySlot(slot);
    });

    // Ability bar clicks
    this.renderer.canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;

      const rect   = this.renderer.canvas.getBoundingClientRect();
      const scaleX = this.renderer.canvas.width  / rect.width;
      const scaleY = this.renderer.canvas.height / rect.height;
      const px     = (e.clientX - rect.left) * scaleX;
      const py     = (e.clientY - rect.top)  * scaleY;

      const slot = this.renderer.getAbilitySlotAt(px, py);
      if (slot >= 0) this._useAbilitySlot(slot);
    });
  }

  // ─────────────────────────────────────────────
  // TARGETING
  // ─────────────────────────────────────────────

  _setTarget(npc) {
    this._currentTarget          = npc;
    this.renderer.currentTarget  = npc;
    console.log(npc ? `[Target] ${npc.id}` : "[Target] cleared");
  }

  // ─────────────────────────────────────────────
  // ABILITY FIRING
  // ─────────────────────────────────────────────

  _useAbilitySlot(slotIndex) {
    const classDef  = this._classes[this._playerClassId];
    if (!classDef) return;

    const abilityId = classDef.abilities[slotIndex];
    if (!abilityId) return;

    const target = this._currentTarget;
    if (!target || target.dead) {
      console.log("[Combat] No valid target");
      return;
    }

    this.combatSystem.queuePlayerAction(abilityId, target.id);
  }

  // ─────────────────────────────────────────────
  // COMBAT EVENTS
  // ─────────────────────────────────────────────

  _onCombatEvent(event) {
    const log = this.combatLog;

    switch (event.type) {
      case "engage": {
        const who = event.entity.id === "player" ? "You" : this._npcLabel(event.entity);
        log?.push({ text: `${who} entered combat`, type: "system" });
        break;
      }
      case "disengage": {
        const who = event.entity.id === "player" ? "You" : this._npcLabel(event.entity);
        log?.push({ text: `${who} left combat`, type: "system" });
        break;
      }
      case "hit": {
        const isPlayer = event.attacker.id === "player";
        if (isPlayer) {
          log?.push({
            text: `${event.ability.name} hits ${this._npcLabel(event.target)} for ${event.damage}`,
            type: "damage_out"
          });
          // Rage builds on damage dealt
          const def = this.player.resourceDef;
          if (def?.type === "rage" && def.buildOnHitDealt) {
            this.player.resource = Math.min(
              this.player.maxResource,
              this.player.resource + def.buildOnHitDealt
            );
          }
        } else {
          log?.push({
            text: `${this._npcLabel(event.attacker)} hits you for ${event.damage}`,
            type: "damage_in"
          });
          // Rage builds on damage taken
          const def = this.player.resourceDef;
          if (def?.type === "rage" && def.buildOnHitTaken) {
            this.player.resource = Math.min(
              this.player.maxResource,
              this.player.resource + def.buildOnHitTaken
            );
          }
        }
        break;
      }
      case "out_of_range":
        log?.push({
          text: `${event.ability.name} — out of range or LoS blocked`,
          type: "miss"
        });
        break;
      case "on_cooldown":
        log?.push({
          text: `${event.ability.name} is not ready yet`,
          type: "miss"
        });
        break;
      case "kill": {
        const killer = event.attacker.id === "player" ? "You" : this._npcLabel(event.attacker);
        const victim = this._npcLabel(event.target);
        log?.push({ text: `${killer} killed ${victim}!`, type: "kill" });
        this.entities = this.entities.filter(e => e.id !== event.target.id);
        this.npcs     = this.npcs.filter(n => n.id !== event.target.id);
        if (this._currentTarget?.id === event.target.id) this._setTarget(null);
        break;
      }
      case "player_death": {
        const killerName = this._npcLabel(event.attacker);
        log?.push({ text: `You were slain by ${killerName}!`, type: "damage_in" });
        this._onPlayerDeath(killerName);
        break;
      }
      case "combat_end":
        log?.push({ text: "All enemies defeated.", type: "system" });
        break;
      case "effect_applied":
        log?.push({
          text: `${event.effect.type} applied to ${event.entity.id === "player" ? "you" : this._npcLabel(event.entity)}`,
          type: "effect"
        });
        break;
      case "effect_expired":
        log?.push({
          text: `${event.effect.type} wore off`,
          type: "effect"
        });
        break;
    }
  }

  /** Format an NPC id into a readable label e.g. "Goblin Warrior" */
  _npcLabel(entity) {
    return (entity.classId ?? entity.id)
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .trim()
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  // ─────────────────────────────────────────────
  // DEATH & RESPAWN
  // ─────────────────────────────────────────────

  _onPlayerDeath(killerName) {
    // Pause the world — stop combat and movement from ticking
    this._playerDead = true;

    // Calculate penalties
    const goldLost = Math.floor((this.player.gold ?? 0) * 0.25);
    const xpLost   = Math.floor((this.player.xp   ?? 0) * 0.20);

    // Apply penalties immediately
    this.player.gold = Math.max(0, (this.player.gold ?? 0) - goldLost);
    this.player.xp   = Math.max(0, (this.player.xp   ?? 0) - xpLost);

    // Show death screen on top of the frozen game canvas
    const deathScreen = new DeathScreen({
      canvas:     this.renderer.canvas,
      killerName,
      goldLost,
      xpLost
    });

    deathScreen.onRespawn = () => {
      this._respawn();
    };

    deathScreen.onQuit = () => {
      this.running = false;
      this.onQuitToTitle?.();
    };

    this._deathScreen = deathScreen;
    deathScreen.show();
  }

  _respawn() {
    const p = this.player;

    // Restore to full HP and resource
    p.hp       = p.maxHp;
    p.resource = p.maxResource;
    p.dead     = false;
    p.inCombat = false;

    // Move to world center (nearest walkable)
    const cx = Math.floor(this.world.width  / 2);
    const cy = Math.floor(this.world.height / 2);
    const { x, y } = findNearestWalkable(this.world, cx, cy);
    p.x = x;
    p.y = y;

    // Reset all NPCs back to roaming — fresh start
    for (const npc of this.npcs) {
      npc.state      = "roaming";
      npc.chaseSteps = 0;
      npc._cooldown  = 0;
      npc.inCombat   = false;
      npc._queuedAction = null;
    }

    // Clear combat state entirely
    this.combatSystem.combatants.clear();
    this.combatSystem._actionTimers.clear();
    this.combatSystem._cooldowns.clear();
    this.combatSystem._effects.clear();
    this.combatSystem._playerAction = null;

    // Clear target
    this._setTarget(null);
    this.movementSystem?.clearTarget();

    // Snap camera to respawn point
    this.renderer.camera.centerOn(x, y, this.world);

    // Resume world
    this._playerDead = false;

    this.combatLog?.push({ text: "You have been returned to the land of the living.", type: "system" });

    // Auto-save after respawn (penalties saved)
    this.saveToSlot();
  }

  // ─────────────────────────────────────────────
  // RESOURCE
  // ─────────────────────────────────────────────

  _tickPlayerResource() {
    const p   = this.player;
    const def = p?.resourceDef;
    if (!def) return;

    if (def.regenPerTick && def.regenPerTick > 0) {
      p.resource = Math.min(p.maxResource, p.resource + def.regenPerTick);
    }

    // Rage decays slowly out of combat
    if (def.type === "rage" && !p.inCombat) {
      p.resource = Math.max(0, p.resource - 0.3);
    }
  }

  // ─────────────────────────────────────────────
  // SAVE SYSTEM
  // ─────────────────────────────────────────────

  /**
   * Build a save data object from current game state.
   * Called on zone change.
   */
  getSaveData() {
    return {
      name:      this.player.name     ?? "Hero",
      classId:   this.player.classId  ?? this._playerClassId,
      stats:     this.player.stats    ?? {},
      position: {
        worldId: this.world?.id ?? "overworld_C",
        x:       this.player.x,
        y:       this.player.y
      },
      gold:      this.player.gold      ?? 0,
      inventory: this.player.inventory ?? []
    };
  }

  /**
   * Persist current state to the assigned save slot.
   * Silent — errors are logged but not thrown.
   */
  async saveToSlot() {
    if (!this.saveProvider || !this.saveSlot) return;
    try {
      await this.saveProvider.save(this.saveSlot, this.getSaveData());
      this.combatLog?.push({ text: "Game saved.", type: "system" });
    } catch (e) {
      console.error("[Engine] Save failed:", e);
    }
  }

  /**
   * Call this when the player transitions to a new zone.
   * Triggers auto-save and loads the new world.
   */
  async changeZone(worldId) {
    await this.saveToSlot();
    await this._loadWorldFromProvider(worldId);
    this._spawnTestNPCs();
    this._buildSystems();
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

    if (!this._playerDead) {
      this.npcPerceptionSystem?.update();       // 1. awareness
      this.npcMovementSystem?.update();         // 2. NPC movement (A*)
      this.combatSystem?.update();              // 3. timers + resolution
      this.npcAISystem?.update(this.world);     // 4. NPC decides actions
      this.movementSystem?.update();            // 5. player movement
      this._tickPlayerResource();               // 7. mana regen / rage decay
    }

    this.combatLog?.update();                   // 6. always age log messages

    if (this.player) {
      this.renderer.camera.centerOn(this.player.x, this.player.y, this.world);
    }

    this.renderer.render(this.world, this.entities);
    requestAnimationFrame(() => this.loop());
  }
}
