

// campaign/generator/generateEightDungeons.js
import { generateDungeon } from "./dungeonGenerator.js";

export function generateEightDungeons(seedBase = "cmp_seed") {
  // Make sure we include forest + a spread of themes/difficulties
  const plan = [
    { id:"forest_glades",   name:"Forest Glades",   theme:"forest", difficulty:"easy"   },
    { id:"mossy_hollows",   name:"Mossy Hollows",  theme:"forest", difficulty:"normal" },
    { id:"echoing_cavern",  name:"Echoing Cavern", theme:"cavern", difficulty:"normal" },
    { id:"crypt_of_bones",  name:"Crypt of Bones", theme:"crypt",  difficulty:"hard"   },
    { id:"sunken_ruins",    name:"Sunken Ruins",   theme:"ruins",  difficulty:"hard"   },
    { id:"frostbound_keep", name:"Frostbound Keep",theme:"frost",  difficulty:"elite"  },
    { id:"magma_pit",       name:"The Magma Pit",  theme:"magma",  difficulty:"elite"  },
    { id:"elders_grove",    name:"Elder’s Grove",  theme:"forest", difficulty:"mythic" }
  ];

  return plan.map((p, i) =>
    generateDungeon({
      ...p,
      width: 60,
      height: 60,
      seed: `${seedBase}_${p.id}_${i}`
    })
  );
}
