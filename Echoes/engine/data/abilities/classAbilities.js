export const CLASS_ABILITIES = {
  fighter: [
    {
      id: "war_cry",
      name: "War Cry",
      icon: "📯",
      tag: "new",
      desc:
        "Once per combat, shout a war cry — grants +3 ATK and +2 DMG for 2 rounds.",
      effect: { type: "combat_buff", atk: 3, dmg: 2, rounds: 2, once: true },
      levels: [3],
    },
    {
      id: "iron_will",
      name: "Iron Will",
      icon: "🛡️",
      tag: "passive",
      desc:
        "Passive: reduce all incoming damage by 2. Your resolve turns blows aside.",
      effect: { type: "passive", dmgReduce: 2 },
      levels: [3, 5],
    },
    // …(rest unchanged)
  ],

  wizard: [
    {
      id: "arcane_focus",
      name: "Arcane Focus",
      icon: "🔮",
      tag: "passive",
      desc:
        "Passive: all spell damage +3. Your mastery sharpens every casting.",
      effect: { type: "passive", spellDmg: 3 },
      levels: [3],
    },
    // …
  ],

  // continue copying each class unchanged
};
const DEFAULT_CLASS_ABILITIES = (id) => ([
  {
    id: `focus_${id}`,
    name: "Focused Power",
    icon: "✨",
    tag: "passive",
    desc:
      "Passive: +2 ATK and +10 max MP. Your craft deepens.",
    effect: { type: "passive", atk: 2, mpMax: 10 },
    levels: [3, 5, 7, 10],
  },
  {
    id: `burst_${id}`,
    name: "Power Burst",
    icon: "⚡",
    tag: "new",
    desc:
      "New action: unleash raw power — 3d8 damage. 15 MP.",
    effect: {
      type: "new_action",
      action: "Power Burst",
      dice: "3d8",
      mpCost: 15,
    },
    levels: [3, 5, 7],
  },
  {
    id: `endure_${id}`,
    name: "Resilience",
    icon: "💪",
    tag: "passive",
    desc: "Passive: +12 max HP permanently.",
    effect: { type: "passive", hpMax: 12 },
    levels: [5, 7, 10],
  },
]);

export function getClassAbilities(classId) {
  return CLASS_ABILITIES[classId] ?? DEFAULT_CLASS_ABILITIES(classId);
}
