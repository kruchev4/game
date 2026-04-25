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
import { AnimationSystem }     from "../systems/AnimationSystem.js";
import { EffectSystem }        from "../systems/EffectSystem.js";
import { InputManager }        from "../systems/InputManager.js";
import { GameEventHandler }    from "../systems/GameEventHandler.js";
import { SaveManager }         from "../systems/SaveManager.js";
import { UIManager }           from "../systems/UIManager.js";
import { NetworkManager }      from "../systems/NetworkManager.js";
import { ActionManager, getRankedAbility } from "../systems/ActionManager.js";
import { TownWorldProvider }   from "../adapters/TownWorldProvider.js";
import { createClient }        from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config/supabaseConfig.js";
import { CombatLog }           from "../ui/CombatLog.js";
import { findNearestWalkable } from "../world/findNearestWalkable.js";
import { DungeonSystem } from "../systems/DungeonSystem.js";


export class Engine {
  constructor({ worldProvider, renderer }) {
    this.worldProvider = worldProvider;
    this.renderer      = renderer;
    this.dungeonSystem = null;
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

    this.lootSystem       = null;
    this.xpSystem         = null;
    this.spawnSystem      = null;
    this.townSystem       = null;
    this.multiplayerSystem = null;
    this.animSystem        = null;
    this.effectSystem      = null;

    // World transition state
    this._currentWorldId  = null;
    this._returnStack     = []; // [{ worldId, x, y }] — stack for nested transitions
    this._respawnPoint    = null; // { worldId, x, y } — set by inn

    // Save system
    this.saveSlot     = null;
    this.saveProvider = null;
    this.serverUrl    = null;  // set by main.js before loadWorld

    this.onQuitToTitle = null;

    // Pause menu
    this._paused = false;

    // Ground-target mode (e.g. Volley) — set when ability needs a click-to-place
    this._groundTargeting = null; // { abilityId, range, radius, onPlace(wx,wy) }

    // Fallback class for testing only — overridden by character data
    this._playerClassId = null;
  }

  // ─────────────────────────────────────────────
  // DATA LOADING
  // ─────────────────────────────────────────────

  async _loadData() {
    // Skip if data already injected externally (e.g. by main.js)
    if (this._abilities && Object.keys(this._abilities).length > 0) {
      console.log("[Engine] Data already loaded externally — skipping _loadData");
      return;
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const [abilitiesRes, classesRes, itemsRes] = await Promise.all([
      sb.from("abilities").select("id, data"),
      sb.from("classes").select("id, data"),
      sb.from("items").select("*"),
    ]);

    if (abilitiesRes.error) throw new Error(`[Engine] abilities: ${abilitiesRes.error.message}`);
    if (classesRes.error)   throw new Error(`[Engine] classes: ${classesRes.error.message}`);
    if (itemsRes.error)     throw new Error(`[Engine] items: ${itemsRes.error.message}`);

    this._abilities = {};
    for (const row of (abilitiesRes.data ?? [])) {
      const def = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      if (def) this._abilities[row.id] = def;
    }

    this._classes = {};
    for (const row of (classesRes.data ?? [])) {
      const def = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      if (def) this._classes[row.id] = def;
    }

    this._itemDefs = {};
    for (const row of (itemsRes.data ?? [])) {
      const effect = row.effect ?? null;
      // For consumables: effect IS the onUse payload
      // For equipment:   effect holds stats — onUse should be null
      const isConsumable = row.type === "consumable";
      this._itemDefs[row.id] = {
        ...row,
        onUse: isConsumable ? effect : null,
        stats: !isConsumable && effect?.stats ? effect.stats : (row.stats ?? null),
      };
    }

    this._lootTables = {};
    this._skills     = {};
    this._spawnData  = { spawnGroups: [], randomEncounters: { enabled: false } };

    console.log(`[Engine] Loaded from Supabase: ${Object.keys(this._abilities).length} abilities, ${Object.keys(this._classes).length} classes, ${Object.keys(this._itemDefs).length} items`);
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

       // ── THE FIX: Create managers BEFORE building systems! ──
       this.inputManager = new InputManager(this);
       this.gameEventHandler = new GameEventHandler(this);
       this.actionManager = new ActionManager(this);
       this.saveManager = new SaveManager(this);
       this.uiManager = new UIManager(this);
       this.networkManager = new NetworkManager(this);

       this._spawnPlayer();
       this._buildSystems();

       // Skip client SpawnSystem if a server is configured — server owns all NPCs
       if (!this.serverUrl) {
         this._initSpawnSystem();
       }

       // Now that player/data exists, init the persistent UI
       this.uiManager.initPersistentWindows();
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
    this.uiManager.closeAllWindows();

    this.townSystem = null;

    // Save current game state before leaving
    await this.saveManager.save(true);

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
    this.actionManager.setTarget(null);
    this.combatSystem?.combatants?.clear();
    this.combatSystem?.clearAllCooldowns?.();
    this.player.inCombat        = false;
    this.player.dead            = false;
    this.player.abilityCooldowns = {};
    this.renderer.elementalCharge = null;

    this._buildSystems();
    // Update charSheet player reference after world transition
    this._charSheet?.setPlayer(this.player);

    if (isTown) {
      this._initTownSystem();
    } else if (isDungeon) {
      this._initDungeonSystem();
    }
// Overworld NPC spawning is handled entirely by the server

    // Re-wire systems to the live npcs array after population.
    if (this.clickToMoveSystem)   this.clickToMoveSystem.npcs   = this.npcs;
    if (this.combatSystem)        this.combatSystem.npcs         = this.npcs;
    if (this.npcPerceptionSystem) this.npcPerceptionSystem.npcs  = this.npcs;
    if (this.npcMovementSystem)   this.npcMovementSystem.npcs    = this.npcs;
    if (this.npcAISystem)         this.npcAISystem.npcs          = this.npcs;

    console.log(`[Engine] Transition complete → ${this._currentWorldId} | NPCs: ${this.npcs.length} | world.type: ${this.world?.type}`);

    // Re-center camera
    this.renderer.camera.centerOn(x, y, this.world);
  }

  /**
   * Transition to a town or dungeon, resolving entry point from world data.
   * entryX/entryY are optional hints from the overworld JSON object.
   * If absent, loads the target world to read its entryPoint field.
   * This means no coordinates ever need to be hardcoded in Engine.
   */
  async _transitionToWorld({ targetWorld, entryX, entryY, returnWorld, returnX, returnY }) {
    // Explicit entry coords in the JSON — use them directly
    if (entryX != null && entryY != null) {
      return this.transition({
        targetWorld, targetX: entryX, targetY: entryY,
        returnWorld, returnX, returnY
      }).catch(err => console.warn(`[Engine] ${targetWorld} not found:`, err.message));
    }

    // No entry coords — load the world to find its entryPoint
    const isTown    = targetWorld.startsWith("town_");
    const isDungeon = !isTown && !targetWorld.startsWith("overworld_");
    let loaded = null;
    if (isTown || isDungeon) {
      try {
        loaded = await new TownWorldProvider().load(targetWorld);
      } catch (err) {
        console.warn(`[Engine] Could not pre-load ${targetWorld}:`, err.message);
      }
    }

    // Priority: world.entryPoint > world center
    const tx = loaded?.entryPoint?.x ?? Math.floor((loaded?.width  ?? 20) / 2);
    const ty = loaded?.entryPoint?.y ?? Math.floor((loaded?.height ?? 20) / 2);

    return this.transition({
      targetWorld, targetX: tx, targetY: ty,
      returnWorld, returnX, returnY
    }).catch(err => console.warn(`[Engine] ${targetWorld} not found:`, err.message));
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

    // Always set classId regardless of whether classDef loaded correctly
    this.player.classId = classId;
    this.player.name    = char?.name ?? "Hero";

    if (classDef) {
      this.player.name        = char?.name ?? "Hero";
      this.player.classId     = classId;
      this.player.icon        = classDef.icon ?? "🧙";
      const savedAbilities = char?.abilities ?? [];
      if (savedAbilities.length) {
        this.player.abilities = savedAbilities;
      } else {
        const basicAttack = classDef.basicAttack ?? classDef.abilities?.[0];
        this.player.abilities = basicAttack ? [basicAttack] : [];
      }
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

    // Normalise to a flat list of spawn defs — support both formats:
    //   Old: spawnGroups: [{ monsters: [{ classId, x, y }] }]
    //   New: spawns: [{ monsterId, x, y, roamRadius, isBoss }]
    const flatSpawns = [];
    if (world.spawnGroups?.length) {
      for (const group of world.spawnGroups) {
        for (const m of (group.monsters ?? [])) {
          flatSpawns.push({ classId: m.classId, x: m.x, y: m.y,
                            roamRadius: m.roamRadius, isBoss: false });
        }
      }
    } else if (world.spawns?.length) {
      for (const s of world.spawns) {
        flatSpawns.push({ classId: s.monsterId, x: s.x, y: s.y,
                          roamRadius: s.roamRadius, isBoss: s.isBoss ?? false });
      }
    }

    for (const monDef of flatSpawns) {
      const classDef = this._classes[monDef.classId];
      if (!classDef) {
        console.warn(`[Engine] Unknown dungeon classId: ${monDef.classId}`);
        continue;
      }

      let pos;
      try {
        pos = findNearestWalkable(world, monDef.x, monDef.y, 3);
      } catch { continue; }

      const npc = new NPC({
        id:         `${monDef.classId}_${pos.x}_${pos.y}`,
        classId:    monDef.classId,
        classDef,
        x:          pos.x,
        y:          pos.y,
        roamCenter: { x: pos.x, y: pos.y },
        roamRadius: monDef.roamRadius ?? classDef.roamRadius ?? 3
      });

      if (monDef.isBoss) {
        npc.isBoss = true;
        npc.name   = classDef.name;
      }

      this.npcs.push(npc);
      this.entities.push(npc);
      this.npcPerceptionSystem?.npcs.push(npc);
      this.npcMovementSystem?.npcs.push(npc);
      this.npcAISystem?.npcs.push(npc);
      this.combatSystem?.npcs.push(npc);
    }

    console.log(`[Engine] Dungeon spawned: ${this.npcs.length} monsters`);
  }
  _initDungeonSystem() {
  const world = this.world;
  const returnDest = this._returnStack[this._returnStack.length - 1];
  if (returnDest) {
    this._respawnPoint = {
      worldId: returnDest.worldId,
      x:       returnDest.x,
      y:       returnDest.y
    };
    console.log(`[Engine] Dungeon respawn set to ${returnDest.worldId} (${returnDest.x}, ${returnDest.y})`);
  }
  this.dungeonSystem = new DungeonSystem({
    world,
    player:    this.player,
    itemDefs:  this._itemDefs,
    lootTiers: this._lootTiers,
    onExit:    (exit) => this._exitTown(exit),
    onChestOpen: (chest, loot) => {
      this.gameEventHandler.handleDungeonEvent({ type: "chest_open", chest, loot });
      if (loot.gold > 0) this.player.gold = (this.player.gold ?? 0) + loot.gold;
      if (loot.itemId) this.lootSystem.giveItem(loot.itemId, loot.qty ?? 1);
    },
    onRoomEnter:  (room) => this.gameEventHandler.handleDungeonEvent({ type: "room_enter", room }),
    onBossKilled: (boss) => this.gameEventHandler.handleDungeonEvent({ type: "boss_killed", boss }),
    onCleared:    ()     => this.gameEventHandler.handleDungeonEvent({ type: "dungeon_cleared" })
  });
  this.renderer.dungeonSystem = this.dungeonSystem;
  this._initDungeonSpawns();
  this.townSystem = null;
  console.log(`[Engine] DungeonSystem initialized — ${this.dungeonSystem.chests.length} chests, ${this.dungeonSystem.rooms.length} rooms`);
}

  _initTownSystem() {
    this.townSystem = new TownSystem({
      townData: this.world,
      world:    this.world,
      player:   this.player,
      onInteract: (npc) => this.uiManager.onNPCInteract(npc),
      onExit:     (exit) => this._exitTown(exit)
    });

    // Add friendly NPCs to entities for rendering
    for (const npc of this.townSystem.npcs) {
      this.entities.push(npc);
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
    this.dungeonSystem = null;
    this.renderer.dungeonSystem = null;

    this.npcPerceptionSystem = new NPCPerceptionSystem({ npcs, player });

    this.npcMovementSystem = new NPCMovementSystem({ world, npcs, player });

    this.movementSystem = new MovementSystem({ world, player });

    this.clickToMoveSystem = new ClickToMoveSystem({
      canvas:         renderer.canvas,
      camera:         renderer.camera,
      world,
      movementSystem: this.movementSystem,
      npcs,
      // an empty function to stop clearing targets
      onTarget:       () => {},
      isBlocked:      (wx, wy) => {
        if (this.player.x === wx && this.player.y === wy) return true;
        const remotePlayers = this.multiplayerSystem?.getRemotePlayers() ?? [];
        if (remotePlayers.some(p => p.x === wx && p.y === wy)) return true;
        if (this.townSystem?.npcs.some(n => n.x === wx && n.y === wy)) return true;
        if (this.lootSystem?.corpses.some(c => c.x === wx && c.y === wy)) return true;
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
      onEvent:   (e) => this.gameEventHandler.handleCombatEvent(e)
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
      onEvent: (e) => this.gameEventHandler.handleLootEvent(e)
    });

    // XP system
    this.xpSystem = new XPSystem({
      player,
      skills:  this._skills,
      onEvent: (e) => this.gameEventHandler.handleXPEvent(e)
    });

    // Level-up window
    const classSkills = this._skills[this._playerClassId] ?? [];
    this.uiManager.buildWorldWindows();

    // Sync ability bar now that renderer and skills are ready
    if (this._pendingSyncAbilityBar) {
      this._pendingSyncAbilityBar = false;
      this.uiManager.syncAbilityBar();
    }

    // Push player abilities to renderer (only what player has learned)
    const classDef = this._classes[this._playerClassId];
    renderer.abilities     = this._abilities;
    renderer.itemDefs      = this._itemDefs;
    renderer.currentTarget = null;
    renderer.player        = player;

    this.combatLog     = new CombatLog();
    renderer.combatLog = this.combatLog;

    renderer.camera.centerOn(player.x, player.y, world);

    // Animation system
    this.animSystem          = new AnimationSystem();
    renderer.animSystem      = this.animSystem;

    // Effect system
    this.effectSystem = new EffectSystem({
      player,
      npcs,
      onEvent: (e) => this.gameEventHandler.handleEffectEvent(e)
    });
    renderer.effectSystem = this.effectSystem;

    // Sync ability bar now that renderer and skills are ready
    if (this._pendingSyncAbilityBar) {
      this._pendingSyncAbilityBar = false;
      this._syncAbilityBar();
    }

    // Set up Fighter rage resource
    if (this._playerClassId === "fighter") {
      const classDef = this._classes?.["fighter"] ?? {};
      const rageConfig = classDef.resource ?? {};
      this.player.resource     = 0;
      this.player.maxResource  = rageConfig.max ?? 100;
      this.player.resourceDef  = { type: "rage", label: "Rage", color: rageConfig.color ?? "#cc3333" };
    }

    // Start multiplayer presence — wrapped so any error doesn't block rendering
    try {
      this.networkManager.init();
    } catch (e) {
      console.warn("[Engine] Multiplayer init failed, continuing without:", e.message);
    }
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
    let respawnPos;
    try {
      respawnPos = findNearestWalkable(this.world, rx, ry, 10);
    } catch {
      try {
        respawnPos = findNearestWalkable(this.world,
          Math.floor(this.world.width / 2),
          Math.floor(this.world.height / 2), 10);
      } catch {
       respawnPos = { x: Math.floor(this.world.width / 2), y: Math.floor(this.world.height / 2) };
      }
    }
    p.x = respawnPos.x;
    p.y = respawnPos.y;
    }

    this._playerDead = false;
    this.uiManager.deathScreen = null;

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

  /**
   * Call this when the player transitions to a new zone.
   * Triggers auto-save and loads the new world.
   */
  async changeZone(worldId) {
    await this.saveManager.save();
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

    if (!this._playerDead && !this._paused) {
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
      this.dungeonSystem?.update(1, this.npcs);
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
      this.saveManager?.tick();
    }

    this.combatLog?.update();

    if (this.player) {
      this.renderer.camera.centerOn(this.player.x, this.player.y, this.world);
    }

    // Don't render game world when death screen is active — it draws on same canvas
    if (!this.uiManager.deathScreen?.active) {
      this.renderer.render(this.world, this.entities);
    }

    requestAnimationFrame(() => this.loop());
  }
}
