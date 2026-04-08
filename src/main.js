/**
 * main.js — Entry point. Self-executes on load.
 *
 * Flow:
 *   ScreenManager (character select + creation HTML overlay)
 *     ├─ Play saved char  → Engine
 *     └─ Create new char  → auto-save → Engine
 */

import { Engine }                    from "./core/Engine.js";
import { Renderer }                  from "./render/Renderer.js";
import { SupabaseOverworldProvider } from "./adapters/SupabaseOverworldProvider.js";
import { SaveProvider }              from "./adapters/SaveProvider.js";
import { ScreenManager }             from "./ui/ScreenManager.js";

const WORLD_ID = "overworld_C";

async function start() {
  try {
    const canvas = document.getElementById("game");
    if (!canvas) throw new Error("Canvas #game not found");

    const renderer      = new Renderer(canvas);
    const worldProvider = new SupabaseOverworldProvider();
    const saveProvider  = new SaveProvider();

    // Load data files once
    const [abilitiesRes, classesRes] = await Promise.all([
      fetch("./src/data/abilities.json"),
      fetch("./src/data/classes.json")
    ]);

    if (!abilitiesRes.ok) throw new Error(`Failed to load abilities.json: ${abilitiesRes.status}`);
    if (!classesRes.ok)   throw new Error(`Failed to load classes.json: ${classesRes.status}`);

    const abilities = await abilitiesRes.json();
    const classes   = await classesRes.json();

    // ── Launch engine ──────────────────────────────────────────────────
    // ── Launch engine ──────────────────────────────────────────────────
async function launchGame(config, saveSlot) {
  const engine = new Engine({ worldProvider, renderer });

  const {
    serverUrl,
    name,
    raceId,
    classId,
    stats
  } = config;

  engine.saveSlot      = saveSlot;
  engine.saveProvider  = saveProvider;
  engine.onQuitToTitle = () => showScreens();

  await engine.loadWorld(WORLD_ID, {
    name,
    raceId,
    classId,
    stats
  });

  // ── Multiplayer ──────────────────────────────────────────────────
  if (serverUrl) {
    engine.multiplayer = new MultiplayerSystem({
      serverUrl,
      player:      engine.player,
      worldId:     WORLD_ID,
      playerToken: engine.playerToken,

      onPlayerJoin:   (e) => engine.addRemotePlayer?.(e),
      onPlayerLeave:  (t) => engine.removeRemotePlayer?.(t),
      onPlayerUpdate: (e) => engine.updateRemotePlayer?.(e),

      onNPCDamaged:      (d) => engine.onNPCDamaged?.(d),
      onNPCKilled:       (d) => engine.onNPCKilled?.(d),
      onNPCState:        (n) => engine.onNPCState?.(n),
      onNPCAttackPlayer: (d) => engine.onNPCAttackPlayer?.(d)
    });

    engine.multiplayer.join();
  }

  engine.start();
  window.engine = engine;
}

// ── Show pre-game screens ──────────────────────────────────────────
async function showScreens() {
  const slots = await saveProvider.loadAll();
  const mgr   = new ScreenManager({ slots, saveProvider, classes, abilities });

  // ── Load existing character ──────────────────────────────────────
  mgr.onPlay = async (slotIndex, saveData) => {
    const servers = await fetchAvailableServers();
    if (!servers.length) {
      alert("No multiplayer servers online.");
      return;
    }

    const selectedServer = servers[0];

    await launchGame({
      name:      saveData.name,
      raceId:    saveData.raceId,
      classId:   saveData.classId,
      stats:     saveData.stats,
      serverUrl: selectedServer.ws_url
    }, slotIndex + 1);
  };

  // ── Create new character ─────────────────────────────────────────
  mgr.onCreate = async (slotIndex, character) => {
    const servers = await fetchAvailableServers();
    if (!servers.length) {
      alert("No multiplayer servers online.");
      return;
    }

    const selectedServer = servers[0];

    await saveProvider.save(slotIndex + 1, {
      ...character,
      position:  { worldId: WORLD_ID, x: null, y: null },
      gold:      50,
      xp:        0,
      inventory: []
    });

    await launchGame({
      ...character,
      serverUrl: selectedServer.ws_url
    }, slotIndex + 1);
  };

  mgr.show();
}
  }

start();
