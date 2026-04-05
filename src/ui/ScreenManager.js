/**
 * ScreenManager.js
 *
 * Manages the pre-game HTML overlay screens:
 *   - Character Select (load existing or create new)
 *   - Character Creation (4-step: Name+Race → Class → Stats → Review)
 *
 * Both screens live inside a single #roe-screen overlay div injected into
 * document.body. The overlay is removed entirely when the game starts.
 *
 * Requires: src/styles/screens.css loaded in index.html
 *
 * Usage:
 *   const mgr = new ScreenManager({ slots, saveProvider, classes, abilities });
 *   mgr.onPlay   = (slotIndex, saveData) => { ... };   // load existing
 *   mgr.onCreate = (slotIndex, character) => { ... };  // new character confirmed
 *   mgr.show();
 */

const RACES = [
  { id: "human",    icon: "🧑",  name: "Human",    bonus: "+1 all stats" },
  { id: "elf",      icon: "🧝",  name: "Elf",      bonus: "+2 DEX, +1 INT" },
  { id: "dwarf",    icon: "⛏️", name: "Dwarf",    bonus: "+2 CON, +1 STR" },
  { id: "halfling", icon: "🌿",  name: "Halfling", bonus: "+2 DEX, +1 CHA" },
  { id: "half-orc", icon: "💪",  name: "Half-Orc", bonus: "+2 STR, +1 CON" },
  { id: "tiefling", icon: "😈",  name: "Tiefling", bonus: "+2 INT, +1 CHA" },
];

const CLASS_META = {
  fighter: { icon: "⚔️",  role: "Melee DPS",  tags: ["strength","armor","melee"],   primaryStat: "STR" },
  ranger:  { icon: "🏹",  role: "Ranged DPS", tags: ["dexterity","ranged","nature"], primaryStat: "DEX" },
};

const STAT_NAMES  = ["STR","DEX","INT","CON","WIS","CHA"];
const MAX_REROLLS = 3;

export class ScreenManager {
  constructor({ slots, saveProvider, classes, abilities }) {
    this.slots        = slots;
    this.saveProvider = saveProvider;
    this.classes      = classes;
    this.abilities    = abilities;

    // Callbacks
    this.onPlay   = null; // (slotIndex, saveData) => {}
    this.onCreate = null; // (slotIndex, character) => {}

    // Creation state
    this._step     = null;
    this._name     = "";
    this._raceId   = null;
    this._classId  = null;
    this._stats    = null;
    this._rerolls  = MAX_REROLLS;
    this._newSlot  = 0;

    this._overlay  = null;
    this._raf      = null;
  }

  // ─────────────────────────────────────────────
  // PUBLIC
  // ─────────────────────────────────────────────

  show() {
    this._buildOverlay();
    this._showCharSelect();
    this._startParticles();
  }

  hide() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    this._overlay?.remove();
    this._overlay = null;
  }

  // ─────────────────────────────────────────────
  // OVERLAY
  // ─────────────────────────────────────────────

  _buildOverlay() {
    this._overlay = document.createElement("div");
    this._overlay.id = "roe-screen";
    document.body.appendChild(this._overlay);

    const pc = document.createElement("canvas");
    pc.id = "roe-particles";
    this._overlay.appendChild(pc);
    this._particleCanvas = pc;
  }

  _setContent(html) {
    // Remove any existing content except particles
    [...this._overlay.children].forEach(c => {
      if (c.id !== "roe-particles") c.remove();
    });
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:relative;z-index:2;width:100%;display:flex;flex-direction:column;align-items:center;";
    wrap.innerHTML = html;
    this._overlay.appendChild(wrap);
    return wrap;
  }

  // ─────────────────────────────────────────────
  // CHARACTER SELECT
  // ─────────────────────────────────────────────

  _showCharSelect() {
    const playerToken = localStorage.getItem("roe_player_token") ?? "—";
    const shortToken  = playerToken.substring(0, 8) + "…";

    const slotsHtml = this.slots.map((data, i) => {
      if (data) {
        const classDef   = this.classes[data.classId] ?? {};
        const classMeta  = CLASS_META[data.classId]   ?? {};
        const race       = RACES.find(r => r.id === data.raceId);
        const savedDate  = data.savedAt ? new Date(data.savedAt).toLocaleDateString() : "";
        return `
          <div class="char-slot filled">
            <div class="char-slot-inner">
              <div class="char-slot-portrait">${classMeta.icon ?? "⚔️"}</div>
              <div class="char-slot-info">
                <div class="char-slot-name">${this._esc(data.name)}</div>
                <div class="char-slot-sub">${race?.name ?? ""} ${classDef.name ?? ""}</div>
                <div class="char-slot-meta">${savedDate ? "Saved " + savedDate : ""} · ${data.gold ?? 0} gp</div>
              </div>
              <div class="char-slot-actions">
                <button class="cs-play-btn" data-slot="${i}">Play →</button>
                <button class="cs-del-btn"  data-del="${i}">✕</button>
              </div>
            </div>
          </div>`;
      } else {
        return `
          <div class="char-slot empty" data-new="${i}">
            <div class="char-slot-inner">
              <div class="char-slot-portrait" style="font-size:1.4rem;color:var(--border-b);">+</div>
              <div class="char-slot-info">
                <div class="char-slot-empty-label">Empty Slot ${i + 1} — Create New Character</div>
              </div>
            </div>
          </div>`;
      }
    }).join("");

    const wrap = this._setContent(`
      <div class="cs-wrap">
        <div style="text-align:center;margin-bottom:28px;">
          <div class="cs-game-title">Realm of Echoes</div>
          <div class="cs-screen-title">Your Adventures</div>
          <div class="cs-divider"><span>✦ choose your hero ✦</span></div>
        </div>
        <div class="char-slots">${slotsHtml}</div>
        <button class="cs-new-btn" id="cs-new-btn">✦ Create New Character</button>
        <div class="cs-token-row">
          <span class="cs-token-label">Player ID:</span>
          <span class="cs-token-val" id="cs-token-val">${shortToken}</span>
          <button class="cs-token-btn" id="cs-copy-btn">Copy</button>
          <button class="cs-token-btn" id="cs-import-btn">Import</button>
        </div>
      </div>
    `);

    // Events — play buttons
    wrap.querySelectorAll(".cs-play-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.slot);
        this.hide();
        this.onPlay?.(idx, this.slots[idx]);
      });
    });

    // Events — empty slot click = new character in that slot
    wrap.querySelectorAll(".char-slot.empty").forEach(el => {
      el.addEventListener("click", () => {
        const idx = parseInt(el.dataset.new);
        this._newSlot = idx;
        this._showCreation();
      });
    });

    // Events — delete buttons
    wrap.querySelectorAll(".cs-del-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.del);
        this._showDeleteConfirm(idx);
      });
    });

    // New character button — finds first empty slot
    wrap.querySelector("#cs-new-btn").addEventListener("click", () => {
      const idx = this.slots.findIndex(s => s === null);
      this._newSlot = idx >= 0 ? idx : 0;
      this._showCreation();
    });

    // Token buttons
    wrap.querySelector("#cs-copy-btn").addEventListener("click", () => {
      const token = localStorage.getItem("roe_player_token") ?? "";
      navigator.clipboard?.writeText(token);
      const el = wrap.querySelector("#cs-token-val");
      el.textContent = "Copied!";
      setTimeout(() => el.textContent = shortToken, 1500);
    });

    wrap.querySelector("#cs-import-btn").addEventListener("click", () => {
      const token = prompt("Paste your Player ID:");
      if (token?.trim()) {
        localStorage.setItem("roe_player_token", token.trim());
        location.reload();
      }
    });
  }

  _showDeleteConfirm(slotIndex) {
    const data = this.slots[slotIndex];
    if (!data) return;

    const confirmEl = document.createElement("div");
    confirmEl.className = "cs-confirm-overlay";
    confirmEl.style.zIndex = "200";
    confirmEl.innerHTML = `
      <div class="cs-confirm-box">
        <div style="font-family:'Cinzel',serif;font-size:.8rem;color:var(--gold-b);margin-bottom:10px;">
          Delete ${this._esc(data.name)}?
        </div>
        <p>This cannot be undone.</p>
        <div class="cs-confirm-btns">
          <button class="btn btn-back" id="cc-cancel">Cancel</button>
          <button class="btn btn-enter" id="cc-confirm" style="padding:10px 22px;font-size:.75rem;">Delete</button>
        </div>
      </div>
    `;

    this._overlay.appendChild(confirmEl);

    confirmEl.querySelector("#cc-cancel").addEventListener("click", () => confirmEl.remove());
    confirmEl.querySelector("#cc-confirm").addEventListener("click", async () => {
      await this.saveProvider.delete(slotIndex + 1);
      this.slots[slotIndex] = null;
      confirmEl.remove();
      this._showCharSelect();
    });
  }

  // ─────────────────────────────────────────────
  // CHARACTER CREATION
  // ─────────────────────────────────────────────

  _showCreation() {
    this._step    = 1;
    this._name    = "";
    this._raceId  = null;
    this._classId = null;
    this._stats   = null;
    this._rerolls = MAX_REROLLS;
    this._renderStep();
  }

  _renderStep() {
    const dotsHtml = [1,2,3,4].map(i =>
      `<div class="sdot ${i === this._step ? "active" : i < this._step ? "done" : ""}"></div>`
    ).join("");

    const wrap = this._setContent(`
      <div class="cc-wrap">
        <header style="text-align:center;margin-bottom:28px;">
          <div class="realm-title">Realm of Echoes</div>
          <div class="forge-title">Forge Your Fate</div>
          <div class="orn">✦</div>
        </header>
        <div class="step-dots">${dotsHtml}</div>
        <div id="cc-step-content"></div>
      </div>
    `);

    const content = wrap.querySelector("#cc-step-content");

    switch (this._step) {
      case 1: this._renderNameRace(content);  break;
      case 2: this._renderClass(content);     break;
      case 3: this._renderStats(content);     break;
      case 4: this._renderReview(content);    break;
    }
  }

  // Step 1 — Name + Race
  _renderNameRace(container) {
    const racesHtml = RACES.map(r => `
      <div class="rcard ${this._raceId === r.id ? "sel" : ""}" data-race="${r.id}">
        <div class="rice">${r.icon}</div>
        <div class="rname">${r.name}</div>
        <div class="rbonus">${r.bonus}</div>
      </div>`).join("");

    container.innerHTML = `
      <div class="card">
        <div class="card-inner">
          <div class="ctitle">I — Name &amp; Heritage</div>
          <div class="name-wrap">
            <input type="text" id="inp-name" maxlength="20" autocomplete="off"
                   placeholder="Your name…" value="${this._esc(this._name)}">
            <div class="name-hint">What do the bards call you?</div>
          </div>
          <div class="ctitle" style="margin-top:18px;">Choose Your Race</div>
          <div class="race-grid">${racesHtml}</div>
          <div class="nav-row">
            <button class="btn btn-back" id="btn-back1">← Select</button>
            <span class="step-lbl">1 of 4</span>
            <button class="btn btn-next" id="btn-next1" ${!(this._name.trim() && this._raceId) ? "disabled" : ""}>Next →</button>
          </div>
        </div>
      </div>`;

    const inp = container.querySelector("#inp-name");
    inp.focus();
    inp.addEventListener("input", e => {
      this._name = e.target.value;
      container.querySelector("#btn-next1").disabled = !(this._name.trim() && this._raceId);
    });

    container.querySelectorAll(".rcard").forEach(el => {
      el.addEventListener("click", () => {
        this._raceId = el.dataset.race;
        container.querySelectorAll(".rcard").forEach(c => c.classList.remove("sel"));
        el.classList.add("sel");
        container.querySelector("#btn-next1").disabled = !(this._name.trim() && this._raceId);
      });
    });

    container.querySelector("#btn-back1").addEventListener("click", () => this._showCharSelect());
    container.querySelector("#btn-next1").addEventListener("click", () => { this._step = 2; this._renderStep(); });
  }

  // Step 2 — Class
  _renderClass(container) {
    const classesHtml = Object.entries(this.classes)
      .filter(([id]) => CLASS_META[id])
      .map(([id, def]) => {
        const meta   = CLASS_META[id];
        const abils  = (def.abilities ?? []).map(aid => this.abilities[aid]?.name ?? aid).join(", ");
        const tags   = meta.tags.map((t, i) => `<span class="ctag ${i===0?"pri":""}">${t}</span>`).join("");
        return `
          <div class="clcard ${this._classId === id ? "sel" : ""}" data-class="${id}">
            <div class="cl-hd"><span class="cl-ic">${meta.icon}</span><span class="cl-nm">${def.name}</span></div>
            <div class="cl-role">${meta.role} · ${meta.primaryStat}</div>
            <div class="cl-desc">${def.description}</div>
            <div class="cl-tags">${tags}</div>
            <div class="cl-abilities">Abilities: <span>${abils}</span></div>
          </div>`;
      }).join("");

    container.innerHTML = `
      <div class="card">
        <div class="card-inner">
          <div class="ctitle">II — Choose Your Path</div>
          <div class="class-grid">${classesHtml}</div>
          <div class="nav-row">
            <button class="btn btn-back" id="btn-back2">← Back</button>
            <span class="step-lbl">2 of 4</span>
            <button class="btn btn-next" id="btn-next2" ${!this._classId ? "disabled" : ""}>Next →</button>
          </div>
        </div>
      </div>`;

    container.querySelectorAll(".clcard").forEach(el => {
      el.addEventListener("click", () => {
        this._classId = el.dataset.class;
        container.querySelectorAll(".clcard").forEach(c => c.classList.remove("sel"));
        el.classList.add("sel");
        container.querySelector("#btn-next2").disabled = false;
      });
    });

    container.querySelector("#btn-back2").addEventListener("click", () => { this._step = 1; this._renderStep(); });
    container.querySelector("#btn-next2").addEventListener("click", () => {
      if (!this._stats) this._stats = this._rollAll();
      this._step = 3; this._renderStep();
    });
  }

  // Step 3 — Stats
  _renderStats(container) {
    const blocksHtml = STAT_NAMES.map(name => {
      const val  = this._stats[name];
      const mod  = Math.floor((val - 10) / 2);
      const modS = mod >= 0 ? `+${mod}` : `${mod}`;
      const modC = mod > 0 ? "pos" : mod < 0 ? "neg" : "zero";
      const dice = this._genDice(val);
      const diceHtml = dice.map((d, i) =>
        `<div class="die ${d.kept ? "kept" : "dropped"}" id="die-${name}-${i}">${d.val}</div>`
      ).join("");

      return `
        <div class="sblock" id="sb-${name}">
          <div class="sl-row"><span class="sname">${name}</span></div>
          <div class="sv-row">
            <div class="sval" id="sv-${name}">${val}</div>
            <div class="smod ${modC}">${modS}</div>
          </div>
          <div class="dice-row">${diceHtml}</div>
        </div>`;
    }).join("");

    const totalRaw = STAT_NAMES.reduce((s, n) => s + this._stats[n], 0);
    const totalMod = STAT_NAMES.reduce((s, n) => s + Math.floor((this._stats[n] - 10) / 2), 0);

    container.innerHTML = `
      <div class="card">
        <div class="card-inner">
          <div class="ctitle">III — Ability Scores</div>
          <button class="roll-btn" id="roll-btn" ${this._rerolls <= 0 ? "disabled" : ""}>⚄ Roll All Abilities</button>
          <div class="reroll-note" id="reroll-note">${this._rerolls > 0 ? `${this._rerolls} reroll${this._rerolls !== 1 ? "s" : ""} remaining` : "No rerolls remaining"}</div>
          <div class="stats-grid">${blocksHtml}</div>
          <div class="stats-sum">
            <div class="sum-item"><div class="sum-lbl">Total</div><div class="sum-val" id="sum-total">${totalRaw}</div></div>
            <div class="sum-item"><div class="sum-lbl">Modifier Sum</div><div class="sum-val" id="sum-mod">${totalMod >= 0 ? "+" : ""}${totalMod}</div></div>
          </div>
          <div class="nav-row">
            <button class="btn btn-back" id="btn-back3">← Back</button>
            <span class="step-lbl">3 of 4</span>
            <button class="btn btn-next" id="btn-next3">Review →</button>
          </div>
        </div>
      </div>`;

    container.querySelector("#roll-btn").addEventListener("click", () => {
      if (this._rerolls <= 0) return;
      this._rerolls--;
      this._animateRoll(container);
    });

    container.querySelector("#btn-back3").addEventListener("click", () => { this._step = 2; this._renderStep(); });
    container.querySelector("#btn-next3").addEventListener("click", () => { this._step = 4; this._renderStep(); });
  }

  _animateRoll(container) {
    const newStats = this._rollAll();

    STAT_NAMES.forEach((name, i) => {
      setTimeout(() => {
        container.querySelector(`#sb-${name}`)?.classList.add("rolling");
        setTimeout(() => container.querySelector(`#sb-${name}`)?.classList.remove("rolling"), 400);

        const newDice = this._genDice(newStats[name]);
        newDice.forEach((d, di) => {
          const el = container.querySelector(`#die-${name}-${di}`);
          if (!el) return;
          el.classList.add("spin");
          setTimeout(() => {
            el.textContent = d.val;
            el.className   = `die ${d.kept ? "kept" : "dropped"}`;
          }, 180);
        });

        const valEl = container.querySelector(`#sv-${name}`);
        if (valEl) setTimeout(() => { valEl.textContent = newStats[name]; }, 180);

      }, i * 80);
    });

    setTimeout(() => {
      this._stats = newStats;
      const totalRaw = STAT_NAMES.reduce((s, n) => s + this._stats[n], 0);
      const totalMod = STAT_NAMES.reduce((s, n) => s + Math.floor((this._stats[n] - 10) / 2), 0);
      const st = container.querySelector("#sum-total");
      const sm = container.querySelector("#sum-mod");
      if (st) st.textContent = totalRaw;
      if (sm) sm.textContent = `${totalMod >= 0 ? "+" : ""}${totalMod}`;
      const note = container.querySelector("#reroll-note");
      const btn  = container.querySelector("#roll-btn");
      if (note) note.textContent = this._rerolls > 0 ? `${this._rerolls} reroll${this._rerolls !== 1 ? "s" : ""} remaining` : "No rerolls remaining";
      if (btn)  btn.disabled = this._rerolls <= 0;
    }, STAT_NAMES.length * 80 + 400);
  }

  // Step 4 — Review
  _renderReview(container) {
    const classDef  = this.classes[this._classId] ?? {};
    const classMeta = CLASS_META[this._classId]   ?? {};
    const race      = RACES.find(r => r.id === this._raceId);

    const statCells = STAT_NAMES.map(name => {
      const val = this._stats[name];
      const mod = Math.floor((val - 10) / 2);
      return `<div class="csm">
        <div class="csm-n">${name}</div>
        <div class="csm-v">${val}</div>
        <div class="csm-m">${mod >= 0 ? "+" : ""}${mod}</div>
      </div>`;
    }).join("");

    container.innerHTML = `
      <div class="card">
        <div class="card-inner">
          <div class="ctitle">IV — Character Sheet</div>
          <div class="confirm-lay">
            <div class="portrait-box">
              <div class="portrait-icon">${classMeta.icon ?? "⚔️"}</div>
              <div class="portrait-name">${this._esc(this._name)}</div>
              <div class="portrait-sub">${race?.name ?? ""} ${classDef.name ?? ""}</div>
              <div class="portrait-sub" style="color:var(--gold-b)">${race?.bonus ?? ""}</div>
            </div>
            <div>
              <div class="sh-row"><span class="sh-k">Name</span><span class="sh-v gold">${this._esc(this._name)}</span></div>
              <div class="sh-row"><span class="sh-k">Race</span><span class="sh-v">${race?.name ?? ""}</span></div>
              <div class="sh-row"><span class="sh-k">Class</span><span class="sh-v">${classDef.name ?? ""}</span></div>
              <div class="sh-row"><span class="sh-k">Level</span><span class="sh-v">1</span></div>
              <div class="sh-row"><span class="sh-k">Hit Points</span><span class="sh-v gold">${classDef.baseStats?.hp ?? "—"}</span></div>
              <div class="sh-row"><span class="sh-k">Gold</span><span class="sh-v gold">50 gp</span></div>
              <div class="csm-grid">${statCells}</div>
            </div>
          </div>
          <div class="nav-row">
            <button class="btn btn-back" id="btn-back4">← Back</button>
            <button class="btn btn-enter" id="btn-enter">⚔ Enter the Realm</button>
          </div>
        </div>
      </div>`;

    container.querySelector("#btn-back4").addEventListener("click", () => { this._step = 3; this._renderStep(); });
    container.querySelector("#btn-enter").addEventListener("click", async () => {
      this.hide();
      await this.onCreate?.(this._newSlot, {
        name:    this._name.trim(),
        raceId:  this._raceId,
        classId: this._classId,
        stats:   { ...this._stats }
      });
    });
  }

  // ─────────────────────────────────────────────
  // DICE ROLLING
  // ─────────────────────────────────────────────

  _rollAll() {
    return Object.fromEntries(STAT_NAMES.map(s => [s, this._roll4d6()]));
  }

  _roll4d6() {
    const dice = Array.from({ length: 4 }, () => Math.ceil(Math.random() * 6));
    dice.sort((a, b) => a - b);
    return dice.slice(1).reduce((a, b) => a + b, 0);
  }

  _genDice(total) {
    const dice = Array.from({ length: 4 }, () => Math.ceil(Math.random() * 6));
    dice.sort((a, b) => a - b);
    return dice.map((val, i) => ({ val, kept: i > 0 }));
  }

  // ─────────────────────────────────────────────
  // PARTICLES
  // ─────────────────────────────────────────────

  _startParticles() {
    const canvas = this._particleCanvas;
    const ctx    = canvas.getContext("2d");
    const pts    = Array.from({ length: 40 }, () => this._newParticle(canvas));

    const tick = () => {
      if (!this._overlay) return;
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;

      for (const p of pts) {
        p.y -= p.speed; p.x += p.drift; p.life--;
        if (p.life <= 0 || p.y < 0) Object.assign(p, this._newParticle(canvas));
        const a = Math.min(1, p.life / 40) * p.alpha;
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }

      this._raf = requestAnimationFrame(tick);
    };
    tick();
  }

  _newParticle(canvas) {
    const ember = Math.random() > 0.5;
    return {
      x: Math.random() * (canvas.width  || window.innerWidth),
      y: (canvas.height || window.innerHeight) + 10,
      speed: 0.4 + Math.random() * 1.2,
      drift: (Math.random() - 0.5) * 0.4,
      size:  0.5 + Math.random() * 1.8,
      life:  60 + Math.random() * 120,
      alpha: 0.3 + Math.random() * 0.5,
      r: ember ? 220 : 180, g: ember ? 100 : 160, b: ember ? 20 : 220,
    };
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  _esc(str) {
    return (str ?? "")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
}
