import { DeathScreen }         from "../ui/DeathScreen.js";
import { LootWindow }          from "../ui/LootWindow.js";
import { InventoryWindow }     from "../ui/InventoryWindow.js";
import { LevelUpWindow }       from "../ui/LevelUpWindow.js";
import { CharacterSheet }      from "../ui/CharacterSheet.js";
import { AbilityPickWindow }   from "../ui/AbilityPickWindow.js";
import { InnWindow }           from "../ui/InnWindow.js";
import { ShopWindow }          from "../ui/ShopWindow.js";
import { TownNPCWindow }       from "../ui/TownNPCWindow.js";
import { getRankedAbility }    from "./ActionManager.js";

export class UIManager {
  constructor(engine) {
    this.engine = engine;

    this.charSheet = null;
    this.abilityPickWindow = null;
    this.inventoryWindow = null;
    this.levelUpWindow = null;
    this.lootWindow = null;
    this.townNPCWindow = null;
    this.deathScreen = null;
  }

  // ─────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────
  initPersistentWindows() {
    const { player, _abilities, _classes, _itemDefs, _skills } = this.engine;

    if (!this.charSheet) {
      this.charSheet = new CharacterSheet({
        player, abilities: _abilities, classes: _classes, itemDefs: _itemDefs, skills: _skills
      });
    }

    if (!this.abilityPickWindow) {
      this.abilityPickWindow = new AbilityPickWindow();
      this.abilityPickWindow.onPick    = (id) => this.learnAbility(id);
      this.abilityPickWindow.onUpgrade = (id) => this.upgradeAbility(id);
    }
  }

  buildWorldWindows() {
    const { player, lootSystem, _itemDefs, _skills, _playerClassId, xpSystem } = this.engine;

    // Inventory window
    this.inventoryWindow = new InventoryWindow({
      player, lootSystem, itemDefs: _itemDefs
    });

    // Level-up window
    const classSkills = _skills[_playerClassId] ?? [];
    this.levelUpWindow = new LevelUpWindow({
      player, classSkills, xpSystem
    });

    this.levelUpWindow.onConfirm = (skillId, replaceId, statDist) => {
      xpSystem.applySkillPick(skillId, replaceId);
      xpSystem.applyStatPoints(statDist);
      this.syncAbilityBar();
    };

    // Ensure persistent windows have the updated player ref after zone loads
    this.charSheet?.setPlayer(player);
  }

  closeAllWindows() {
    this.lootWindow?.hide();
    this.townNPCWindow?.hide();
    this.inventoryWindow?.hide();
  }

  // ─────────────────────────────────────────────
  // ABILITIES
  // ─────────────────────────────────────────────
  syncAbilityBar() {
    const { player, _abilities, renderer } = this.engine;
    renderer.playerAbilities = (player.abilities ?? [])
      .slice(0, 6)
      .map(id => {
        const base = _abilities?.[id];
        const rank = player.learnedSkills?.[id] ?? 1;
        return getRankedAbility(base, rank);
      })
      .filter(Boolean);
  }

  showAbilityPick(level) {
    const { _classes, _playerClassId, _abilities, player } = this.engine;
    const classDef = _classes[_playerClassId];
    if (!classDef) return;

    const basicId    = classDef.basicAttack ?? classDef.abilities?.[0];
    const poolIds    = classDef.abilityPool ?? (classDef.abilities ?? []).filter(id => id !== basicId);
    const learnedIds = (player.abilities ?? []).filter(id => id !== basicId);

    this.abilityPickWindow?.show({
      level, learnedIds, poolIds, abilityDefs: _abilities, upgrades: player.learnedSkills ?? {}
    });
  }

  learnAbility(abilityId) {
    const { _abilities, player, combatLog } = this.engine;
    const ab = _abilities[abilityId];
    if (!ab || (player.abilities ?? []).includes(abilityId)) return;
    if (player.abilities.length >= 6) {
      combatLog?.push({ text: "Ability bar full (max 6).", type: "system" }); return;
    }
    player.abilities.push(abilityId);
    if (!player.learnedSkills) player.learnedSkills = {};
    player.learnedSkills[abilityId] = 1;
    combatLog?.push({ text: `✦ Learned ${ab.name}!`, type: "kill" });
    this.syncAbilityBar();
  }

  upgradeAbility(abilityId) {
    const { _abilities, player, combatLog } = this.engine;
    const ab = _abilities[abilityId];
    if (!ab) return;
    if (!player.learnedSkills) player.learnedSkills = {};
    const rank = (player.learnedSkills[abilityId] ?? 1) + 1;
    player.learnedSkills[abilityId] = rank;
    combatLog?.push({ text: `✦ ${ab.name} upgraded to Rank ${rank}!`, type: "kill" });
    this.syncAbilityBar();
  }

  // ─────────────────────────────────────────────
  // INTERFACES (LOOT / NPC)
  // ─────────────────────────────────────────────
  openLootWindow(corpse) {
    const { lootSystem, _itemDefs } = this.engine;
    this.lootWindow?.hide();
    this.lootWindow = new LootWindow({ corpse, lootSystem, itemDefs: _itemDefs });
    this.lootWindow.onClose = () => { this.lootWindow = null; };
    this.lootWindow.show();
  }

  onNPCInteract(npc) {
    const { player, world, combatLog, _itemDefs, lootSystem } = this.engine;
    this.townNPCWindow?.hide();

    if (npc.role === "inn") {
      const win = new InnWindow({ npc, player, townData: world });
      win.onRest = () => {
        player.hp       = player.maxHp;
        player.resource = player.maxResource;

        this.engine._respawnPoint = {
          worldId: world.id,
          x:       world.entryPoint?.x ?? player.x,
          y:       world.entryPoint?.y ?? player.y
        };
        combatLog?.push({ text: `Rested at ${npc.innName}. Respawn point set.`, type: "system" });
      };
      win.show();

    } else if (npc.role === "shop") {
      const win = new ShopWindow({ npc, player, townData: world, itemDefs: _itemDefs, lootSystem });
      win.show();

    } else {
      const win = new TownNPCWindow({ npc });
      this.townNPCWindow = win;
      win.show();
    }
  }

  // ─────────────────────────────────────────────
  // DEATH SCREEN
  // ─────────────────────────────────────────────
  showDeathScreen(killerName, goldLost, xpLost) {
    const deathScreen = new DeathScreen({
      canvas:     this.engine.renderer.canvas,
      killerName,
      goldLost,
      xpLost
    });

    deathScreen.onRespawn = () => { this.engine._respawn(); };
    deathScreen.onQuit = () => {
      this.engine.saveManager.save().finally(() => {
        this.engine.running = false;
        this.engine.onQuitToTitle?.();
      });
    };

    this.deathScreen = deathScreen;
    deathScreen.show();
  }

  // ─────────────────────────────────────────────
  // PAUSE MENU
  // ─────────────────────────────────────────────
  togglePauseMenu() {
    this.engine._paused = !this.engine._paused;
    this.engine.renderer.paused = this.engine._paused;
  }

  handlePauseMenuClick(px, py) {
    const buttons = this.engine.renderer.getPauseMenuButtons();
    for (const btn of buttons) {
      if (px >= btn.x && px <= btn.x + btn.w && py >= btn.y && py <= btn.y + btn.h) {
        if (btn.id === "resume") {
          this.engine._paused = false;
          this.engine.renderer.paused = false;
        } else if (btn.id === "save") {
          this.engine.saveManager.save();
          this.engine._paused = false;
          this.engine.renderer.paused = false;
        } else if (btn.id === "quit") {
          this.engine.saveManager.save().finally(() => {
            this.engine.running = false;
            this.engine.onQuitToTitle?.();
          });
        }
        return;
      }
    }
    // Click outside panel closes menu
    this.engine._paused = false;
    this.engine.renderer.paused = false;
  }
}
