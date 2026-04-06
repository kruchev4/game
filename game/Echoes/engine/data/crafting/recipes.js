export const CRAFT_RECIPES = [
  {
    name: "Strong Health Potion",
    icon: "🧪",
    result: {
      name: "Strong Health Potion",
      icon: "🧪",
      desc: "+60 HP",
      price: 60,
      type: "potion",
      effect: { hp: 60 }
    },
    ingredients: ["Health Potion", "Health Potion"],
    desc: "Combine two potions into one strong dose."
  },

  {
    name: "Poison Vial",
    icon: "☠️",
    result: {
      name: "Poison Vial",
      icon: "☠️",
      desc: "Poison enemy (-3 HP/turn for 3 turns)",
      price: 40,
      type: "potion",
      effect: { poison: 3 }
    },
    ingredients: ["Venom Gland", "Moldy Bread"],
    desc: "A crude but effective toxin."
  },

  {
    name: "Wolf Fang Necklace",
    icon: "📿",
    result: {
      name: "Wolf Fang Necklace",
      icon: "📿",
      desc: "+1 ATK, +1 AC",
      price: 80,
      type: "accessory",
      effect: { atk: 1, ac: 1 }
    },
    ingredients: ["Fang Necklace", "Wolf Pelt"],
    desc: "Hardened from the hunt."
  },

  {
    name: "Shadow Essence Flask",
    icon: "🫙",
    result: {
      name: "Shadow Essence Flask",
      icon: "🫙",
      desc: "+15 MP, stealth next combat",
      price: 70,
      type: "potion",
      effect: { mp: 15 }
    },
    ingredients: ["Shadow Essence", "Soul Shard"],
    desc: "Bottled darkness. Handle carefully."
  },

  {
    name: "Bone Wand",
    icon: "🦴",
    result: {
      name: "Bone Wand",
      icon: "🦴",
      desc: "+4 ATK (magic)",
      price: 100,
      type: "weapon",
      effect: { atk: 4, magic: true }
    },
    ingredients: ["Bone Fragment", "Bone Fragment", "Spider Silk"],
    desc: "Crude necromantic focus."
  },

  {
    name: "Dragon Scale Shield",
    icon: "🐉",
    result: {
      name: "Dragon Scale Shield",
      icon: "🐉",
      desc: "+4 AC",
      price: 180,
      type: "armor",
      effect: { ac: 4 }
    },
    ingredients: ["Dragon Scale", "Troll Hide"],
    desc: "Forged from the toughest hides in the realm."
  },

  {
    name: "Eldritch Shard",
    icon: "💎",
    result: {
      name: "Eldritch Shard",
      icon: "💎",
      desc: "+5 ATK (magic), +2 AC",
      price: 250,
      type: "weapon",
      effect: { atk: 5, magic: true, ac: 2 }
    },
    ingredients: ["Lich Phylactery", "Soul Shard", "Shadow Essence"],
    desc: "Dangerous to hold. More dangerous to wield."
  },

  {
    name: "Mana Crystal",
    icon: "🔷",
    result: {
      name: "Mana Crystal",
      icon: "🔷",
      desc: "+30 MP",
      price: 55,
      type: "potion",
      effect: { mp: 30 }
    },
    ingredients: ["Spider Silk", "Spider Silk"],
    desc: "Spun into crystalline mana."
  }
];
