// ╔══════════════════════════════════════════════════════╗
// ║                  GAME MENU (UI ONLY)               ║
// ╚══════════════════════════════════════════════════════╝
//
// IMPORTANT:
// - UI / DOM ONLY
// - NO rendering
// - NO RAF
// - NO updateHUD / render calls
//

let _menuOpen = false;

// ---------- SAVE ----------

export function menuSave() {
  if (typeof window.saveGame === "function") {
    window.saveGame();
  }

  if (typeof window.cloudSyncNow === "function") {
    window.cloudSyncNow(false);
  }

  const el = document.getElementById("menu-status");
  if (el) {
    el.innerHTML = "✓ Saved at " + new Date().toLocaleTimeString();
  }
}

// ---------- OPEN / CLOSE ----------

export function openGameMenu() {
  const G = window.G;
  if (!G || !G.cls || !G.name) return;

  _menuOpen = true;

  const header = document.getElementById("menu-char-line");
  if (header) {
    header.textContent =
      `${G.name} · ${G.race?.name || "?"} ${G.cls?.name || "?"} · Level ${G.level}`;
  }

  const parts = [];
  if (G.inCombat) parts.push("⚔ In combat");

  if (window.campState) {
    const c = window.campState;
    parts.push(
      `📜 Campaign: ${c.camp.name} (Room ${c.prog.roomIdx + 1}/${c.camp.rooms.length})`
    );
  }

  if (window.coopActive) {
    const count = (window.coopParty || []).filter(Boolean).length;
    parts.push(`👥 Party: ${count} members`);
  }

  parts.push(`💰 ${G.gold} gp · ${G.hp}/${G.hpMax} HP`);

  const status = document.getElementById("menu-status");
  if (status) {
    status.innerHTML = parts.join("<br>");
  }

  const inCamp = !!window.campState;
  const canPause = inCamp && !G.inCombat;

  const pauseBtn = document.getElementById("menu-btn-pause-camp");
  const exitBtn  = document.getElementById("menu-btn-exit-camp");

  if (pauseBtn) pauseBtn.style.display = canPause ? "block" : "none";
  if (exitBtn)  exitBtn.style.display  = inCamp ? "block" : "none";

  document.getElementById("ov-menu")?.classList.add("active");
}

export function closeGameMenu() {
  _menuOpen = false;
  document.getElementById("ov-menu")?.classList.remove("active");
}

// ---------- SIMPLE ACTIONS ----------

export function menuResume() {
  closeGameMenu();
}

export function menuShowSyncInfo() {
  closeGameMenu();

  if (!window.getPlayerToken) return;

  const tok = window.getPlayerToken();
  if (!tok) return;

  const short = tok.slice(0, 8) + "…" + tok.slice(-4);
  const msg =
    `Your Player ID:\n${tok}\n\n` +
    `This ID links your character to the cloud.\n` +
    `Copy it to play on another device.\n\n` +
    `Press OK to copy to clipboard.`;

  if (confirm(msg)) {
    navigator.clipboard?.writeText(tok)
      .then(() => window.toast && window.toast("Player ID copied!"))
      .catch(() => window.toast && window.toast("ID: " + short));
  }
}

// ---------- CAMPAIGN CONTROLS ----------

export function menuPauseCampaign() {
  closeGameMenu();

  const G = window.G;
  const camp = window.campState;
  if (!G || !camp) return;

  camp.prog.sessionCount = (camp.prog.sessionCount || 0) + 1;

  if (window.saveGame) window.saveGame();

  document.getElementById("ov-campaign")?.classList.remove("active");
  document.getElementById("ov-combat")?.classList.remove("active");

  G.inTown = false;
  G.inCombat = false;
}

export function menuExitCampaign() {
  closeGameMenu();

  window.campState = null;

  const G = window.G;
  if (G) {
    G.inTown = false;
    G.inCombat = false;
  }

  if (window.saveGame) window.saveGame();
}

export function menuReturnToWorld() {
  closeGameMenu();

  const overlays = [
    "ov-campaign","ov-combat","ov-town","ov-portal",
    "ov-session-pause","ov-levelup","ov-item","ov-charsheet",
    "ov-menu","ov-inventory"
  ];

  overlays.forEach(id => {
    document.getElementById(id)?.classList.remove("active");
  });

  if (window.G) {
    window.G.inTown = false;
    window.G.inCombat = false;
  }

  window.campState = null;
  if (window.saveGame) window.saveGame();
}

export function menuNewChar() {
  closeGameMenu();
  document.getElementById("screen-game")?.classList.remove("active");
  window.showCharSelect?.();
}
