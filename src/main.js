import { Engine }             from "./core/Engine.js";
import { Renderer }            from "./render/Renderer.js";
import { SupabaseOverworldProvider } from "./adapters/SupabaseOverworldProvider.js";
import { CharacterCreation }   from "./ui/CharacterCreation.js";

export async function start(canvas) {
  const renderer      = new Renderer(canvas);
  const worldProvider = new SupabaseOverworldProvider();

  // ── Load data files needed for character creation ──
  const [abilitiesRes, classesRes] = await Promise.all([
    fetch("./src/data/abilities.json"),
    fetch("./src/data/classes.json")
  ]);
  const abilities = await abilitiesRes.json();
  const classes   = await classesRes.json();

  // ── Show character creation screen ──
  const creation = new CharacterCreation({ canvas, classes, abilities });

  creation.onConfirm = async ({ name, classId, stats }) => {
    // Hand off to engine with confirmed character data
    const engine = new Engine({ worldProvider, renderer });

    await engine.loadWorld("overworld_C", { name, classId, stats });
    engine.start();

    // Expose for console debugging
    window.engine = engine;
  };

  creation.show();
}
