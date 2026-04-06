export const TOWNS = [
  // Core towns near spawn (120,90) — safe zone
  {
    x: 48,
    y: 40,
    name: "Ashford",
    type: "Market Town",
    desc:
      "A weathered trading post where merchants hawk their wares beneath banners faded by years of sun and rain.",
    services: ["Inn", "Shop", "Temple", "Tavern", "Vendor", "Craft"],
    rumours: [
      "Strange lights seen over the Darkwood at midnight.",
      "A bandit lord has claimed the old eastern road.",
    ],
  },
  {
    x: 180,
    y: 32,
    name: "Duskhollow",
    type: "Mage’s Citadel",
    desc:
      "Towers of pale stone pierce the clouds, where magic seeps from every cobblestone and the air smells of ozone.",
    services: ["Inn", "Shop", "Tavern", "Vendor", "Craft"],
    rumours: [
      "A rogue golem was spotted near the northern ruins.",
      "Scroll prices have doubled since the war.",
    ],
  },
  {
    x: 40,
    y: 128,
    name: "Ironhaven",
    type: "Dwarven Outpost",
    desc:
      "Built into the mountainside, Ironhaven reeks of forge-smoke and the rich ale of a dozen dwarven clans.",
    services: ["Inn", "Shop", "Temple", "Vendor", "Craft"],
    rumours: [
      "The mines have broken into a cavern no dwarf has mapped.",
      "Iron supply is low — ore pays double right now.",
    ],
  },
  {
    x: 192,
    y: 140,
    name: "Saltmere",
    type: "Fishing Village",
    desc:
      "Weatherbeaten nets hang over every doorway. The salt air carries whispers of sea-monsters seen at dusk.",
    services: ["Inn", "Temple", "Tavern", "Vendor"],
    rumours: [
      "Three fishing boats vanished last week. No wreckage.",
      "A mermaid was seen near the eastern shoals.",
    ],
  },
  {
    x: 120,
    y: 88,
    name: "Crossroads",
    type: "Wayfarers’ Rest",
    desc:
      "Four roads meet here. Adventurers, traders, and thieves mingle at the sign of the Broken Wheel.",
    services: ["Inn", "Shop", "Tavern", "Vendor", "Craft"],
    rumours: [
      "A merchant caravan was ambushed by creatures from the mist.",
      "The old dungeon gate has been unsealed.",
    ],
  },

  // Mid-range towns (moderate danger)
  {
    x: 60,
    y: 75,
    name: "Thornwall",
    type: "Frontier Fort",
    desc:
      "A crumbling fort repurposed as a waystation. Mercenaries drink alongside farmers fleeing the wilds.",
    services: ["Inn", "Shop", "Tavern", "Vendor"],
    rumours: [
      "A strange fog rolls in from the east every night.",
      "The fort commander is paying bounties for goblin ears.",
    ],
  },
  {
    x: 155,
    y: 95,
    name: "Emberglass",
    type: "Alchemist Enclave",
    desc:
      "Smoke of a dozen colours pours from laboratory windows. The residents are brilliant — and slightly mad.",
    services: ["Inn", "Shop", "Craft", "Vendor"],
    rumours: [
      "An experimental potion turned three apprentices into frogs.",
      "Rare reagents found in the deep forest fetch high prices here.",
    ],
  },

  // Far towns (high danger zones)
  {
    x: 35,
    y: 35,
    name: "Frostpeak",
    type: "Mountain Refuge",
    desc:
      "Ice clings to every surface. Hunters and rangers gather here, speaking little but eating heartily.",
    services: ["Inn", "Shop", "Temple"],
    rumours: [
      "Something ancient stirs beneath the glacier.",
      "The northern pass has been sealed by avalanche — or something worse.",
    ],
  },
  {
    x: 205,
    y: 145,
    name: "Tidesmere",
    type: "Smugglers Cove",
    desc:
      "No questions asked, no names given. The best gear in the realm passes through here at twice the price.",
    services: ["Inn", "Shop", "Vendor", "Craft"],
    rumours: [
      "A sea dragon was spotted three leagues out.",
      "The harbour master takes a cut of everything — even the illegal stuff.",
    ],
  },
];
