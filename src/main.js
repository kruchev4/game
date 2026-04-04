import { Engine } from "./core/Engine.js";
import { SupabaseWorldProvider } from "./adapters/SupabaseWorldProvider.js";
import { Renderer } from "./render/Renderer.js";

export async function start(canvas) {
  const worldProvider = new SupabaseWorldProvider();
  const renderer = new Renderer(canvas);

  const engine = new Engine({
    worldProvider,
    renderer
  });

  await engine.loadWorld("overworld_C");
  engine.start();
}
