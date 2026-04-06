export const RACES = [
  { id: "human", icon: "👤", name: "Human", bonus: "+1 All",
    mods: { STR: 1, DEX: 1, CON: 1, INT: 1, WIS: 1, CHA: 1 }, speed: 30 },

  { id: "elf", icon: "🌿", name: "Elf", bonus: "+2 DEX",
    mods: { DEX: 2, INT: 1 }, speed: 35 },

  { id: "dwarf", icon: "⛏", name: "Dwarf", bonus: "+2 CON",
    mods: { CON: 2, STR: 1 }, speed: 25 },

  { id: "halfling", icon: "🍀", name: "Halfling", bonus: "+2 DEX",
    mods: { DEX: 2, CHA: 1 }, speed: 25 },

  { id: "halforc", icon: "💀", name: "Half-Orc", bonus: "+2 STR",
    mods: { STR: 2, CON: 1 }, speed: 30 },

  { id: "gnome", icon: "🔮", name: "Gnome", bonus: "+2 INT",
    mods: { INT: 2, WIS: 1 }, speed: 25 },

  { id: "tiefling", icon: "🔥", name: "Tiefling", bonus: "+2 CHA",
    mods: { CHA: 2, INT: 1 }, speed: 30 },

  { id: "dragonborn", icon: "🐉", name: "Dragonborn", bonus: "+2 STR",
    mods: { STR: 2, CHA: 1 }, speed: 30 },
];
