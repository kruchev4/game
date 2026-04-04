import { Engine } from "./core/Engine.js";
import { Renderer } from "./render/Renderer.js";
import { SupabaseOverworldProvider } from "./adapters/SupabaseOverworldProvider.js";

export async function start(canvas) {
  const renderer = new Renderer(canvas);
  const worldProvider = new SupabaseOverworldProvider();

  const engine = new Engine({
    worldProvider,
    renderer
  });

  await engine.loadWorld("overworld_C");
  engine.start();
}
