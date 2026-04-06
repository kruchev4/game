export const LOOT_TIERS = {
  LEGENDARY: "legendary",
  RARE: "rare",
  UNCOMMON: "uncommon",
};

export const LEGENDARY_ITEMS = [
  {
    id: "tidecrown",
    name: "Crown of the Drowned King",
    icon: "👑",
    desc:
      "The barnacle-crusted crown of a sea lord whose name the waves forgot. " +
      "Grants +6 CON, +4 WIS, immunity to fear.",
    tier: LOOT_TIERS.LEGENDARY,
    type: "armor",
    effect: { con: 6, wis: 4, ac: 3 },
    price: 9999,
    flavour: `"Three tides have turned since it last knew air."`,
  },
  {
    id: "abyssal_blade",
    name: "Abyssal Edge",
    icon: "🗡️",
    desc:
      "Forged in the trench where no light reaches. " +
      "Deals 2d8+8 damage, ignores armor on crits.",
    tier: LOOT_TIERS.LEGENDARY,
    type: "weapon",
    effect: { atk: 8, dmg: "2d8" },
    price: 9999,
    flavour: `"It remembers every throat it has crossed."`,
  },
  {
    id: "veil_of_tides",
    name: "Veil of the Deep",
    icon: "🧣",
    desc:
      "A cloak woven from sea-fog and silence. " +
      "+5 AC, advantage on stealth, breathe underwater.",
    tier: LOOT_TIERS.LEGENDARY,
    type: "armor",
    effect: { ac: 5, dex: 3 },
    price: 9999,
    flavour: `"Sailors mistake the wearer for a ghost."`,
  },
];

export const RARE_ITEMS = [
  {
    id: "ring_of_recall",
    name: "Ring of Recall",
    icon: "💍",
    desc: "+20 MP, cast any spell twice per combat",
    type: "accessory",
    effect: { mp: 20 },
    price: 400,
    tier: LOOT_TIERS.RARE,
  },
  {
    id: "wardens_shield",
    name: "Warden’s Bulwark",
    icon: "🛡️",
    desc: "+5 AC, reflect 2 damage to attacker",
    type: "armor",
    effect: { ac: 5 },
    price: 500,
    tier: LOOT_TIERS.RARE,
  },
  {
    id: "boots_of_speed",
    name: "Boots of the Gale",
    icon: "👢",
    desc: "+10 speed, immune to slow/entangle",
    type: "boots",
    effect: { speed: 10 },
    price: 350,
    tier: LOOT_TIERS.RARE,
  },
  {
    id: "staff_of_storms",
    name: "Stormcaller Staff",
    icon: "🪄",
    desc: "+6 ATK (magic), chance to chain-lightning",
    type: "weapon",
    effect: { atk: 6, magic: true },
    price: 600,
    tier: LOOT_TIERS.RARE,
  },
];

export const UNCOMMON_ITEMS = [
  {
    name: "Sea-Jade Amulet",
    icon: "📿",
    desc: "+2 WIS, +1 AC",
    type: "accessory",
    effect: { wis: 2, ac: 1 },
    price: 120,
    tier: LOOT_TIERS.UNCOMMON,
  },
  {
    name: "Waterlogged Grimoire",
    icon: "📚",
    desc: "+4 MP, +1 spell slot",
    type: "misc",
    effect: { mp: 4 },
    price: 80,
    tier: LOOT_TIERS.UNCOMMON,
  },
  {
    name: "Coral Knife",
    icon: "🔪",
    desc: "+2 ATK, bleeds on hit",
    type: "weapon",
    effect: { atk: 2 },
    price: 90,
    tier: LOOT_TIERS.UNCOMMON,
  },
  {
    name: "Drowned Chest Key",
    icon: "🗝️",
    desc: "Opens sea-chest",
    type: "misc",
    effect: {},
    price: 40,
    tier: LOOT_TIERS.UNCOMMON,
  },
  {
    name: "Brine-soaked Map",
    icon: "🗺️",
    desc: "Reveals hidden room",
    type: "misc",
    effect: {},
    price: 30,
    tier: LOOT_TIERS.UNCOMMON,
  },
];
