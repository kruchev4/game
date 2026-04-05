import { Player }              from "../core/Player.js";
import { NPC }                 from "../entities/NPC.js";
import { MovementSystem }      from "../systems/MovementSystem.js";
import { ClickToMoveSystem }   from "../systems/ClickToMoveSystem.js";
import { NPCMovementSystem }   from "../systems/NPCMovementSystem.js";
import { NPCPerceptionSystem } from "../systems/NPCPerceptionSystem.js";
import { NPCAISystem }         from "../systems/NPCAISystem.js";
import { CombatSystem }        from "../systems/CombatSystem.js";
import { LootSystem }          from "../systems/LootSystem.js";
import { XPSystem }            from "../systems/XPSystem.js";
import { CombatLog }           from "../ui/CombatLog.js";
import { DeathScreen }         from "../ui/DeathScreen.js";
import { LootWindow }          from "../ui/LootWindow.js";
import { InventoryWindow }     from "../ui/InventoryWindow.js";
import { LevelUpWindow }       from "../ui/LevelUpWindow.js";
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

    this._abilities   = null;
    this._classes     = null;
    this._lootTables  = null;
    this._itemDefs    = null;
    this._skills      = null;

    this._currentTarget  = null;
    this.combatLog       = null;
    this._deathScreen    = null;

    this.lootSystem       = null;
    this.xpSystem         = null;
    this._inventoryWindow = null;
    this._lootWindow      = null;
    this._levelUpWindow   = null;

    // Save system
    this.saveSlot     = null;
    this.saveProvider = null;

    this.onQuitToTitle = null;

    // Fallback class for testing only — overridden by character data
    this._playerClassId = null;
  }

  // ─────────────────────────────────────────────
  // DATA LOADING
  // ─────────────────────────────────────────────

  async _loadData() {
    const [abilitiesRes, classesRes, itemsRes, lootRes, skillsRes] = await Promise.all([
      fetch("./src/data/abilities.json"),
      fetch("./src/data/classes.json"),
      fetch("./src/data/items.json"),
      fetch("./src/data/loot.json"),
      fetch("./src/data/skills.json")
    ]);
    if (!abilitiesRes.ok) throw new Error("Failed to load abilities.json");
    if (!classesRes.ok)   throw new Error("Failed to load classes.json");
    if (!itemsRes.ok)     throw new Error("Failed to load items.json");
    if (!lootRes.ok)      throw new Error("Failed to load loot.json");
    if (!skillsRes.ok)    throw new Error("Failed to load skills.json");

    this._abilities  = await abilitiesRes.json();
    this._classes    = await classesRes.json();
    this._itemDefs   = await itemsRes.json();
    this._lootTables = await lootRes.json();
    this._skills     = await skillsRes.json();
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

      // Restore inventory from save data
      this.player.fromSaveData(char);

      // Sync ability bar from restored learnedSkills / abilities
      // (deferred until after _buildSystems sets up renderer)
      this._pendingSyncAbilityBar = true;

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

    // Loot system
    this.lootSystem = new LootSystem({
      player,
      lootTables: this._lootTables,
      itemDefs:   this._itemDefs,
      onCorpseSpawn:  (corpse) => {
        this.entities.push(corpse);
      },
      onCorpseRemove: (corpse) => {
        this.entities = this.entities.filter(e => e.id !== corpse.id);
        if (this._lootWindow?.corpse?.id === corpse.id) {
          this._lootWindow.hide();
          this._lootWindow = null;
        }
      },
      onEvent: (e) => this._onLootEvent(e)
    });

    // XP system
    this.xpSystem = new XPSystem({
      player,
      skills:  this._skills,
      onEvent: (e) => this._onXPEvent(e)
    });

    // Level-up window
    const classSkills = this._skills[this._playerClassId] ?? [];
    this._levelUpWindow = new LevelUpWindow({
      player,
      classSkills,
      xpSystem: this.xpSystem
    });
    this._levelUpWindow.onConfirm = (skillId, replaceId, statDist) => {
      this.xpSystem.applySkillPick(skillId, replaceId);
      this.xpSystem.applyStatPoints(statDist);
      // Refresh ability bar in renderer
      this._syncAbilityBar();
    };

    // Push player abilities and item defs to renderer for HUD
    const classDef = this._classes[this._playerClassId];
    renderer.playerAbilities = (classDef?.abilities ?? [])
      .map(id => this._abilities[id])
      .filter(Boolean);
    renderer.abilities     = this._abilities;
    renderer.itemDefs      = this._itemDefs;
    renderer.currentTarget = null;
    renderer.player        = player;

    this.combatLog     = new CombatLog();
    renderer.combatLog = this.combatLog;

    // Inventory window (created once, shown/hidden)
    this._inventoryWindow = new InventoryWindow({
      player,
      lootSystem: this.lootSystem,
      itemDefs:   this._itemDefs
    });

    renderer.camera.centerOn(player.x, player.y, world);

    // Sync ability bar now that renderer and skills are ready
    if (this._pendingSyncAbilityBar) {
      this._pendingSyncAbilityBar = false;
      this._syncAbilityBar();
    }
  }

  // ─────────────────────────────────────────────
  // INPUT BINDING
  // ─────────────────────────────────────────────

  _bindInput() {
    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();

      // Ability slots 1-4
      const slot = parseInt(e.key) - 1;
      if (slot >= 0 && slot <= 3) { this._useAbilitySlot(slot); return; }

      // Quick slots 5-8
      if (slot >= 4 && slot <= 7) { this.lootSystem?.useQuickSlot(slot - 4); return; }

      // Inventory toggle
      if (key === "i") { this._inventoryWindow?.toggle(); return; }
    });

    // Canvas click — ability bar, corpse clicks, bag icon
    this.renderer.canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;

      const rect   = this.renderer.canvas.getBoundingClientRect();
      const scaleX = this.renderer.canvas.width  / rect.width;
      const scaleY = this.renderer.canvas.height / rect.height;
      const px     = (e.clientX - rect.left) * scaleX;
      const py     = (e.clientY - rect.top)  * scaleY;

      // Ability bar slot click
      const abilitySlot = this.renderer.getAbilitySlotAt(px, py);
      if (abilitySlot >= 0) { this._useAbilitySlot(abilitySlot); return; }

      // Quick slot click
      const quickSlot = this.renderer.getQuickSlotAt(px, py);
      if (quickSlot >= 0) { this.lootSystem?.useQuickSlot(quickSlot); return; }

      // Bag icon click
      if (this.renderer.getBagIconHit(px, py)) {
        this._inventoryWindow?.toggle();
        return;
      }

      // Corpse click — world tile check
      const worldTile = this.renderer.camera.screenToWorld(px, py);
      const corpse = this.lootSystem?.corpses.find(
        c => c.x === worldTile.x && c.y === worldTile.y
      );
      if (corpse) {
        this._openLootWindow(corpse);
        return;
      }
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
        // Spawn loot corpse
        this.lootSystem?.onNPCKilled(event.target);
        // Award XP
        if (event.attacker.id === "player") {
          this.xpSystem?.awardKillXP(event.target);
        }
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
  // LOOT
  // ─────────────────────────────────────────────

  _openLootWindow(corpse) {
    this._lootWindow?.hide();
    this._lootWindow = new LootWindow({
      corpse,
      lootSystem: this.lootSystem,
      itemDefs:   this._itemDefs
    });
    this._lootWindow.onClose = () => { this._lootWindow = null; };
    this._lootWindow.show();
  }

  _onLootEvent(event) {
    const log = this.combatLog;
    switch (event.type) {
      case "loot_gold":
        log?.push({ text: `You loot ${event.amount} gold.`, type: "system" });
        break;
      case "item_used":
        if (event.healed)   log?.push({ text: `${event.item.name}: restored ${event.healed} HP.`, type: "system" });
        if (event.restored) log?.push({ text: `${event.item.name}: restored ${event.restored} resource.`, type: "system" });
        this._inventoryWindow?.refresh();
        break;
      case "item_equipped":
        log?.push({ text: `Equipped: ${event.item.name}`, type: "system" });
        this._inventoryWindow?.refresh();
        break;
      case "item_unequipped":
        log?.push({ text: `Unequipped ${event.slot}.`, type: "system" });
        this._inventoryWindow?.refresh();
        break;
      case "bag_full":
        log?.push({ text: "Bag is full!", type: "miss" });
        break;
    }
  }

  // ─────────────────────────────────────────────
  // XP & LEVELING
  // ─────────────────────────────────────────────

  _onXPEvent(event) {
    const log = this.combatLog;
    switch (event.type) {
      case "xp_gained":
        log?.push({ text: `+${event.amount} XP`, type: "system" });
        break;
      case "level_up":
        log?.push({ text: `⬆ Level ${event.level}! HP restored.`, type: "kill" });
        if (event.isSpecial) {
          // Small delay so combat log shows first
          setTimeout(() => {
            this._levelUpWindow?.show(event.level);
          }, 800);
        }
        break;
      case "skill_learned":
        log?.push({ text: `Learned: ${event.skillId}`, type: "system" });
        this._syncAbilityBar();
        break;
      case "skill_upgraded":
        log?.push({ text: `${event.skillId} upgraded to Rank ${event.rank}!`, type: "system" });
        this._syncAbilityBar();
        break;
      case "stats_updated":
        // Renderer reads from player.stats directly — no action needed
        break;
    }
  }

  /** Sync renderer ability bar after skill changes */
  _syncAbilityBar() {
    const classSkills = this._skills?.[this._playerClassId] ?? [];
    const skillMap    = Object.fromEntries(classSkills.map(s => [s.id, s]));

    // Build ability defs from player's current abilities list
    this.renderer.playerAbilities = (this.player.abilities ?? [])
      .map(id => skillMap[id] ?? this._abilities?.[id])
      .filter(Boolean);
  }

  // ─────────────────────────────────────────────
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
      name:          this.player.name          ?? "Hero",
      classId:       this.player.classId       ?? this._playerClassId,
      stats:         this.player.stats         ?? {},
      position: {
        worldId: this.world?.id ?? "overworld_C",
        x:       this.player.x,
        y:       this.player.y
      },
      gold:          this.player.gold          ?? 0,
      xp:            this.player.xp            ?? 0,
      level:         this.player.level         ?? 1,
      bag:           this.player.bag           ?? [],
      equipment:     this.player.equipment     ?? {},
      quickSlots:    this.player.quickSlots    ?? [],
      learnedSkills: this.player.learnedSkills ?? {},
      abilities:     this.player.abilities     ?? [],
      inventory:     []
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
      this.lootSystem?.update();                // 6. tick corpses
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
