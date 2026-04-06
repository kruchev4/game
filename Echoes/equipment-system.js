/**
 * REALM OF ECHOES — Equipment & Loot System v1.1
 * Fixed: everything wrapped in IIFE, assigned to window.* to avoid
 * "already been declared" conflicts with index.html globals.
 */

(function installEquipmentSystem() {
  'use strict';

  window.ITEM_DB = {
    health_potion:       { name:'Health Potion',          icon:'🧪', desc:'+30 HP',                  price:25,   type:'potion',    tier:'common',    minLevel:1,  effect:{hp:30} },
    greater_health:      { name:'Greater Health Potion',  icon:'🧪', desc:'+60 HP',                  price:55,   type:'potion',    tier:'uncommon',  minLevel:5,  effect:{hp:60} },
    superior_health:     { name:'Superior Health Potion', icon:'🧪', desc:'+120 HP',                 price:120,  type:'potion',    tier:'rare',      minLevel:9,  effect:{hp:120} },
    mana_potion:         { name:'Mana Potion',            icon:'💧', desc:'+20 MP',                  price:20,   type:'potion',    tier:'common',    minLevel:1,  effect:{mp:20} },
    greater_mana:        { name:'Greater Mana Potion',    icon:'💧', desc:'+50 MP',                  price:50,   type:'potion',    tier:'uncommon',  minLevel:5,  effect:{mp:50} },
    elixir:              { name:'Elixir of Vitality',     icon:'✨', desc:'+50 HP +30 MP',           price:80,   type:'potion',    tier:'uncommon',  minLevel:4,  effect:{hp:50,mp:30} },
    antidote:            { name:'Antidote',               icon:'🌿', desc:'Cure poison',              price:15,   type:'potion',    tier:'common',    minLevel:1,  effect:{cure:'poison'} },
    elixir_of_gods:      { name:'Elixir of the Gods',     icon:'🌟', desc:'+200 HP +100 MP',         price:400,  type:'potion',    tier:'legendary', minLevel:12, effect:{hp:200,mp:100}, flavour:'Distilled from starlight and dragon blood.' },
    rusty_dagger:        { name:'Rusty Dagger',           icon:'🗡️', desc:'+1 ATK',                 price:8,    type:'weapon',    slot:'mainhand',  tier:'common',   minLevel:1,  effect:{atk:1} },
    short_sword:         { name:'Short Sword',            icon:'⚔️', desc:'+3 ATK',                 price:60,   type:'weapon',    slot:'mainhand',  tier:'common',   minLevel:1,  effect:{atk:3} },
    iron_sword:          { name:'Iron Sword',             icon:'⚔️', desc:'+4 ATK',                 price:80,   type:'weapon',    slot:'mainhand',  tier:'common',   minLevel:2,  effect:{atk:4} },
    hand_axe:            { name:'Hand Axe',               icon:'🪓', desc:'+4 ATK',                 price:75,   type:'weapon',    slot:'mainhand',  tier:'common',   minLevel:2,  effect:{atk:4} },
    hunting_bow:         { name:'Hunting Bow',            icon:'🏹', desc:'+3 ATK',                 price:70,   type:'weapon',    slot:'mainhand',  tier:'common',   minLevel:2,  effect:{atk:3} },
    oak_staff:           { name:'Oak Staff',              icon:'🪄', desc:'+3 ATK (magic)',         price:65,   type:'weapon',    slot:'mainhand',  tier:'common',   minLevel:1,  effect:{atk:3,magic:true} },
    steel_sword:         { name:'Steel Sword',            icon:'⚔️', desc:'+6 ATK',                 price:180,  type:'weapon',    slot:'mainhand',  tier:'uncommon', minLevel:4,  effect:{atk:6} },
    elven_blade:         { name:'Elven Blade',            icon:'⚔️', desc:'+7 ATK +1 DEX',         price:240,  type:'weapon',    slot:'mainhand',  tier:'uncommon', minLevel:5,  effect:{atk:7,dex:1} },
    battle_axe:          { name:'Battle Axe',             icon:'🪓', desc:'+8 ATK',                 price:220,  type:'weapon',    slot:'mainhand',  tier:'uncommon', minLevel:5,  effect:{atk:8} },
    longbow:             { name:'Longbow',                icon:'🏹', desc:'+6 ATK',                 price:200,  type:'weapon',    slot:'mainhand',  tier:'uncommon', minLevel:4,  effect:{atk:6} },
    magic_wand:          { name:'Magic Wand',             icon:'🪄', desc:'+6 ATK (magic)',         price:220,  type:'weapon',    slot:'mainhand',  tier:'uncommon', minLevel:4,  effect:{atk:6,magic:true} },
    bone_wand:           { name:'Bone Wand',              icon:'🦴', desc:'+7 ATK (magic)',         price:280,  type:'weapon',    slot:'mainhand',  tier:'uncommon', minLevel:5,  effect:{atk:7,magic:true} },
    crossbow:            { name:'Crossbow',               icon:'🏹', desc:'+8 ATK +1 DEX',         price:260,  type:'weapon',    slot:'mainhand',  tier:'uncommon', minLevel:6,  effect:{atk:8,dex:1} },
    mithril_sword:       { name:'Mithril Sword',          icon:'⚔️', desc:'+10 ATK +2 DEX',        price:600,  type:'weapon',    slot:'mainhand',  tier:'rare',     minLevel:7,  effect:{atk:10,dex:2} },
    serpent_fang:        { name:'Serpent Fang',           icon:'🗡️', desc:'+9 ATK, poison on hit', price:550,  type:'weapon',    slot:'mainhand',  tier:'rare',     minLevel:7,  effect:{atk:9,poison:true}, flavour:'The blade still weeps venom.' },
    war_hammer:          { name:'War Hammer',             icon:'🔨', desc:'+12 ATK -1 DEX',        price:580,  type:'weapon',    slot:'mainhand',  tier:'rare',     minLevel:8,  effect:{atk:12,dex:-1} },
    arcane_staff:        { name:'Arcane Staff',           icon:'🔮', desc:'+11 ATK (magic) +3 WIS',price:650,  type:'weapon',    slot:'mainhand',  tier:'rare',     minLevel:8,  effect:{atk:11,magic:true,wis:3} },
    eldritch_shard:      { name:'Eldritch Shard',         icon:'💎', desc:'+12 ATK (magic) +2 AC', price:700,  type:'weapon',    slot:'mainhand',  tier:'rare',     minLevel:9,  effect:{atk:12,magic:true,ac:2} },
    composite_bow:       { name:'Composite Bow',          icon:'🏹', desc:'+11 ATK +2 DEX',        price:620,  type:'weapon',    slot:'mainhand',  tier:'rare',     minLevel:8,  effect:{atk:11,dex:2} },
    frostbite:           { name:'Frostbite',              icon:'❄️', desc:'+15 ATK, freezes enemies',price:2000,type:'weapon',    slot:'mainhand',  tier:'legendary',minLevel:10, bossOnly:true, effect:{atk:15,freeze:true}, flavour:'Forged in the heart of the Glacial Tomb.' },
    inferno_edge:        { name:'Inferno Edge',           icon:'🔥', desc:'+16 ATK, burns on hit',  price:2200,type:'weapon',    slot:'mainhand',  tier:'legendary',minLevel:10, bossOnly:true, effect:{atk:16,burn:true}, flavour:'Pulled from the magma core of Ashspire.' },
    shadowbane:          { name:'Shadowbane',             icon:'🌑', desc:'+14 ATK +5 DEX',         price:2100,type:'weapon',    slot:'mainhand',  tier:'legendary',minLevel:11, bossOnly:true, effect:{atk:14,dex:5,acPen:2}, flavour:'It cuts through armour like shadow through light.' },
    staff_of_aeons:      { name:'Staff of Aeons',         icon:'✨', desc:'+18 ATK (magic) +6 WIS', price:2500,type:'weapon',    slot:'mainhand',  tier:'legendary',minLevel:12, bossOnly:true, effect:{atk:18,magic:true,wis:6}, flavour:'Older than the realm itself.' },
    bone_sovereign:      { name:'Bone Sovereign',         icon:'💀', desc:'+17 ATK, undead -50% dmg',price:2300,type:'weapon',   slot:'mainhand',  tier:'legendary',minLevel:11, bossOnly:true, effect:{atk:17,undeadWard:true}, flavour:"The Crypt King's own sceptre." },
    drowned_trident:     { name:'Drowned Trident',        icon:'🔱', desc:'+16 ATK +4 CON',         price:2400,type:'weapon',    slot:'mainhand',  tier:'legendary',minLevel:12, bossOnly:true, effect:{atk:16,con:4,onKillHp:8}, flavour:"The citadel's admiral wielded this against sea-gods." },
    leather_armor:       { name:'Leather Armour',         icon:'🥋', desc:'+2 AC',   price:50,   type:'armor',     slot:'chest',     tier:'common',   minLevel:1, effect:{ac:2} },
    chain_mail:          { name:'Chain Mail',             icon:'🛡️', desc:'+4 AC',   price:120,  type:'armor',     slot:'chest',     tier:'common',   minLevel:3, effect:{ac:4} },
    scale_mail:          { name:'Scale Mail',             icon:'🛡️', desc:'+5 AC',   price:200,  type:'armor',     slot:'chest',     tier:'uncommon', minLevel:5, effect:{ac:5} },
    plate_armor:         { name:'Plate Armour',           icon:'🛡️', desc:'+7 AC -1 DEX', price:450, type:'armor', slot:'chest',   tier:'rare',     minLevel:7, effect:{ac:7,dex:-1} },
    mithril_plate:       { name:'Mithril Plate',          icon:'🛡️', desc:'+9 AC +1 CON', price:800, type:'armor', slot:'chest',   tier:'rare',     minLevel:9, effect:{ac:9,con:1} },
    robes_of_arcana:     { name:'Robes of Arcana',        icon:'👘', desc:'+2 AC +4 WIS', price:400, type:'armor', slot:'chest',   tier:'rare',     minLevel:6, effect:{ac:2,wis:4} },
    dragonscale_armor:   { name:'Dragonscale Armour',     icon:'🐉', desc:'+11 AC +2 CON',price:2000,type:'armor', slot:'chest',   tier:'legendary',minLevel:11,bossOnly:true, effect:{ac:11,con:2}, flavour:'Each scale a trophy of a dead god.' },
    frozen_carapace:     { name:'Frozen Carapace',        icon:'❄️', desc:'+10 AC',       price:1800,type:'armor', slot:'chest',   tier:'legendary',minLevel:10,bossOnly:true, effect:{ac:10,coldImmune:true}, flavour:'Ice that has never melted.' },
    leather_cap:         { name:'Leather Cap',            icon:'🪖', desc:'+1 AC',   price:30,   type:'helmet',    slot:'head',      tier:'common',   minLevel:1, effect:{ac:1} },
    iron_helm:           { name:'Iron Helm',              icon:'🪖', desc:'+2 AC',   price:80,   type:'helmet',    slot:'head',      tier:'common',   minLevel:3, effect:{ac:2} },
    great_helm:          { name:'Great Helm',             icon:'🪖', desc:'+3 AC -1 DEX', price:180, type:'helmet', slot:'head',    tier:'uncommon', minLevel:5, effect:{ac:3,dex:-1} },
    mage_circlet:        { name:'Mage Circlet',           icon:'👑', desc:'+1 AC +3 INT', price:220, type:'helmet', slot:'head',    tier:'uncommon', minLevel:4, effect:{ac:1,int:3} },
    crown_of_thorns:     { name:'Crown of Thorns',        icon:'👑', desc:'+2 AC +2 STR', price:600, type:'helmet', slot:'head',    tier:'rare',     minLevel:7, effect:{ac:2,str:2,reflect:1} },
    helm_of_the_warden:  { name:'Helm of the Warden',     icon:'🪖', desc:'+5 AC +2 WIS', price:1600,type:'helmet', slot:'head',    tier:'legendary',minLevel:10,bossOnly:true, effect:{ac:5,wis:2}, flavour:"The Pale Warden's last possession." },
    pauldrons:           { name:'Iron Pauldrons',         icon:'🛡️', desc:'+2 AC',   price:90,   type:'shoulders', slot:'shoulders', tier:'common',   minLevel:3, effect:{ac:2} },
    spiked_shoulders:    { name:'Spiked Pauldrons',       icon:'🛡️', desc:'+3 AC +1 STR', price:240, type:'shoulders', slot:'shoulders', tier:'uncommon', minLevel:5, effect:{ac:3,str:1} },
    cloak_of_shadow:     { name:'Cloak of Shadow',        icon:'🧥', desc:'+1 AC +3 DEX', price:500, type:'shoulders', slot:'shoulders', tier:'rare', minLevel:7, effect:{ac:1,dex:3,encounterAvoid:0.1}, flavour:'Woven from shadow-spider silk.' },
    leather_greaves:     { name:'Leather Greaves',        icon:'👖', desc:'+1 AC',   price:35,   type:'pants',     slot:'pants',     tier:'common',   minLevel:1, effect:{ac:1} },
    chain_leggings:      { name:'Chain Leggings',         icon:'👖', desc:'+2 AC',   price:100,  type:'pants',     slot:'pants',     tier:'common',   minLevel:3, effect:{ac:2} },
    plate_legs:          { name:'Plate Leggings',         icon:'👖', desc:'+4 AC',   price:300,  type:'pants',     slot:'pants',     tier:'uncommon', minLevel:6, effect:{ac:4} },
    runic_leggings:      { name:'Runic Leggings',         icon:'👖', desc:'+3 AC +2 INT', price:500, type:'pants', slot:'pants',     tier:'rare',     minLevel:8, effect:{ac:3,int:2} },
    leather_boots:       { name:'Leather Boots',          icon:'👢', desc:'+5 Speed', price:40,  type:'boots',     slot:'boots',     tier:'common',   minLevel:1, effect:{speed:5} },
    elven_boots:         { name:'Elven Boots',            icon:'👢', desc:'+8 Speed +1 DEX', price:120, type:'boots', slot:'boots', tier:'uncommon', minLevel:3, effect:{speed:8,dex:1} },
    boots_of_striding:   { name:'Boots of Striding',      icon:'👢', desc:'+10 Speed +2 DEX', price:350, type:'boots', slot:'boots', tier:'rare',   minLevel:6, effect:{speed:10,dex:2} },
    shadowstep_boots:    { name:'Shadowstep Boots',       icon:'👢', desc:'+12 Speed +3 DEX', price:700, type:'boots', slot:'boots', tier:'rare',   minLevel:8, effect:{speed:12,dex:3,encounterAvoid:0.15}, flavour:'Each step lands in silence.' },
    boots_of_the_abyss:  { name:'Boots of the Abyss',     icon:'👢', desc:'+15 Speed +4 DEX', price:1900,type:'boots', slot:'boots', tier:'legendary',minLevel:11,bossOnly:true, effect:{speed:15,dex:4,encounterAvoid:0.2}, flavour:"The Drowned Admiral never needed a ship." },
    wooden_shield:       { name:'Wooden Shield',          icon:'🛡️', desc:'+2 AC',   price:45,   type:'shield',    slot:'offhand',   tier:'common',   minLevel:1, effect:{ac:2} },
    iron_shield:         { name:'Iron Shield',            icon:'🛡️', desc:'+3 AC',   price:110,  type:'shield',    slot:'offhand',   tier:'common',   minLevel:2, effect:{ac:3} },
    tower_shield:        { name:'Tower Shield',           icon:'🛡️', desc:'+5 AC -1 DEX', price:280, type:'shield', slot:'offhand', tier:'uncommon', minLevel:5, effect:{ac:5,dex:-1} },
    enchanted_buckler:   { name:'Enchanted Buckler',      icon:'🛡️', desc:'+3 AC +2 WIS', price:400, type:'shield', slot:'offhand', tier:'rare',     minLevel:7, effect:{ac:3,wis:2} },
    aegis_of_the_fallen: { name:'Aegis of the Fallen',    icon:'🛡️', desc:'+7 AC +3 CON', price:2000,type:'shield', slot:'offhand', tier:'legendary',minLevel:11,bossOnly:true, effect:{ac:7,con:3,negate:1}, flavour:'It has never broken. It never will.' },
    copper_ring:         { name:'Copper Ring',            icon:'💍', desc:'+1 ATK',  price:30,   type:'ring',      slot:'ring1',     tier:'common',   minLevel:1, effect:{atk:1} },
    silver_ring:         { name:'Silver Ring',            icon:'💍', desc:'+2 ATK',  price:80,   type:'ring',      slot:'ring1',     tier:'common',   minLevel:2, effect:{atk:2} },
    ring_of_strength:    { name:'Ring of Strength',       icon:'💍', desc:'+2 STR',  price:120,  type:'ring',      slot:'ring1',     tier:'uncommon', minLevel:3, effect:{str:2} },
    ring_of_arcana:      { name:'Ring of Arcana',         icon:'💍', desc:'+3 INT +5 MP', price:180, type:'ring',  slot:'ring1',     tier:'uncommon', minLevel:4, effect:{int:3,mp:5} },
    ring_of_protection:  { name:'Ring of Protection',     icon:'💍', desc:'+2 AC',   price:200,  type:'ring',      slot:'ring1',     tier:'uncommon', minLevel:4, effect:{ac:2} },
    band_of_vitality:    { name:'Band of Vitality',       icon:'💍', desc:'+3 CON +10 HP', price:350, type:'ring', slot:'ring1',     tier:'rare',     minLevel:6, effect:{con:3,hp:10} },
    ring_of_the_sage:    { name:'Ring of the Sage',       icon:'💍', desc:'+4 WIS +4 INT', price:500, type:'ring', slot:'ring1',     tier:'rare',     minLevel:8, effect:{wis:4,int:4} },
    ring_of_ages:        { name:'Ring of Ages',           icon:'💍', desc:'+3 to ALL stats', price:2200, type:'ring', slot:'ring1', tier:'legendary',minLevel:12,bossOnly:true, effect:{str:3,dex:3,con:3,int:3,wis:3,cha:3}, flavour:'Worn by the first king of the realm.' },
    wolf_fang_necklace:  { name:'Wolf Fang Necklace',     icon:'📿', desc:'+1 ATK +1 AC', price:80,  type:'necklace', slot:'necklace', tier:'common',  minLevel:2, effect:{atk:1,ac:1} },
    amulet_of_health:    { name:'Amulet of Health',       icon:'📿', desc:'+3 CON +15 HP', price:200, type:'necklace', slot:'necklace', tier:'uncommon',minLevel:4, effect:{con:3,hp:15} },
    pendant_of_mana:     { name:'Pendant of Mana',        icon:'📿', desc:'+3 WIS +20 MP', price:220, type:'necklace', slot:'necklace', tier:'uncommon',minLevel:4, effect:{wis:3,mp:20} },
    amulet_of_warding:   { name:'Amulet of Warding',      icon:'📿', desc:'+3 AC +2 CON',  price:400, type:'necklace', slot:'necklace', tier:'rare',    minLevel:7, effect:{ac:3,con:2} },
    necklace_of_dragon:  { name:'Necklace of the Dragon', icon:'🐉', desc:'+5 ATK +3 STR', price:1700,type:'necklace', slot:'necklace', tier:'legendary',minLevel:10,bossOnly:true, effect:{atk:5,str:3,fireResist:true}, flavour:'A tooth from Ashkar the Burned.' },
    goblin_ear:          { name:'Goblin Ear',      icon:'👂', desc:'Bounty item',           price:5,   type:'misc', tier:'common',    minLevel:1, effect:{} },
    wolf_pelt:           { name:'Wolf Pelt',       icon:'🐺', desc:'Soft fur',              price:12,  type:'misc', tier:'common',    minLevel:1, effect:{} },
    spider_silk:         { name:'Spider Silk',     icon:'🕸️', desc:'Strong fibre',         price:18,  type:'misc', tier:'common',    minLevel:2, effect:{} },
    venom_gland:         { name:'Venom Gland',     icon:'🐍', desc:'Alch. ingredient',     price:22,  type:'misc', tier:'common',    minLevel:2, effect:{} },
    bone_fragment:       { name:'Bone Fragment',   icon:'🦴', desc:'Craftable',             price:10,  type:'misc', tier:'common',    minLevel:1, effect:{} },
    troll_hide:          { name:'Troll Hide',      icon:'🟤', desc:'Tough leather',         price:35,  type:'misc', tier:'uncommon',  minLevel:4, effect:{} },
    dragon_scale:        { name:'Dragon Scale',    icon:'🐉', desc:'Incredibly tough',     price:120, type:'misc', tier:'rare',      minLevel:8, effect:{} },
    shadow_essence:      { name:'Shadow Essence',  icon:'🌑', desc:'Dark magic',            price:60,  type:'misc', tier:'uncommon',  minLevel:5, effect:{} },
    soul_shard:          { name:'Soul Shard',      icon:'💠', desc:'Trapped soul',          price:80,  type:'misc', tier:'rare',      minLevel:7, effect:{} },
    lich_phylactery:     { name:'Lich Phylactery', icon:'💀', desc:'Necro focus',           price:200, type:'misc', tier:'rare',      minLevel:9, effect:{} },
    frost_crystal:       { name:'Frost Crystal',   icon:'❄️', desc:'Magical ice',           price:90,  type:'misc', tier:'rare',      minLevel:8, effect:{} },
    magma_core:          { name:'Magma Core',      icon:'🌋', desc:'Still burning',         price:110, type:'misc', tier:'rare',      minLevel:8, effect:{} },
    ancient_rune:        { name:'Ancient Rune',    icon:'🔷', desc:'Powerful inscription',  price:150, type:'misc', tier:'rare',      minLevel:9, effect:{} },
    void_shard:          { name:'Void Shard',      icon:'🌀', desc:'Fragment of nothing',   price:300, type:'misc', tier:'legendary', minLevel:12,effect:{} },
  };

  window.getItem = function(id) {
    const def = window.ITEM_DB[id];
    return def ? { ...def, id, qty:1 } : null;
  };

  window.DUNGEON_LOOT_TABLES = {
    goblin_warrens:  { common:['goblin_ear','bone_fragment','health_potion','rusty_dagger','leather_cap'],    uncommon:['short_sword','leather_armor','wolf_fang_necklace','mana_potion'],               rare:['elven_blade','cloak_of_shadow','ring_of_strength'],                    legendary:['bone_sovereign'] },
    mossy_hollows:   { common:['spider_silk','venom_gland','health_potion','leather_boots'],                  uncommon:['antidote','elven_boots','leather_armor','hand_axe'],                           rare:['serpent_fang','shadowstep_boots','ring_of_protection'],                legendary:['shadowbane'] },
    forest_glades:   { common:['wolf_pelt','spider_silk','health_potion','oak_staff'],                        uncommon:['elven_blade','elven_boots','mage_circlet','mana_potion'],                      rare:['robes_of_arcana','composite_bow','cloak_of_shadow'],                   legendary:['staff_of_aeons'] },
    echoing_cavern:  { common:['bone_fragment','iron_helm','chain_mail','health_potion'],                     uncommon:['iron_shield','pauldrons','steel_sword','elixir'],                              rare:['war_hammer','plate_armor','band_of_vitality'],                          legendary:['aegis_of_the_fallen'] },
    sunken_ruins:    { common:['health_potion','leather_greaves','wooden_shield','mana_potion'],              uncommon:['chain_leggings','enchanted_buckler','longbow','elixir'],                       rare:['boots_of_striding','ring_of_protection','arcane_staff'],                legendary:['drowned_trident'] },
    elders_grove:    { common:['wolf_pelt','spider_silk','oak_staff','mana_potion'],                          uncommon:['robes_of_arcana','pendant_of_mana','bone_wand','greater_mana'],               rare:['ring_of_the_sage','runic_leggings','arcane_staff'],                     legendary:['staff_of_aeons'] },
    frostbound_keep: { common:['frost_crystal','iron_helm','chain_mail','greater_health'],                    uncommon:['great_helm','plate_legs','mithril_sword','elixir'],                            rare:['mithril_plate','crown_of_thorns','amulet_of_warding'],                  legendary:['frostbite','frozen_carapace','helm_of_the_warden'] },
    magma_pit:       { common:['magma_core','iron_shield','chain_leggings','greater_health'],                 uncommon:['battle_axe','plate_armor','spiked_shoulders','elixir'],                        rare:['war_hammer','eldritch_shard','band_of_vitality'],                       legendary:['inferno_edge','necklace_of_dragon'] },
    crypt_of_bones:  { common:['bone_fragment','lich_phylactery','soul_shard','greater_health'],              uncommon:['amulet_of_warding','ring_of_protection','plate_legs','elixir'],                rare:['mithril_plate','ring_of_the_sage','enchanted_buckler'],                 legendary:['bone_sovereign','aegis_of_the_fallen'] },
    sunken_throne:   { common:['health_potion','mana_potion','iron_shield','leather_greaves'],                uncommon:['chain_leggings','tower_shield','longbow','elixir'],                            rare:['boots_of_striding','amulet_of_warding','arcane_staff'],                 legendary:['drowned_trident','boots_of_the_abyss'] },
    _default:        { common:['health_potion','mana_potion','bone_fragment','leather_boots'],                uncommon:['short_sword','chain_mail','ring_of_strength'],                                 rare:['elven_blade','plate_armor','band_of_vitality'],                         legendary:['frostbite'] },
  };

  window.rollDungeonLoot = function(dungeonId, isBoss) {
    const t = window.DUNGEON_LOOT_TABLES[dungeonId] || window.DUNGEON_LOOT_TABLES._default;
    const d = [];
    if (Math.random()<.60) d.push(t.common[Math.floor(Math.random()*t.common.length)]);
    if (Math.random()<.35) d.push(t.uncommon[Math.floor(Math.random()*t.uncommon.length)]);
    if (Math.random()<.12) d.push(t.rare[Math.floor(Math.random()*t.rare.length)]);
    if (isBoss && t.legendary?.length && Math.random()<.40) d.push(t.legendary[Math.floor(Math.random()*t.legendary.length)]);
    return d.map(id=>window.getItem(id)).filter(Boolean);
  };

  window.rollWorldLoot = function(zoneLevel) {
    const d = [], pool = Object.entries(window.ITEM_DB).filter(([,i])=>!i.bossOnly&&(i.minLevel||1)<=zoneLevel+2);
    if (Math.random()<.50) { const e=pool.filter(([,i])=>i.tier==='common'||i.type==='misc'); if(e.length) d.push(e[Math.floor(Math.random()*e.length)][0]); }
    if (Math.random()<Math.min(.25,zoneLevel*.025)) { const e=pool.filter(([,i])=>i.tier==='uncommon'||i.tier==='rare'); if(e.length) d.push(e[Math.floor(Math.random()*e.length)][0]); }
    return d.map(id=>window.getItem(id)).filter(Boolean);
  };

  window.grantCombatLoot = function(enemies) {
    const isBoss = enemies.some(e=>e.isBoss||e.isCampBoss);
    const mapId  = window.GameState?.activeMap?.id||'_default';
    const drops  = window.GameState?.mode==='dungeon' ? window.rollDungeonLoot(mapId,isBoss) : window.rollWorldLoot(window.getZoneLevel?.()||1);
    drops.forEach(item=>{
      if(item.tier==='legendary'){window.addLog?.(`⭐ LEGENDARY: ${item.name}!`,'legendary');window.toast?.(`⭐ ${item.name}!`);}
      else if(item.tier==='rare'){window.addLog?.(`💎 Rare: ${item.icon} ${item.name}`,'loot');}
      else{window.addLog?.(`Found: ${item.icon} ${item.name}`,'loot');}
      window.addToInventory?.({...item});
    });
    return drops;
  };

  window.getTownTier = function(town) {
    if(!town) return 0;
    const d=Math.sqrt(((town.x||0)-120)**2+((town.y||0)-90)**2);
    return d<25?0:d<60?1:d<110?2:3;
  };

  const SHOP_POOLS = {
    0:{potions:['health_potion','mana_potion','antidote'],weapons:['rusty_dagger','short_sword','iron_sword','hunting_bow','oak_staff'],armor:['leather_armor','leather_cap','leather_greaves','leather_boots','wooden_shield'],jewelry:['copper_ring','wolf_fang_necklace']},
    1:{potions:['health_potion','greater_health','mana_potion','elixir','antidote'],weapons:['iron_sword','steel_sword','elven_blade','battle_axe','longbow','magic_wand','bone_wand'],armor:['chain_mail','scale_mail','iron_helm','pauldrons','chain_leggings','elven_boots','iron_shield'],jewelry:['silver_ring','ring_of_strength','amulet_of_health','pendant_of_mana']},
    2:{potions:['greater_health','superior_health','greater_mana','elixir'],weapons:['steel_sword','mithril_sword','war_hammer','arcane_staff','composite_bow','eldritch_shard'],armor:['plate_armor','mithril_plate','great_helm','plate_legs','boots_of_striding','tower_shield','robes_of_arcana'],jewelry:['ring_of_protection','band_of_vitality','ring_of_the_sage','amulet_of_warding']},
    3:{potions:['superior_health','greater_mana','elixir','elixir_of_gods'],weapons:['mithril_sword','arcane_staff','eldritch_shard','composite_bow','serpent_fang'],armor:['mithril_plate','plate_armor','crown_of_thorns','runic_leggings','shadowstep_boots','enchanted_buckler'],jewelry:['ring_of_the_sage','ring_of_arcana','amulet_of_warding','band_of_vitality']},
  };

  window.buildShopForTown = function(town) {
    const tier=window.getTownTier(town), pool=SHOP_POOLS[tier]||SHOP_POOLS[0], items=[];
    pool.potions.forEach(id=>{const i=window.getItem(id);if(i)items.push(i);});
    [...pool.weapons].sort(()=>Math.random()-.5).slice(0,4).forEach(id=>{const i=window.getItem(id);if(i)items.push(i);});
    [...pool.armor  ].sort(()=>Math.random()-.5).slice(0,5).forEach(id=>{const i=window.getItem(id);if(i)items.push(i);});
    [...pool.jewelry].sort(()=>Math.random()-.5).slice(0,3).forEach(id=>{const i=window.getItem(id);if(i)items.push(i);});
    return items;
  };

  let _shopItems=[];
  window.buildShop = function() {
    _shopItems=window.buildShopForTown(window.currentTown);
    const G=window.G, si=document.getElementById('shop-items');
    if(!si) return;
    const tierNames=['Starter Wares',"Adventurer's Stock","Veteran's Arsenal","Champion's Cache"];
    const hdr=document.querySelector('#svc-panel-shop .svc-panel-title');
    if(hdr) hdr.textContent=`⚒ ${tierNames[window.getTownTier(window.currentTown)]}`;
    si.innerHTML=_shopItems.map((item,i)=>{
      const ok=(G?.gold||0)>=item.price;
      const tc={common:'#888',uncommon:'#4a9eff',rare:'#c060ff',legendary:'#ffd700'}[item.tier]||'#888';
      return `<div class="shop-item" style="border-left:2px solid ${tc}40;"><div style="flex:1;"><div class="item-name" style="color:${tc};">${item.icon} ${item.name}</div><div class="item-stats">${item.desc}</div>${item.flavour?`<div style="font-size:.58rem;color:var(--parch-dk);font-style:italic;">"${item.flavour}"</div>`:''}</div><div style="display:flex;align-items:center;gap:6px;"><span class="item-price">${item.price}gp</span><button class="buy-btn" onclick="buyShopItem(${i})" ${ok?'':'disabled'}>Buy</button></div></div>`;
    }).join('');
  };

  window.buyShopItem = function(idx) {
    const G=window.G, item=_shopItems[idx];
    if(!G||!item) return;
    if(G.gold<item.price){window.toast?.('Not enough gold!','err');return;}
    if(!window.addToInventory?.({...item})) return;
    G.gold-=item.price;
    const tgd=document.getElementById('town-gold-disp'); if(tgd) tgd.textContent=G.gold;
    const hg=document.getElementById('hud-gold'); if(hg) hg.textContent=G.gold;
    window.playSound?.('buy');
    window.addLog?.(`Bought ${item.name} for ${item.price} gp.`,'sys');
    window.toast?.(`Purchased: ${item.name}`);
    window.buildShop();
  };
  window.buyItem = window.buyShopItem;

  window.PD_SLOTS = [
    {id:'head',label:'Head',icon:'🪖'},{id:'necklace',label:'Neck',icon:'📿'},
    {id:'shoulders',label:'Shoulders',icon:'🛡️'},{id:'chest',label:'Chest',icon:'👕'},
    {id:'offhand',label:'Off Hand',icon:'🛡️'},{id:'ring1',label:'Ring',icon:'💍'},
    {id:'pants',label:'Legs',icon:'👖'},{id:'ring2',label:'Ring',icon:'💍'},
    {id:'mainhand',label:'Weapon',icon:'⚔️'},{id:'boots',label:'Boots',icon:'👢'},
  ];

  window.SLOT_ACCEPTS_MAP = {
    head:['helmet','head','hat','crown'], shoulders:['shoulders','pauldrons','cloak'],
    chest:['armor','chest','robe','tunic'], pants:['pants','leggings','greaves'],
    boots:['boots','shoes'], mainhand:['weapon','sword','axe','bow','staff','wand','dagger'],
    offhand:['shield','offhand'], ring1:['ring'], ring2:['ring'], necklace:['necklace','amulet'],
  };

  window.getEquipSlotForItem = function(item) {
    if(!item?.type) return null;
    if(item.slot && window.SLOT_ACCEPTS_MAP[item.slot]) return item.slot;
    const t=item.type.toLowerCase();
    for(const [slot,types] of Object.entries(window.SLOT_ACCEPTS_MAP)) {
      if(types.some(a=>t.includes(a)||a.includes(t))) return slot;
    }
    const leg={weapon:'mainhand',armor:'chest',helmet:'head',boots:'boots',ring:'ring1',necklace:'necklace',shield:'offhand',shoulders:'shoulders',pants:'pants'};
    return leg[t]||null;
  };

  console.log('[Equipment System] ✅ v1.1 loaded');
})();
