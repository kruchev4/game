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
import { fetchAvailableServers }     from "./adapters/ServerDirectory.js";
import { createClient }              from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config/supabaseConfig.js";

const WORLD_ID = "overworld_C";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Load game data from Supabase (single source of truth) ─────────────────
async function loadGameData() {
  const [abilitiesRes, classesRes, itemsRes] = await Promise.all([
    supabase.from("abilities").select("id, data"),
    supabase.from("classes").select("id, data"),
    supabase.from("items").select("*")
  ]);

  if (abilitiesRes.error) throw new Error(`abilities: ${abilitiesRes.error.message}`);
  if (classesRes.error)   throw new Error(`classes: ${classesRes.error.message}`);
  if (itemsRes.error)     throw new Error(`items: ${itemsRes.error.message}`);

  const abilities = {};
  for (const row of abilitiesRes.data ?? []) {
    const def = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    if (def) abilities[row.id] = def;
  }

  const classes = {};
  for (const row of classesRes.data ?? []) {
    const def = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    if (def) classes[row.id] = def;
  }

  const items = {};
  for (const row of itemsRes.data ?? []) {
    items[row.id] = { ...row, onUse: row.effect ?? null };
  }

  console.log(`[main] Loaded ${Object.keys(abilities).length} abilities, ${Object.keys(classes).length} classes, ${Object.keys(items).length} items from Supabase`);
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

    const { abilities, classes, items } = await loadGameData();

    // ── Launch engine ─────────────────────────────────────────────────────
    async function launchGame(character, saveSlot, serverUrl = null) {
      const engine = new Engine({ worldProvider, renderer });

      engine.saveSlot      = saveSlot;
      engine.saveProvider  = saveProvider;
      engine.serverUrl     = serverUrl;
      engine.onQuitToTitle = () => showScreens();

      // Inject data so Engine._loadData skips its own Supabase fetch
      engine._abilities = abilities;
      engine._classes   = classes;
      engine._itemDefs  = items;
      engine._lootTables = {};
      engine._skills     = {};
      engine._spawnData  = { spawnGroups: [], randomEncounters: { enabled: false } };

      await engine.loadWorld(WORLD_ID, character);

      engine.start();
      window.engine = engine;
    }

    // ── Show pre-game screens ─────────────────────────────────────────────
    async function showScreens() {
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