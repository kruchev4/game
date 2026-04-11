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
import { MultiplayerSystem }   from "../systems/MultiplayerSystem.js";
import { AnimationSystem }     from "../systems/AnimationSystem.js";
import { EffectSystem }        from "../systems/EffectSystem.js";
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
    this.multiplayerSystem = null;
    this.animSystem        = null;
    this.effectSystem      = null;
    this._inventoryWindow = null;
    this._lootWindow      = null;
    this._levelUpWindow   = null;
    this._townNPCWindow   = null;

    // World transition state
    this._currentWorldId  = null;
    this._returnStack     = []; // [{ worldId, x, y }] — stack for nested transitions
    this._respawnPoint    = null; // { worldId, x, y } — set by inn
    this._autoSaveTick    = 0;     // frames since last autosave
    this._autoSaveInterval = 18000; // ~5 min at 60fps

    // Save system
    this.saveSlot     = null;
    this.saveProvider = null;
    this.serverUrl    = null;  // set by main.js before loadWorld

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

    // Determine provider — towns/dungeons use TownWorldProvider, overworld uses original
    const isTown    = targetWorld.startsWith("town_");
    const isDungeon = !isTown && !targetWorld.startsWith("overworld_");
    if (isTown || isDungeon) {
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

    // Reset systems for new world — clear all NPCs and combat state
    this.npcs     = [];
    this.entities = [this.player];
    this._setTarget(null);
    this.combatSystem?.combatants?.clear();
    this.player.inCombat = false;
    this.player.dead     = false;

    this._buildSystems();

    if (isTown) {
      this._initTownSystem();
    } else if (this.world.type === "dungeon") {
      this._initDungeonSpawns();
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
    const char = this._characterData;

    // Use saved position if available and in the same world, else spawn at center
    let spawnX, spawnY;
    if (char?.position?.x && char?.position?.worldId === this._currentWorldId) {
      try {
        const safe = findNearestWalkable(this.world, char.position.x, char.position.y, 3);
        spawnX = safe.x;
        spawnY = safe.y;
      } catch {
        const center = findNearestWalkable(this.world, cx, cy);
        spawnX = center.x;
        spawnY = center.y;
      }
    } else {
      const center = findNearestWalkable(this.world, cx, cy);
      spawnX = center.x;
      spawnY = center.y;
    }

    this.player = new Player({ x: spawnX, y: spawnY });
    this._spawnX = spawnX;
    this._spawnY = spawnY;

    // Use confirmed character data if available, else fall back to test class
    const classId  = char?.classId ?? this._playerClassId;
    const classDef = this._classes[classId];

    if (classDef) {
      this.player.name        = char?.name ?? "Hero";
      this.player.classId     = classId;
      this.player.icon        = classDef.icon ?? "🧙";
      this.player.abilities   = classDef.abilities ?? [];
      this.player.actionSpeed = classDef.actionSpeed;
      this.player.actionTimer = classDef.actionSpeed;

      // Stats and HP — use saved HP if available, else class base
      const stats = char?.stats ?? classDef.baseStats;
      this.player.maxHp = classDef.baseStats.hp;
      this.player.hp    = char?.hp ?? classDef.baseStats.hp;
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
  _initDungeonSpawns() {
    const world = this.world;

    // Reuse TownSystem for exit detection (dungeons have same exits[] format)
    this.townSystem = new TownSystem({
      townData: world,
      world,
      player:   this.player,
      onInteract: () => {},
      onExit:   (exit) => this._exitTown(exit)
    });

    if (!world.spawnGroups?.length) return;
    for (const group of world.spawnGroups) {
      for (const monDef of (group.monsters ?? [])) {
        const classDef = this._classes[monDef.classId];
        if (!classDef) {
          console.warn(`[Engine] Unknown dungeon classId: ${monDef.classId}`);
          continue;
        }

        let pos;
        try {
          pos = findNearestWalkable(world, monDef.x, monDef.y, 3);
        } catch {
          continue;
        }

        const npc = new NPC({
          id:         `${monDef.classId}_${pos.x}_${pos.y}`,
          classId:    monDef.classId,
          classDef,
          x:          pos.x,
          y:          pos.y,
          roamCenter: { x: pos.x, y: pos.y },
          roamRadius: classDef.roamRadius ?? 3
        });

        this.npcs.push(npc);
        this.entities.push(npc);
        this.npcPerceptionSystem?.npcs.push(npc);
        this.npcMovementSystem?.npcs.push(npc);
        this.npcAISystem?.npcs.push(npc);
        this.combatSystem?.npcs.push(npc);
      }
    }

    // Spawn boss if defined
    const boss = world.boss;
    if (boss) {
      const classDef = this._classes[boss.classId];
      if (classDef) {
        let pos;
        try { pos = findNearestWalkable(world, boss.x, boss.y, 3); }
        catch { pos = { x: boss.x, y: boss.y }; }

        const bossNPC = new NPC({
          id:         `boss_${boss.classId}`,
          classId:    boss.classId,
          classDef:   { ...classDef, icon: boss.icon ?? classDef.icon },
          x:          pos.x,
          y:          pos.y,
          roamCenter: { x: pos.x, y: pos.y },
          roamRadius: 2
        });
        bossNPC.isBoss = true;
        bossNPC.name   = boss.name ?? classDef.name;

        this.npcs.push(bossNPC);
        this.entities.push(bossNPC);
        this.npcPerceptionSystem?.npcs.push(bossNPC);
        this.npcMovementSystem?.npcs.push(bossNPC);
        this.npcAISystem?.npcs.push(bossNPC);
        this.combatSystem?.npcs.push(bossNPC);
      }
    }

    console.log(`[Engine] Dungeon spawned: ${this.npcs.length} monsters`);
  }

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
        // Register with multiplayer server for HP tracking
        this.multiplayerSystem?.registerNPC(npc);
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
      onTarget:       (npc) => this._setTarget(npc),
      isBlocked:      (wx, wy) => {
        // Town NPC click
        if (this.townSystem?.npcs.some(n => n.x === wx && n.y === wy)) return true;
        // Corpse click
        if (this.lootSystem?.corpses.some(c => c.x === wx && c.y === wy)) return true;
        // Town marker on overworld
        if (!this.townSystem && this.world?.type !== "town") {
          const towns = this.world?.towns ?? [];
          if (towns.some(t => Math.abs(t.x - wx) <= 1 && Math.abs(t.y - wy) <= 1)) return true;
        }
        return false;
      }
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

    // Animation system
    this.animSystem          = new AnimationSystem();
    renderer.animSystem      = this.animSystem;

    // Effect system
    this.effectSystem = new EffectSystem({
      player,
      npcs,
      onEvent: (e) => this._onEffectEvent(e)
    });
    renderer.effectSystem = this.effectSystem;

    // Sync ability bar now that renderer and skills are ready
    if (this._pendingSyncAbilityBar) {
      this._pendingSyncAbilityBar = false;
      this._syncAbilityBar();
    }

    // Start multiplayer presence — wrapped so any error doesn't block rendering
    try {
      this._initMultiplayer();
    } catch (e) {
      console.warn("[Engine] Multiplayer init failed, continuing without:", e.message);
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

      // Manual save — F5
      if (e.key === "F5") {
        e.preventDefault();
        this.saveToSlot();
        return;
      }
    });

    // Scroll wheel zoom
    this.renderer.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta  = e.deltaY > 0 ? -this.renderer.camera.zoomStep : this.renderer.camera.zoomStep;
      const anchor = this.renderer.camera.screenToWorld(e.offsetX, e.offsetY);
      this.renderer.camera.zoom(delta, anchor.x, anchor.y, this.renderer);
      // Re-center clamp after zoom so camera doesn't drift outside world
      if (this.world) {
        this.renderer.camera.centerOn(this.player.x, this.player.y, this.world);
      }
    }, { passive: false });

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

      // Convert screen to world tile — used by all remaining checks
      const worldTile = this.renderer.camera.screenToWorld(px, py);

      // Town NPC click — must be before move/corpse so NPCs intercept the click
      if (this.townSystem) {
        const hit = this.townSystem.handleClick(worldTile.x, worldTile.y);
        console.log(`[Engine] Town click at ${worldTile.x},${worldTile.y} — hit: ${hit}, NPCs: ${this.townSystem.npcs.length}`);
        if (hit) return;
      }

      // Town portal click — overworld only
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

        // Dungeon portal click
        const portals = this.world?._raw?.portals ?? this.world?.portals ?? [];
        const clickedPortal = portals.find(p =>
          Math.abs(p.x - worldTile.x) <= 1 && Math.abs(p.y - worldTile.y) <= 1
        );
        if (clickedPortal) {
          this.transition({
            targetWorld: clickedPortal.campaignId,
            targetX:     15,
            targetY:     36,
            returnWorld: this._currentWorldId,
            returnX:     clickedPortal.x,
            returnY:     clickedPortal.y
          }).catch(err => {
            console.warn(`[Engine] Dungeon ${clickedPortal.campaignId} not found:`, err.message);
          });
          return;
        }
      }

      // NPC click — target the NPC
      const clickedNPC = this.npcs.find(n =>
        !n.dead &&
        Math.abs(n.x - worldTile.x) <= 1 &&
        Math.abs(n.y - worldTile.y) <= 1
      );
      if (clickedNPC) {
        this._setTarget(clickedNPC);
        return;
      }

      // Corpse click
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
    const classDef = this._classes[this._playerClassId];
    if (!classDef) return;

    const abilityId = classDef.abilities?.[slotIndex];
    if (!abilityId) return;

    const ability = this._abilities[abilityId];
    if (!ability) return;

    const target = this._currentTarget;

    // Self-targeted abilities (buffs, heals) don't need a target
    if (ability.type === "self") {
      this._resolveSpecialAbility({ ability, attacker: this.player, target: this.player });
      if (ability.selfEffect) {
        this.effectSystem?.apply(this.player, ability.selfEffect.effect, "player", {
          duration:  ability.selfEffect.duration,
          magnitude: ability.selfEffect.magnitude
        });
      }
      this.combatSystem?._startCooldown?.("player", abilityId);
      return;
    }

    if (!target || target.dead) {
      this.combatLog?.push({ text: "No target.", type: "system" });
      return;
    }

    // In multiplayer — send to server, server resolves damage and broadcasts result
    if (this.multiplayerSystem?._connected) {
      // Calculate local damage roll for the server to validate
      const base     = ability.damage?.base ?? 0;
      const variance = ability.damage?.variance ?? 0;
      const damage   = base + Math.floor(Math.random() * (variance + 1));

      // Apply outgoing damage multiplier from effects
      const mult         = this.effectSystem?.getDamageMultiplier("player") ?? 1;
      const finalDamage  = Math.round(damage * mult);

      this.multiplayerSystem.sendAttack({ npcId: target.id, damage: finalDamage, abilityId });

      // Apply onHit effects locally (visual/client side)
      if (ability.onHit) {
        this.effectSystem?.apply(target, ability.onHit.effect, "player", {
          duration:  ability.onHit.duration,
          magnitude: ability.onHit.magnitude
        });
      }

      // Animations
      this.animSystem?.playAttack("player", target.x - this.player.x, target.y - this.player.y);
      this.animSystem?.playHit(target.id);
      if (ability.type === "ranged") {
        if (this.player.classId === "ranger") {
          this.animSystem?.spawnArrow(this.player.x, this.player.y, target.x, target.y);
        } else if (this.player.classId === "paladin") {
          this.animSystem?.spawnHolyBolt(this.player.x, this.player.y, target.x, target.y);
        }
      }

      // Special ability handling
      if (ability.special) {
        this._resolveSpecialAbility({ ability, attacker: this.player, target });
      }

      // Start local cooldown so bar reflects state
      this.combatSystem?.startCooldown("player", abilityId);
      return;
    }

    // Single player — queue through local combat system
    this.combatSystem.queuePlayerAction(abilityId, target.id);
  }

  // ─────────────────────────────────────────────
  // COMBAT EVENTS
  // ─────────────────────────────────────────────

  _onCombatEvent(event) {
    // Forward hit events to multiplayer server
    if (event.type === "hit" && event.target?.type === "npc") {
      this.multiplayerSystem?.sendAttack({
        npcId:    event.target.id,
        damage:   event.damage,
        abilityId: event.abilityId
      });
      this.multiplayerSystem?.broadcastState();
    }

    // Apply onHit effects from ability
    if (event.type === "hit" && event.ability?.onHit) {
      const fx = event.ability.onHit;
      this.effectSystem?.apply(event.target, fx.effect, event.attacker.id, {
        duration:  fx.duration,
        magnitude: fx.magnitude
      });
    }

    // Apply selfEffect from ability (buffs on the caster)
    if ((event.type === "hit" || event.type === "self_effect") && event.ability?.selfEffect) {
      const fx = event.ability.selfEffect;
      this.effectSystem?.apply(this.player, fx.effect, "player", {
        duration:  fx.duration,
        magnitude: fx.magnitude
      });
    }

    // Handle special abilities
    if (event.type === "hit" && event.ability?.special) {
      this._resolveSpecialAbility(event);
    }

    // Trigger animations
    if (event.type === "hit") {
      if (event.attacker && event.target) {
        const dx = event.target.x - event.attacker.x;
        const dy = event.target.y - event.attacker.y;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        this.animSystem?.playAttack(event.attacker.id, dx/len, dy/len);
      }
      this.animSystem?.playHit(event.target?.id);

      // Projectiles for ranged abilities
      if (event.ability?.type === "ranged" && event.attacker && event.target) {
        if (event.attacker.classId === "ranger" || event.attacker.classId === "paladin") {
          const isHoly = event.attacker.classId === "paladin";
          if (isHoly) {
            this.animSystem?.spawnHolyBolt(event.attacker.x, event.attacker.y, event.target.x, event.target.y);
          } else {
            this.animSystem?.spawnArrow(event.attacker.x, event.attacker.y, event.target.x, event.target.y);
          }
        }
      }
    }

    if (event.type === "heal") {
      this.animSystem?.playHeal(event.target?.id ?? "player");
    }

    if (event.type === "aoe") {
      // AOE visual
      this.animSystem?.spawnAOE({
        x:      this.player.x,
        y:      this.player.y,
        radius: event.ability?.aoe?.radius ?? 3,
        color:  event.ability?.id?.includes("holy") || event.ability?.id?.includes("consec")
          ? "rgba(255,220,50,0.4)"
          : "rgba(255,100,0,0.4)"
      });
      // Send all AOE hits to server in multiplayer
      if (this.multiplayerSystem?._connected) {
        this.multiplayerSystem.broadcastState();
      }
    }

    if (event.type === "buff" && event.ability?.id === "divine_shield") {
      this.player.invulnerable      = true;
      this.player.invulnerableTimer = event.ability.effect?.duration ?? 120;
      this.combatLog?.push({ text: "Divine Shield activated!", type: "system" });
      this.animSystem?.playHeal("player");
    }

    if (event.type === "taunt") {
      this.combatLog?.push({ text: "You taunt nearby enemies!", type: "system" });
      this.multiplayerSystem?.sendTaunt(event.ability?.range ?? 6);
    }

    if (event.type === "rez") {
      this.combatLog?.push({ text: "Resurrection — targeting fallen allies.", type: "system" });
    }
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
        // Award XP — only if not connected to multiplayer server
        // When connected, server broadcasts shared XP via onNPCKilled callback
        if (event.attacker.id === "player" && !this.multiplayerSystem?._connected) {
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
      case "heal": {
        const healTarget = event.target?.id === "player" ? "yourself" : (event.target?.name ?? "ally");
        log?.push({ text: `${event.ability?.name} restores ${event.amount} HP to ${healTarget}!`, type: "heal" });
        break;
      }
      case "aoe":
        log?.push({ text: `${event.ability?.name} hits ${event.hitCount} target${event.hitCount !== 1 ? "s" : ""}!`, type: "damage_out" });
        break;
      case "buff":
        log?.push({ text: `${event.ability?.name} activated!`, type: "system" });
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
  // MULTIPLAYER
  // ─────────────────────────────────────────────

  _initMultiplayer() {
    this.multiplayerSystem?.leave();

    const token     = localStorage.getItem("roe2_player_token") ?? this.player.id;
    const serverUrl = this.serverUrl ?? null;

    console.log(`[Engine] _initMultiplayer — serverUrl: ${serverUrl}`);

    if (!serverUrl) {
      console.log("[Engine] No server URL — multiplayer disabled");
      return;
    }

    this.multiplayerSystem = new MultiplayerSystem({
      serverUrl,
      player:      this.player,
      worldId:     this._currentWorldId,
      playerToken: token,

      onPlayerJoin: (remote) => {
        if (!this.entities.find(e => e.id === remote.id)) {
          this.entities.push(remote);
        }
        this.combatLog?.push({ text: `${remote.name} joined the world.`, type: "system" });
      },

      onPlayerLeave: (token) => {
        const id = `remote_${token}`;
        const remote = this.entities.find(e => e.id === id);
        if (remote) {
          this.entities = this.entities.filter(e => e.id !== id);
          this.combatLog?.push({ text: `${remote.name} left the world.`, type: "system" });
        }
      },

      onPlayerUpdate: (remote) => {
        // Entity updated in-place — no action needed
      },

      onNPCState: (serverNPCs) => {
        const serverIds = new Set(serverNPCs.map(n => n.id));

        // Remove NPCs no longer on server
        this.npcs     = this.npcs.filter(n => serverIds.has(n.id));
        this.entities = this.entities.filter(e => e.type !== "npc" || serverIds.has(e.id));

        for (const sNPC of serverNPCs) {
          const existing = this.npcs.find(n => n.id === sNPC.id);
          if (existing) {
            existing.x     = sNPC.x;
            existing.y     = sNPC.y;
            existing.hp    = sNPC.hp;
            existing.maxHp = sNPC.maxHp;
            existing.state = sNPC.state;
          } else {
            const classDef = this._classes[sNPC.classId] ?? {};
            const npc = new NPC({
              id:         sNPC.id,
              classId:    sNPC.classId,
              classDef:   { ...classDef, icon: sNPC.icon },
              x:          sNPC.x,
              y:          sNPC.y,
              roamCenter: { x: sNPC.x, y: sNPC.y },
              roamRadius: 0
            });
            npc.hp     = sNPC.hp;
            npc.maxHp  = sNPC.maxHp;
            npc.state  = sNPC.state;
            npc.isBoss = sNPC.isBoss;
            if (sNPC.name) npc.name = sNPC.name;
            this.npcs.push(npc);
            this.entities.push(npc);
          }
        }

        // Always keep combatSystem.npcs pointing at same array as this.npcs
        if (this.combatSystem) this.combatSystem.npcs = this.npcs;
      },

      onNPCAttackPlayer: ({ npcId, damage }) => {
        // Server says this NPC attacked us — apply damage locally
        if (this._playerDead) return;
        if (this.player.invulnerable) return; // Divine Shield active
        const player = this.player;
        player.hp = Math.max(0, player.hp - damage);
        const npc = this.npcs.find(n => n.id === npcId);
        this.combatLog?.push({
          text: `${npc?.classId ?? "Monster"} hits you for ${damage}!`,
          type: "damage"
        });
        if (player.hp <= 0) {
          this._onPlayerDeath();
        }
        // Broadcast updated HP
        this.multiplayerSystem?.broadcastState();
      },

      onNPCDamaged: ({ npcId, hp, damage, attackerName }) => {
        // Sync NPC HP from server
        const npc = this.npcs.find(n => n.id === npcId);
        if (npc) {
          npc.hp = hp;
          this.combatLog?.push({
            text: `${attackerName} hit ${npc.id} for ${damage}!`,
            type: "damage"
          });
        }
      },

      onNPCKilled: ({ npcId, killerName, xpShare, loot }) => {
        // Server confirmed NPC dead — remove from world
        const npc = this.npcs.find(n => n.id === npcId);
        if (npc && !npc.dead) {
          npc.hp   = 0;
          npc.dead = true;
          this.entities = this.entities.filter(e => e.id !== npcId);
          this.npcs     = this.npcs.filter(n => n.id !== npcId);
          if (this._currentTarget?.id === npcId) this._setTarget(null);
        }
        // Award shared XP to ALL players in the world
        if (xpShare > 0) this.xpSystem?.awardXP(xpShare);
        // Award shared gold to ALL players
        if (loot?.gold > 0) this.player.gold = (this.player.gold ?? 0) + loot.gold;
        // Combat log
        const isKiller = killerName === this.player.name;
        this.combatLog?.push({
          text: isKiller
            ? `You killed ${npcId}! +${xpShare} XP, +${loot?.gold ?? 0} gold`
            : `${killerName} killed ${npcId}! +${xpShare} XP, +${loot?.gold ?? 0} gold (shared)`,
          type: "reward"
        });
      }
    });

    try {
      this.multiplayerSystem.join();
    } catch (e) {
      console.warn("[Engine] Multiplayer join failed:", e.message);
    }
  }

  _onEffectEvent(event) {
    const log = this.combatLog;
    switch (event.type) {
      case "dot_tick": {
        const name = event.entity.id === "player" ? "You" : this._npcLabel(event.entity);
        log?.push({ text: `${name} takes ${event.damage} ${event.effect.name} damage`, type: "damage" });
        // Animate hit flash
        this.animSystem?.playHit(event.entity.id);
        break;
      }
      case "hot_tick": {
        log?.push({ text: `+${event.heal} HP (${event.effect.name})`, type: "heal" });
        this.animSystem?.playHeal(event.entity.id);
        break;
      }
      case "effect_applied": {
        const name = event.entity.id === "player" ? "You" : this._npcLabel(event.entity);
        log?.push({ text: `${name}: ${event.effect.name}`, type: "effect" });
        break;
      }
      case "effect_expired":
        // Silent expiry — no log spam
        break;
      case "kill":
        // DoT kill — handle same as combat kill
        this._onCombatEvent(event);
        break;
      case "player_death":
        this._onPlayerDeath();
        break;
    }
  }

  _resolveSpecialAbility(event) {
    const { ability, attacker, target } = event;
    switch (ability.special) {
      case "charge":
        if (attacker.id === "player" && target) {
          this.player.x = target.x + (target.x > this.player.x ? -1 : 1);
          this.player.y = target.y;
        }
        break;

      case "execute":
        if (target && target.hp <= target.maxHp * 0.25) {
          const bonus = event.damage;
          target.hp   = Math.max(0, target.hp - bonus);
          this.combatLog?.push({ text: `Execute! +${bonus} bonus damage`, type: "damage" });
        }
        break;

      case "taunt":
        this.multiplayerSystem?.sendTaunt(6);
        for (const npc of this.npcs) {
          if (npc.dead) continue;
          const dx = npc.x - this.player.x;
          const dy = npc.y - this.player.y;
          if (Math.sqrt(dx*dx + dy*dy) <= 6) npc.state = "alert";
        }
        this.combatLog?.push({ text: "All nearby enemies focus on you!", type: "system" });
        break;

      case "second_wind": {
        const heal = Math.floor(this.player.maxHp * 0.20);
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
        this.animSystem?.playHeal("player");
        this.combatLog?.push({ text: `Second Wind: +${heal} HP`, type: "heal" });
        break;
      }

      case "shadow_step":
        if (attacker.id === "player" && target) {
          const dx = this.player.x - target.x;
          const dy = this.player.y - target.y;
          const len = Math.sqrt(dx*dx + dy*dy) || 1;
          this.player.x = Math.round(target.x + dx/len);
          this.player.y = Math.round(target.y + dy/len);
        }
        break;
    }
  }

  _onXPEvent(event) {
    const log = this.combatLog;
    switch (event.type) {
      case "xp_gained":
        log?.push({ text: `+${event.amount} XP`, type: "system" });
        break;
      case "level_up":
        this.animSystem?.playLevelUp("player");
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
      this.saveToSlot().finally(() => {
        this.running = false;
        this.onQuitToTitle?.();
      });
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
      hp:            Math.ceil(this.player.hp  ?? this.player.maxHp),
      position: {
        worldId: this.world?.id ?? "overworld_C",
        x:       Math.round(this.player.x),
        y:       Math.round(this.player.y)
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
      const serverOwnsNPCs = this.multiplayerSystem?._connected;

      if (!this.townSystem && !serverOwnsNPCs) {
        // Single player / offline — full local simulation
        this.npcPerceptionSystem?.update();
        this.npcMovementSystem?.update();
        this.combatSystem?.update();
        this.npcAISystem?.update(this.world);
      } else if (!this.townSystem && serverOwnsNPCs) {
        // Multiplayer — server owns NPC movement and attacks
        if (this.combatSystem) this.combatSystem.multiplayerMode = true;
        this.combatSystem?.updatePlayerOnly();
      }

      this.movementSystem?.update();
      this.lootSystem?.update();
      if (!serverOwnsNPCs) this.spawnSystem?.update();
      this.townSystem?.update();
      this.animSystem?.update();
      this.effectSystem?.update();
      this.multiplayerSystem?.update();
      this._tickPlayerResource();

      // Divine Shield — tick invulnerability timer
      if (this.player.invulnerable) {
        this.player.invulnerableTimer = (this.player.invulnerableTimer ?? 0) - 1;
        if (this.player.invulnerableTimer <= 0) {
          this.player.invulnerable = false;
          this.combatLog?.push({ text: "Divine Shield faded.", type: "system" });
        }
      }

      this._autoSaveTick++;
      if (this._autoSaveTick >= this._autoSaveInterval) {
        this._autoSaveTick = 0;
        this.saveToSlot();
      }
    }

    this.combatLog?.update();

    if (this.player) {
      this.renderer.camera.centerOn(this.player.x, this.player.y, this.world);
    }

    // Don't render game world when death screen is active — it draws on same canvas
    if (!this._deathScreen?.active) {
      this.renderer.render(this.world, this.entities);
    }

    requestAnimationFrame(() => this.loop());
  }
}
