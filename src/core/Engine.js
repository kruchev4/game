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
    // Use pre-loaded data from Supabase if available (set by main.js)
    // Fall back to local JSON files
    const [lootRes, skillsRes, spawnRes] = await Promise.all([
      fetch("./src/data/loot.json").catch(() => null),
      fetch("./src/data/skills.json"),
      fetch("./src/data/spawnGroups.json").catch(() => null)
    ]);

    // Abilities and classes come from Supabase via main.js
    if (!this._abilities) {
      const r = await fetch("./src/data/abilities.json");
      this._abilities = await r.json();
    }
    if (!this._classes) {
      const r = await fetch("./src/data/classes.json");
      this._classes = await r.json();
    }
    // Items always load from local JSON — Supabase items lack icon/onUse data
    {
      const r = await fetch("./src/data/items.json");
      this._itemDefs = r.ok ? await r.json() : {};
    }

    this._lootTables = lootRes?.ok  ? await lootRes.json()  : {};
    this._skills     = skillsRes.ok ? await skillsRes.json() : {};
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

    // Update HUD minimap with new world
    if (this.renderer._hud) {
      this.renderer._hud.setWorld(this.world);
      this.renderer._overlayWorld = null; // force overlay rebuild
    }
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

    // Reuse TownSystem for exit detection
    this.townSystem = new TownSystem({
      townData: world,
      world,
      player:   this.player,
      onInteract: () => {},
      onExit:   (exit) => this._exitTown(exit)
    });

    // Support both flat spawns[] and spawnGroups[] formats
    const spawnList = world.spawns?.length
      ? world.spawns
      : (world.spawnGroups ?? []).flatMap(g => g.monsters ?? []);

    for (const monDef of spawnList) {
      const monsterId = monDef.monsterId ?? monDef.classId;
      // Look up monster def from loaded monster data
      const monsterData = this._monsterDefs?.get?.(monsterId);
      const classDef    = monsterData
        ? {
            name:       monsterData.name,
            icon:       monsterData.icon,
            baseStats:  { hp: monsterData.hp },
            damageMin:  monsterData.damageMin,
            damageMax:  monsterData.damageMax,
            speed:      monsterData.speed,
            perception: monsterData.perception,
            attackRange:monsterData.attackRange,
            xpValue:    monsterData.xpValue,
          }
        : this._classes[monsterId];

      if (!classDef) {
        console.warn(`[Engine] Unknown dungeon monster: ${monsterId}`);
        continue;
      }

      let pos;
      try { pos = findNearestWalkable(world, monDef.x, monDef.y, 3); }
      catch { continue; }

      const npc = new NPC({
        id:         `${monsterId}_${pos.x}_${pos.y}`,
        classId:    monsterId,
        classDef:   { ...classDef, icon: monDef.icon ?? classDef.icon },
        x:          pos.x,
        y:          pos.y,
        roamCenter: { x: pos.x, y: pos.y },
        roamRadius: monDef.roamRadius ?? 3
      });
      npc.isBoss = monDef.isBoss ?? false;
      if (npc.isBoss) npc.name = monDef.name ?? classDef.name ?? monsterId;

      this.npcs.push(npc);
      this.entities.push(npc);
      this.npcPerceptionSystem?.npcs.push(npc);
      this.npcMovementSystem?.npcs.push(npc);
      this.npcAISystem?.npcs.push(npc);
      this.combatSystem?.npcs.push(npc);
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

    // If using IsoAdapter, bridge combat log to HUD
    if (renderer._hud) {
      const hud     = renderer._hud;
      const origPush = this.combatLog.push.bind(this.combatLog);
      this.combatLog.push = (entry) => {
        origPush(entry);
        hud.pushLog(entry.text, entry.type);
      };
    }

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

      // Tab — cycle through nearby targets
      if (e.key === "Tab") {
        e.preventDefault();
        this._cycleTarget();
        return;
      }

      // Escape — clear target
      if (e.key === "Escape") {
        this._setTarget(null);
        return;
      }

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
          Math.abs(t.x - worldTile.x) <= 2 && Math.abs(t.y - worldTile.y) <= 2
        );
        if (towns.length > 0) {
          console.log(`[Engine] Click at (${worldTile.x},${worldTile.y}), towns: ${towns.map(t=>`${t.name}(${t.x},${t.y})`).join(", ")}, hit: ${clickedTown?.name ?? "none"}`);
        }
        if (clickedTown) {
          const townId = "town_" + clickedTown.name.toLowerCase().replace(/\s+/g, "_");
          this.transition({
            targetWorld:  townId,
            targetX:      19,  // Millhaven north entrance
            targetY:      2,
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
          Math.abs(p.x - worldTile.x) <= 2 && Math.abs(p.y - worldTile.y) <= 2
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

      // Friendly player click — target for heals/buffs
      // Check self first, then remote players
      if (Math.abs(this.player.x - worldTile.x) <= 1 && Math.abs(this.player.y - worldTile.y) <= 1) {
        this._setTarget(this.player);
        return;
      }
      const remotePlayers = this.multiplayerSystem?.getRemotePlayers() ?? [];
      const clickedFriend = remotePlayers.find(p =>
        Math.abs(p.x - worldTile.x) <= 1 && Math.abs(p.y - worldTile.y) <= 1
      );
      if (clickedFriend) {
        this._setTarget(clickedFriend);
        return;
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

  _cycleTarget() {
    // Include town NPCs for targeting
    const townNPCs = this.townSystem?.npcs ?? [];
    const liveNPCs = [...this.npcs.filter(n => !n.dead), ...townNPCs];
    if (!liveNPCs.length) return;

    // Sort by distance from player
    const sorted = [...liveNPCs].sort((a, b) => {
      const da = Math.hypot(a.x - this.player.x, a.y - this.player.y);
      const db = Math.hypot(b.x - this.player.x, b.y - this.player.y);
      return da - db;
    });

    const currentIdx = sorted.findIndex(n => n.id === this._currentTarget?.id);
    const nextIdx    = (currentIdx + 1) % sorted.length;
    this._setTarget(sorted[nextIdx]);
  }

  _setTarget(entity) {
    this._currentTarget         = entity;
    this.renderer.currentTarget = entity;
    // Log only in debug mode to prevent console spam
    if (entity && window._roeDebug) {
      const label = entity.id === "player" ? "yourself"
        : entity.isRemote ? (entity.name ?? "ally")
        : entity.id;
      console.log(`[Target] ${label}`);
    }
  }

  // ─────────────────────────────────────────────
  // ABILITY FIRING
  // ─────────────────────────────────────────────

  _useAbilitySlot(slotIndex) {
    const classDef = this._classes[this._playerClassId];
    if (!classDef) return;

    // Use player.abilities (customised bar) — falls back to class defaults
    const abilityBar = this.player.abilities?.length
      ? this.player.abilities
      : classDef.abilities ?? [];

    const abilityId = abilityBar[slotIndex];
    if (!abilityId) return;

    const ability = this._abilities[abilityId];
    if (!ability) return;

    // ── Client-side cooldown check (UI only — server also enforces) ──
    const cd = this.combatSystem?.getCooldown?.("player", abilityId);
    if (cd?.remaining > 0) {
      this.combatLog?.push({ text: `${ability.name} is on cooldown.`, type: "system" });
      return;
    }

    // ── Mana/resource cost check ──
    const manaCost = ability.cost?.mana ?? 0;
    if (manaCost > 0) {
      const def = this.player.resourceDef;
      if (def?.type === "mana" || def?.type === "energy") {
        if ((this.player.resource ?? 0) < manaCost) {
          this.combatLog?.push({ text: `Not enough ${def.label ?? "mana"}!`, type: "system" });
          return;
        }
        this.player.resource = Math.max(0, this.player.resource - manaCost);
      }
    }

    const target = this._currentTarget;
    const type   = ability.type ?? "melee";

    // ── Multiplayer — ALL abilities go to server ──
    if (this.multiplayerSystem?._connected) {
      // Determine target for server
      let targetId   = null;
      let targetType = null;

      if (["buff", "taunt"].includes(type) || ability.aoe?.centeredOnSelf) {
        targetId = "self";
      } else if (type === "aoe") {
        targetId = "aoe";
      } else if (type === "heal") {
        targetId   = target?.isRemote ? target.playerToken : "self";
        targetType = "player";
      } else if (target) {
        targetId   = target.id;
        targetType = target.type;
      } else {
        this.combatLog?.push({ text: "No target.", type: "system" });
        return;
      }

      // Send to server — server validates range, rolls damage, applies effects
      this.multiplayerSystem.sendAbility({ abilityId, targetId, targetType });

      // Start local cooldown for UI feedback
      this.combatSystem?._startCooldown?.("player", abilityId);
      return;
    }

    // ── Single player — queue through local combat system ──
    const selfTargeted = ["buff", "taunt"].includes(type)
      || ability.aoe?.centeredOnSelf
      || (type === "aoe" && !target)
      || (type === "heal" && (!target || target.type === "player"));

    if (selfTargeted) {
      this.combatSystem.queuePlayerAction(abilityId, "player");
      return;
    }

    if (!target || target.dead) {
      this.combatLog?.push({ text: "No target.", type: "system" });
      return;
    }

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
      const abilityType = event.ability?.type ?? "melee";

      // Lunge animation — only for melee abilities at close range
      if (abilityType === "melee" && event.attacker && event.target) {
        const dx  = event.target.x - event.attacker.x;
        const dy  = event.target.y - event.attacker.y;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        this.animSystem?.playAttack(event.attacker.id, dx/len, dy/len);
      }

      // Hit flash on target always
      this.animSystem?.playHit(event.target?.id);

      // Projectiles for ranged only
      if (abilityType === "ranged" && event.attacker && event.target) {
        if (event.attacker.classId === "ranger") {
          this.animSystem?.spawnArrow(event.attacker.x, event.attacker.y, event.target.x, event.target.y);
        } else if (event.attacker.classId === "paladin") {
          this.animSystem?.spawnHolyBolt(event.attacker.x, event.attacker.y, event.target.x, event.target.y);
        } else {
          this.animSystem?.spawnSpellBolt(event.attacker.x, event.attacker.y, event.target.x, event.target.y);
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
        const t0 = performance.now();
        const serverIds = new Set(serverNPCs.map(n => n.id));

        // Build id→npc map for O(1) lookup
        const npcMap = new Map(this.npcs.map(n => [n.id, n]));

        // Remove NPCs no longer on server — only filter if something changed
        const prevCount = this.npcs.length;
        this.npcs     = this.npcs.filter(n => serverIds.has(n.id));
        if (this.npcs.length !== prevCount) {
          this.entities = this.entities.filter(e => e.type !== "npc" || serverIds.has(e.id));
        }

        for (const sNPC of serverNPCs) {
          const existing = npcMap.get(sNPC.id);
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

        const dt = performance.now() - t0;
        if (dt > 5) console.warn(`[NPC State] Slow: ${dt.toFixed(1)}ms for ${serverNPCs.length} NPCs`);
      },

      onNPCAttackPlayer: ({ npcId, damage, blocked }) => {
        console.log(`[Engine] onNPCAttackPlayer npcId=${npcId} damage=${damage} blocked=${blocked} playerDead=${this._playerDead}`);
        if (this._playerDead) return;
        if (blocked) {
          this.combatLog?.push({ text: "Attack blocked by Divine Shield!", type: "system" });
          return;
        }
        // Server is now authoritative for player HP
        // player_stat_update will set the actual HP — this just shows the log
        const npc = this.npcs.find(n => n.id === npcId);
        if (damage > 0) {
          this.combatLog?.push({
            text: `${npc?.name ?? npc?.classId ?? "Monster"} hits you for ${damage}!`,
            type: "damage"
          });
          this.animSystem?.playHit("player");
        }
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

          // Spawn loot corpse with server-provided loot
          this.lootSystem?.onNPCKilledWithLoot(npc, loot);
        }
        this.animSystem?.playDying(npcId);

        // XP and gold are applied via player_stat_update (server authoritative)
        // We only handle item drops and the combat log here

        // Item drops handled via corpse — player must click to loot
        // Gold already applied via player_stat_update

        // Combat log
        const isKiller = killerName === this.player.name;
        const goldStr  = loot?.gold > 0 ? `, +${loot.gold} gold` : "";
        const xpStr    = xpShare > 0 ? `+${xpShare} XP` : "";
        this.combatLog?.push({
          text: isKiller
            ? `You killed ${npcId}! ${xpStr}${goldStr}`
            : `${killerName} killed ${npcId}! ${xpStr}${goldStr} (shared)`,
          type: "reward"
        });
      }
    });

    // ── New server-authoritative callbacks ────────────────────────────────
    this.multiplayerSystem.onStatUpdate = ({ hp, maxHp, xp, gold, mana, maxMana }) => {
      if (hp      !== undefined && !isNaN(hp))      this.player.hp          = hp;
      if (maxHp   !== undefined && !isNaN(maxHp))   this.player.maxHp       = maxHp;
      if (xp      !== undefined && !isNaN(xp))      this.player.xp          = xp;
      if (gold    !== undefined && !isNaN(gold))     this.player.gold         = gold;
      if (mana    !== undefined && !isNaN(mana))     this.player.resource     = mana;
      if (maxMana !== undefined && !isNaN(maxMana))  this.player.maxResource  = maxMana;

      if (hp !== undefined && hp <= 0 && !this._playerDead && !this.player.invulnerable) {
        this._onPlayerDeath();
      }

      if (xp !== undefined && !isNaN(xp)) {
        this.xpSystem?._checkLevelUp?.();
      }
    };

    this.multiplayerSystem.onAbilityResult = ({ abilityId, damage, targetId, outOfRange, noMana, aoe, targetsHit, heal }) => {
      if (outOfRange) {
        this.combatLog?.push({ text: "Out of range.", type: "system" });
        return;
      }
      if (noMana) {
        const def = this.player.resourceDef;
        this.combatLog?.push({ text: `Not enough ${def?.label ?? "mana"}!`, type: "system" });
        return;
      }

      const ability = this._abilities[abilityId];
      const type    = ability?.type ?? "melee";
      const target  = this.npcs.find(n => n.id === targetId);

      // Melee — lunge animation
      if (type === "melee" && target) {
        const dx  = target.x - this.player.x;
        const dy  = target.y - this.player.y;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        this.animSystem?.playAttack("player", dx/len, dy/len);
        this.animSystem?.playHit(targetId);
      }

      // Ranged — projectile animation
      if (type === "ranged" && target) {
        if (this.player.classId === "ranger") {
          this.animSystem?.spawnArrow(this.player.x, this.player.y, target.x, target.y);
        } else if (this.player.classId === "paladin") {
          this.animSystem?.spawnHolyBolt(this.player.x, this.player.y, target.x, target.y);
        }
        this.animSystem?.playHit(targetId);
      }

      // AOE — multishot arrows or AOE circle
      if (aoe) {
        const isMultishot = abilityId === "multishot" || abilityId === "volley";
        if (isMultishot && this.player.classId === "ranger") {
          const nearbyNPCs = this.npcs.filter(n => !n.dead).slice(0, targetsHit ?? 3);
          for (const n of nearbyNPCs) {
            this.animSystem?.spawnArrow(this.player.x, this.player.y, n.x, n.y);
            this.animSystem?.playHit(n.id);
          }
        } else {
          this.animSystem?.spawnAOE({
            x: this.player.x, y: this.player.y,
            radius: ability?.range ?? 3,
            color:  abilityId.includes("holy") || abilityId.includes("consec") || abilityId.includes("divine")
              ? "rgba(255,220,50,0.4)" : "rgba(255,100,0,0.4)"
          });
        }
        this.combatLog?.push({
          text: `${ability?.name ?? abilityId} hit ${targetsHit ?? 0} target${targetsHit !== 1 ? "s" : ""}!`,
          type: "damage_out"
        });
        return;
      }

      // Heal
      if (heal > 0) {
        this.animSystem?.playHeal(targetId === "self" ? "player" : targetId);
        return;
      }

      // Damage log
      if (damage > 0) {
        const npc = this.npcs.find(n => n.id === targetId);
        this.combatLog?.push({
          text: `${ability?.name ?? abilityId} hits ${npc?.name ?? npc?.classId ?? targetId} for ${damage}!`,
          type: "damage_out"
        });
      }
    };

    this.multiplayerSystem.onPlayerHealed = ({ healerToken, targetToken, amount }) => {
      const isSelf = targetToken === this.multiplayerSystem.playerToken;
      if (isSelf) {
        this.animSystem?.playHeal("player");
        this.combatLog?.push({ text: `Healed for ${amount} HP!`, type: "heal" });
      } else {
        this.animSystem?.playHeal(`remote_${targetToken}`);
      }
    };

    this.multiplayerSystem.onBuffApplied = ({ abilityId, duration }) => {
      if (abilityId === "divine_shield") {
        this.player.invulnerable      = true;
        this.player.invulnerableTimer = Math.floor(duration / 50); // ms to ticks
        this.combatLog?.push({ text: "Divine Shield activated!", type: "system" });
        this.animSystem?.playHeal("player");
      }
    };

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

    // Tell server we respawned — resets HP server-side
    this.multiplayerSystem?.send({ type: "respawn" });

    // Brief invulnerability window so server NPC attacks don't instant-kill
    p.invulnerable      = true;
    p.invulnerableTimer = 120; // 6 seconds at 20 ticks/sec

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
    this.combatLog?.push({ text: "You have returned. (Invulnerable for 6s)", type: "system" });
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

    const t0   = performance.now();
    const slow = 16; // ms threshold for slow frame warnings

    if (!this._playerDead) {
      const serverOwnsNPCs = this.multiplayerSystem?._connected;

      const t1 = performance.now();
      if (!this.townSystem && !serverOwnsNPCs) {
        this.npcPerceptionSystem?.update();
        this.npcMovementSystem?.update();
        this.combatSystem?.update();
        this.npcAISystem?.update(this.world);
      } else if (!this.townSystem && serverOwnsNPCs) {
        if (this.combatSystem) this.combatSystem.multiplayerMode = true;
        this.combatSystem?.updatePlayerOnly();
      }
      const t2 = performance.now();

      this.movementSystem?.update();
      const t3 = performance.now();

      this.lootSystem?.update();
      if (!serverOwnsNPCs) this.spawnSystem?.update();
      this.townSystem?.update();
      this.animSystem?.update();
      this.effectSystem?.update();
      const t4 = performance.now();

      this.multiplayerSystem?.update();
      const t5 = performance.now();

      this._tickPlayerResource();

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

      // Log slow systems
      const slowThreshold = slow;
      if (t2 - t1 > slowThreshold) console.warn(`[Loop] NPC systems: ${(t2-t1).toFixed(1)}ms`);
      if (t3 - t2 > slowThreshold) console.warn(`[Loop] Movement: ${(t3-t2).toFixed(1)}ms`);
      if (t4 - t3 > slowThreshold) console.warn(`[Loop] Loot/anim/effect: ${(t4-t3).toFixed(1)}ms`);
      if (t5 - t4 > slowThreshold) console.warn(`[Loop] Multiplayer: ${(t5-t4).toFixed(1)}ms`);
    }

    this.combatLog?.update();

    // ── Auto-target nearest enemy when no target ──────────────────────────
    if (this.player && !this._playerDead) {
      const target = this._currentTarget;
      const needsTarget = !target || target.dead ||
        (target.type === "npc" && !this.npcs.find(n => n.id === target.id));

      const allNPCs = [...this.npcs, ...(this.townSystem?.npcs ?? [])];
      if (needsTarget && allNPCs.length > 0) {
        const AUTO_RANGE = 8; // tiles
        let nearest = null, nearestDist = Infinity;
        for (const npc of allNPCs) {
          if (npc.dead) continue;
          const dx = npc.x - this.player.x;
          const dy = npc.y - this.player.y;
          const d  = Math.sqrt(dx*dx + dy*dy);
          if (d < AUTO_RANGE && d < nearestDist) {
            nearestDist = d;
            nearest     = npc;
          }
        }
        if (nearest) this._setTarget(nearest);
      }
    }

    if (this.player) {
      this.renderer.camera.centerOn(this.player.x, this.player.y, this.world);
    }

    const t6 = performance.now();
    if (!this._deathScreen?.active) {
      this.renderer.render(this.world, this.entities);
    }
    const t7 = performance.now();
    if (t7 - t6 > slow) console.warn(`[Loop] Render: ${(t7-t6).toFixed(1)}ms`);
    const total = t7 - t0;
    if (total > 50) console.warn(`[Loop] TOTAL SLOW FRAME: ${total.toFixed(1)}ms`);

    requestAnimationFrame(() => this.loop());
  }
}
