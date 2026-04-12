/**
 * main.js — Entry point
 *
 * Flow:
 *   ScreenManager (character select + creation)
 *     ├─ Play saved char  → Engine
 *     └─ Create new char  → auto-save → Engine
 *
 * Multiplayer:
 *   - Fetches available servers from Supabase roe2_servers table
 *   - Player selects server (or plays offline if none available)
 *   - Engine connects via MultiplayerSystem
 */

import { Engine }                    from "./core/Engine.js";
import { Renderer }                  from "./render/Renderer.js";
import { SupabaseOverworldProvider } from "./adapters/SupabaseOverworldProvider.js";
import { SaveProvider }              from "./adapters/SaveProvider.js";
import { ScreenManager }             from "./ui/ScreenManager.js";
import { MultiplayerSystem }         from "./systems/MultiplayerSystem.js";
import { fetchAvailableServers }     from "./adapters/ServerDirectory.js";
import { createClient }              from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config/supabaseConfig.js";

const WORLD_ID = "overworld_C";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Load game data from Supabase (single source of truth) ─────────────────
async function loadGameData() {
  const [abilitiesRes, classesRes, itemsRes] = await Promise.all([
    supabase.from("abilities").select("*"),
    supabase.from("classes").select("*"),
    supabase.from("items").select("*")
  ]);

  // Convert abilities array to map keyed by id
  const abilities = {};
  for (const row of abilitiesRes.data ?? []) {
    abilities[row.id] = {
      id:          row.id,
      name:        row.name,
      type:        row.type,
      range:       row.range,
      cooldown:    row.cooldown,
      requiresLoS: row.type === "ranged",
      damage:      { base: row.damage_min, variance: row.damage_max - row.damage_min },
      heal:        row.heal_min > 0 ? { base: row.heal_min, variance: row.heal_max - row.heal_min } : undefined,
      aoe:         row.targets > 1 ? { maxTargets: row.targets, shape: row.type === "aoe" ? "radius" : "cone", centeredOnSelf: row.type === "aoe" } : undefined,
      cost:        row.mana_cost > 0 ? { mana: row.mana_cost } : {},
      icon:        row.icon,
      description: row.description,
      tags:        []
    };
  }

  // Convert classes array to map keyed by id
  const classes = {};
  for (const row of classesRes.data ?? []) {
    classes[row.id] = {
      id:          row.id,
      name:        row.name,
      description: row.description,
      icon:        row.icon,
      role:        row.role,
      baseStats:   { hp: row.base_hp, str: 14, dex: 12, int: 10, con: 12, wis: 10, cha: 10 },
      actionSpeed: row.action_speed,
      abilities:   row.abilities ?? [],
      color:       row.color,
      resource: {
        type:    row.resource_type,
        label:   row.resource_type === "rage" ? "Rage" : "Mana",
        color:   row.resource_type === "rage" ? "#cc2222" : "#3366ff",
        max:     row.resource_max,
        startAt: row.resource_type === "rage" ? 0 : row.resource_max,
        regenPerTick: row.resource_type === "mana" ? 0.05 : 0
      }
    };
  }

  // Items map
  const items = {};
  for (const row of itemsRes.data ?? []) {
    items[row.id] = row;
  }

  console.log(`[main] Loaded ${Object.keys(abilities).length} abilities, ${Object.keys(classes).length} classes, ${Object.keys(items).length} items from Supabase`);

  // Fall back to local JSON if Supabase failed
  if (!Object.keys(abilities).length || !Object.keys(classes).length) {
    console.warn("[main] Supabase data empty — falling back to local JSON");
    const [ar, cr] = await Promise.all([
      fetch("./src/data/abilities.json").then(r => r.json()),
      fetch("./src/data/classes.json").then(r => r.json())
    ]);
    return { abilities: ar, classes: cr, items };
  }

  return { abilities, classes, items };
}

// ── Entry point ───────────────────────────────────────────────────────────

async function start() {
  try {
    const canvas = document.getElementById("game");
    if (!canvas) throw new Error("Canvas #game not found");

    const renderer      = new Renderer(canvas);
    const worldProvider = new SupabaseOverworldProvider();
    const saveProvider  = new SaveProvider();

    // Load all game data from Supabase (single source of truth)
    const { abilities, classes, items } = await loadGameData();

    // ── Launch engine ─────────────────────────────────────────────────────
    async function launchGame(character, saveSlot, serverUrl = null) {
      const engine = new Engine({ worldProvider, renderer });

      engine.saveSlot      = saveSlot;
      engine.saveProvider  = saveProvider;
      engine.serverUrl     = serverUrl;  // pass URL to engine before loadWorld
      engine.onQuitToTitle = () => showScreens();

      await engine.loadWorld(WORLD_ID, character);

      engine.start();
      window.engine = engine;
    }

    // ── Show pre-game screens ─────────────────────────────────────────────
    async function showScreens() {
      // Stop any running engine
      if (window.engine) {
        window.engine.running = false;
        window.engine.multiplayerSystem?.leave();
        window.engine = null;
      }

      const [slots, servers] = await Promise.all([
        saveProvider.loadAll(),
        fetchAvailableServers()
      ]);

      const mgr = new ScreenManager({
        slots,
        servers,
        saveProvider,
        classes,
        abilities
      });

      mgr.onPlay = async (slotIndex, saveData, serverUrl) => {
        await launchGame({
          name:          saveData.name,
          raceId:        saveData.raceId,
          classId:       saveData.classId,
          stats:         saveData.stats,
          gold:          saveData.gold,
          xp:            saveData.xp,
          level:         saveData.level,
          bag:           saveData.bag,
          equipment:     saveData.equipment,
          quickSlots:    saveData.quickSlots,
          learnedSkills: saveData.learnedSkills,
          abilities:     saveData.abilities,
          position:      saveData.position
        }, slotIndex + 1, serverUrl);
      };

      mgr.onCreate = async (slotIndex, character, serverUrl) => {
        await saveProvider.save(slotIndex + 1, {
          ...character,
          position:  { worldId: WORLD_ID, x: null, y: null },
          gold:      50,
          xp:        0,
          inventory: []
        });
        await launchGame(character, slotIndex + 1, serverUrl);
      };

      mgr.show();
    }

    await showScreens();

    // Keep cloud server warm — ping every 14 minutes to prevent Render spin-down
    setInterval(() => {
      fetch("https://realm-echoes-broker-2.onrender.com").catch(() => {});
    }, 14 * 60 * 1000);

  } catch (e) {
    console.error("[Realm of Echoes] Startup error:", e);
    const canvas = document.getElementById("game");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#cc4444";
      ctx.font      = "16px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Startup error — check console", canvas.width / 2, canvas.height / 2);
      ctx.fillStyle = "#888";
      ctx.font      = "12px monospace";
      ctx.fillText(e.message, canvas.width / 2, canvas.height / 2 + 24);
    }
  }
}

start();
