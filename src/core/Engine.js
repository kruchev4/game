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
import { SpawnSystem }         from "../systems/SpawnSystem.js";
import { TownSystem }          from "../systems/TownSystem.js";
import { TownWorldProvider }   from "../adapters/TownWorldProvider.js";
import { CombatLog }           from "../ui/CombatLog.js";
import { DeathScreen }         from "../ui/DeathScreen.js";
import { LootWindow }          from "../ui/LootWindow.js";
import { InventoryWindow }     from "../ui/InventoryWindow.js";
import { LevelUpWindow }       from "../ui/LevelUpWindow.js";
import { InnWindow }           from "../ui/InnWindow.js";
import { ShopWindow }          from "../ui/ShopWindow.js";
import { TownNPCWindow }       from "../ui/TownNPCWindow.js";
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
    this.spawnSystem      = null;
    this.townSystem       = null;
    this._inventoryWindow = null;
    this._lootWindow      = null;
    this._levelUpWindow   = null;
    this._townNPCWindow   = null;

    // World transition state
    this._currentWorldId  = null;
    this._returnStack     = []; // [{ worldId, x, y }] — stack for nested transitions
    this._respawnPoint    = null; // { worldId, x, y } — set by inn

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
    const [abilitiesRes, classesRes, itemsRes, lootRes, skillsRes, spawnRes] = await Promise.all([
      fetch("./src/data/abilities.json"),
      fetch("./src/data/classes.json"),
      fetch("./src/data/items.json"),
      fetch("./src/data/loot.json"),
      fetch("./src/data/skills.json"),
      fetch("./src/data/spawnGroups.json").catch(() => null)
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
    this._spawnData  = spawnRes?.ok ? await spawnRes.json()
                     : { spawnGroups: [], randomEncounters: { enabled: false } };

    if (!spawnRes?.ok) {
      console.warn("[Engine] spawnGroups.json not found — no world spawns loaded");
    }
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
    this._characterData  = character;
    this._currentWorldId = worldId;

    await Promise.all([
      this._loadData(),
      this._loadWorldFromProvider(worldId)
    ]);

    this._spawnPlayer();
    this._buildSystems();
    this._initSpawnSystem();
    this._bindInput();
  }

  /**
   * Transition to a new world (town, dungeon, or back to overworld).
   * @param {object} opts
   * @param {string}  opts.targetWorld  - world/town id to load
   * @param {number}  opts.targetX      - player spawn X in target world
   * @param {number}  opts.targetY      - player spawn Y in target world
   * @param {string}  [opts.returnWorld]- world to return to on exit
   * @param {number}  [opts.returnX]    - return position X
   * @param {number}  [opts.returnY]    - return position Y
   */
  async transition({ targetWorld, targetX, targetY, returnWorld, returnX, returnY }) {
    // Save return position if provided
    if (returnWorld) {
      this._returnStack.push({ worldId: returnWorld, x: returnX, y: returnY });
    }

    // Close any open windows
    this._lootWindow?.hide();
    this._townNPCWindow?.hide();
    this._inventoryWindow?.hide();
    this.townSystem = null;

    // Save current game state before leaving
    await this._autoSave();

    // Determine provider — towns use TownWorldProvider, overworld uses original
    const isTown = targetWorld.startsWith("town_");
    if (isTown) {
      const provider = new TownWorldProvider();
      this.world = await provider.load(targetWorld);
    } else {
      this.world = await this.worldProvider.load(targetWorld);
    }

    this._currentWorldId = targetWorld;

    // Move player to target position
    const { x, y } = findNearestWalkable(this.world, targetX, targetY);
    this.player.x = x;
    this.player.y = y;
    this.player.moveTarget = null;
    this.player.movePath   = null;

    // Reset systems for new world
    this.npcs     = [];
    this.entities = [this.player];

    this._buildSystems();

    if (isTown) {
      this._initTownSystem();
    } else {
      this._initSpawnSystem();
    }

    // Re-center camera
    this.renderer.camera.centerOn(x, y, this.world);
  }

  /** Return to the previous world (pop from return stack) */
  async _exitTown(exit) {
    let returnDest = this._returnStack.pop();

    // Fall back to exit data if stack is empty
    if (!returnDest) {
      returnDest = {
        worldId: exit.targetWorld ?? "overworld_C",
        x:       exit.targetX    ?? 120,
        y:       exit.targetY    ?? 88
      };
    }

    await this.transition({
      targetWorld: returnDest.worldId,
      targetX:     returnDest.x,
      targetY:     returnDest.y
    });
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
      this.player.hp    = classDef.baseStats.hp;
      this.player.maxHp = classDef.baseStats.hp;

      this.player.stats = stats;

      // Restore inventory from save data
      this.player.fromSaveData(char);

      // Ensure learnedSkills is seeded from starting abilities so
      // _rebuildAbilityBar doesn't filter them out on first skill pick.
      // Starting abilities begin at rank 1 if not already in learnedSkills.
      if (!this.player.learnedSkills) this.player.learnedSkills = {};
      for (const abilityId of this.player.abilities) {
        if (this.player.learnedSkills[abilityId] === undefined) {
          this.player.learnedSkills[abilityId] = 1;
        }
      }

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
   * Initialise the spawn system and populate the world with NPCs.
   * Called after _buildSystems so the NPC perception/movement systems
   * already have references — we add NPCs to this.npcs after the fact.
   */
  _initTownSystem() {
    this.townSystem = new TownSystem({
      townData: this.world,
      world:    this.world,
      player:   this.player,
      onInteract: (npc) => this._onNPCInteract(npc),
      onExit:     (exit) => this._exitTown(exit)
    });

    // Add friendly NPCs to entities for rendering
    for (const npc of this.townSystem.npcs) {
      this.entities.push(npc);
    }
  }

  _onNPCInteract(npc) {
    // Close any existing NPC window
    this._townNPCWindow?.hide();

    if (npc.role === "inn") {
      const win = new InnWindow({
        npc,
        player:   this.player,
        townData: this.world
      });
      win.onRest = () => {
        // Restore HP and resource
        this.player.hp       = this.player.maxHp;
        this.player.resource = this.player.maxResource;

        // Set respawn point to this town
        this._respawnPoint = {
          worldId: this.world.id,
          x:       this.world.entryPoint?.x ?? this.player.x,
          y:       this.world.entryPoint?.y ?? this.player.y
        };

        this.combatLog?.push({ text: `Rested at ${npc.innName}. Respawn point set.`, type: "system" });
      };
      win.show();

    } else if (npc.role === "shop") {
      const win = new ShopWindow({
        npc,
        player:     this.player,
        townData:   this.world,
        itemDefs:   this._itemDefs,
        lootSystem: this.lootSystem
      });
      win.show();

    } else {
      const win = new TownNPCWindow({ npc });
      this._townNPCWindow = win;
      win.show();
    }
  }

  async _autoSave() {
    if (!this.saveProvider || !this.saveSlot) return;
    try {
      await this.saveProvider.save(this.saveSlot, this.getSaveData());
    } catch (e) {
      console.warn("[Engine] Auto-save failed:", e.message);
    }
  }

  _initSpawnSystem() {
    this.spawnSystem = new SpawnSystem({
      world:     this.world,
      spawnData: this._spawnData,
      classes:   this._classes,
      player:    this.player,
      onSpawn:   (npc) => {
        this.npcs.push(npc);
        this.entities.push(npc);
        // Also register with live systems
        this.npcPerceptionSystem?.npcs.push(npc);
        this.npcMovementSystem?.npcs.push(npc);
        this.npcAISystem?.npcs.push(npc);
        this.combatSystem?.npcs.push(npc);
        this.lootSystem  // lootSystem reads this.npcs directly via Engine reference
      },
      onDespawn: (npc) => {
        this.npcs     = this.npcs.filter(n => n.id !== npc.id);
        this.entities = this.entities.filter(e => e.id !== npc.id);
        this.npcPerceptionSystem.npcs = this.npcs;
        this.npcMovementSystem.npcs   = this.npcs;
        this.npcAISystem.npcs         = this.npcs;
        this.combatSystem.npcs        = this.npcs;
      }
    });

    this.spawnSystem.spawnAll();
  }

  // ─────────────────────────────────────────────
  // SYSTEM WIRING
  // ─────────────────────────────────────────────

  _buildSystems() {
    const { world, player, npcs, renderer } = this;

    // Start with just the player — SpawnSystem adds NPCs via onSpawn
    this.entities = [player];

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

      // Town portal click — check world town positions
      if (!this.townSystem && this.world?.type !== "town") {
        const towns = this.world?._raw?.towns ?? this.world?.towns ?? [];
        const clickedTown = towns.find(t =>
          Math.abs(t.x - worldTile.x) <= 1 && Math.abs(t.y - worldTile.y) <= 1
        );
        if (clickedTown) {
          const townId = "town_" + clickedTown.name.toLowerCase().replace(/\s+/g, "_");
          this.transition({
            targetWorld:  townId,
            targetX:      20,
            targetY:      27,
            returnWorld:  this._currentWorldId,
            returnX:      clickedTown.x,
            returnY:      clickedTown.y
          }).catch(err => {
            console.warn(`[Engine] Town ${townId} not found:`, err.message);
          });
          return;
        }
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
        // Notify spawn system for respawn tracking
        this.spawnSystem?.onNPCDied(event.target);
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

  async _respawn() {
    const p = this.player;

    p.hp       = p.maxHp;
    p.resource = p.maxResource;
    p.dead     = false;
    p.inCombat = false;
    p.moveTarget = null;
    p.movePath   = null;

    // Respawn at inn if set, otherwise world spawn
    if (this._respawnPoint && this._respawnPoint.worldId !== this._currentWorldId) {
      await this.transition({
        targetWorld: this._respawnPoint.worldId,
        targetX:     this._respawnPoint.x,
        targetY:     this._respawnPoint.y
      });
    } else {
      const rx = this._respawnPoint?.x ?? this._spawnX;
      const ry = this._respawnPoint?.y ?? this._spawnY;
      const { x, y } = findNearestWalkable(this.world, rx, ry);
      p.x = x;
      p.y = y;
    }

    this._playerDead = false;
    this._deathScreen = null;

    // Reset all NPCs
    for (const npc of this.npcs) {
      npc.state    = "roaming";
      npc.inCombat = false;
    }
    this.combatSystem?.reset?.();
    this.renderer.camera.centerOn(p.x, p.y, this.world);
    this.combatLog?.push({ text: "You have returned.", type: "system" });
  }
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
      this.spawnSystem?.update();               // 7. respawns + random encounters
      this.townSystem?.update();                // 8. town NPC wander + exit check
      this._tickPlayerResource();               // 9. mana regen / rage decay
    }

    this.combatLog?.update();                   // 6. always age log messages

    if (this.player) {
      this.renderer.camera.centerOn(this.player.x, this.player.y, this.world);
    }

    this.renderer.render(this.world, this.entities);
    requestAnimationFrame(() => this.loop());
  }
}
