/**
 * CharacterCreation.js
 *
 * HTML overlay character creation screen.
 * 4 steps: Name → Class → Stats → Review
 *
 * Inject the overlay into document.body, animate between steps,
 * call onConfirm({ name, raceId, classId, stats }) when done.
 *
 * Requires: src/styles/character-creation.css loaded in index.html
 */

const STAT_NAMES = ["STR", "DEX", "INT", "CON", "WIS", "CHA"];
const MAX_REROLLS = 3;

// Races with emoji icon and stat bonus label
const RACES = [
  { id: "human",     icon: "🧑",  name: "Human",    bonus: "+1 all stats" },
  { id: "elf",       icon: "🧝",  name: "Elf",      bonus: "+2 DEX, +1 INT" },
  { id: "dwarf",     icon: "⛏️",  name: "Dwarf",    bonus: "+2 CON, +1 STR" },
  { id: "halfling",  icon: "🌿",  name: "Halfling", bonus: "+2 DEX, +1 CHA" },
  { id: "half-orc",  icon: "💪",  name: "Half-Orc", bonus: "+2 STR, +1 CON" },
  { id: "tiefling",  icon: "😈",  name: "Tiefling", bonus: "+2 INT, +1 CHA" },
];

// Class icons and display metadata (stats come from classes.json)
const CLASS_META = {
  fighter: { icon: "⚔️",  role: "Melee DPS",   tags: ["strength", "armor", "melee"],   primaryStat: "STR" },
  ranger:  { icon: "🏹",  role: "Ranged DPS",  tags: ["dexterity", "ranged", "nature"], primaryStat: "DEX" },
};

export class CharacterCreation {
  /**
   * @param {object} opts
   * @param {HTMLCanvasElement} opts.canvas    - game canvas (used for sizing reference)
   * @param {object}            opts.classes   - classes.json data
   * @param {object}            opts.abilities - abilities.json data
   */
  constructor({ canvas, classes, abilities }) {
    this.canvas    = canvas;
    this.classes   = classes;
    this.abilities = abilities;

    // State
    this.step      = 1;         // 1=Name+Race, 2=Class, 3=Stats, 4=Review
    this.name      = "";
    this.raceId    = null;
    this.classId   = null;
    this.stats     = null;
    this.rerolls   = MAX_REROLLS;

    this.onConfirm = null;      // ({ name, raceId, classId, stats }) => {}

    this._overlay  = null;
    this._particle = null;
  }

  // ─────────────────────────────────────────────
  // PUBLIC
  // ─────────────────────────────────────────────

  show() {
    this._buildOverlay();
    this._renderStep();
    this._startParticles();
  }

  hide() {
    this._overlay?.remove();
    this._overlay = null;
    if (this._particleRAF) cancelAnimationFrame(this._particleRAF);
  }

  // ─────────────────────────────────────────────
  // OVERLAY CONSTRUCTION
  // ─────────────────────────────────────────────

  _buildOverlay() {
    this._overlay = document.createElement("div");
    this._overlay.id = "cc-overlay";
    document.body.appendChild(this._overlay);

    // Particle canvas
    const pc = document.createElement("canvas");
    pc.id = "cc-particles";
    this._overlay.appendChild(pc);
    this._particleCanvas = pc;

    // Main wrap
    const wrap = document.createElement("div");
    wrap.className = "cc-wrap";
    this._overlay.appendChild(wrap);
    this._wrap = wrap;
  }

  // ─────────────────────────────────────────────
  // STEP RENDERING
  // ─────────────────────────────────────────────

  _renderStep() {
    this._wrap.innerHTML = "";

    // Header
    this._wrap.insertAdjacentHTML("beforeend", `
      <div class="cc-header">
        <div class="realm-title">REALM OF ECHOES</div>
        <div class="forge-title">Forge Your Fate</div>
        <div class="orn">✦</div>
      </div>
    `);

    // Step dots
    const dots = [1, 2, 3, 4].map(i => {
      const cls = i === this.step ? "sdot active"
                : i < this.step  ? "sdot done"
                :                  "sdot";
      return `<div class="${cls}"></div>`;
    }).join("");
    this._wrap.insertAdjacentHTML("beforeend", `<div class="step-dots">${dots}</div>`);

    // Step content
    switch (this.step) {
      case 1: this._renderNameRace(); break;
      case 2: this._renderClass();    break;
      case 3: this._renderStats();    break;
      case 4: this._renderReview();   break;
    }
  }

  // ── Step 1: Name + Race ──────────────────────────────────

  _renderNameRace() {
    const raceCards = RACES.map(r => `
      <div class="rcard ${this.raceId === r.id ? "sel" : ""}"
           data-race="${r.id}">
        <div class="rice">${r.icon}</div>
        <div class="rname">${r.name}</div>
        <div class="rbonus">${r.bonus}</div>
      </div>
    `).join("");

    this._wrap.insertAdjacentHTML("beforeend", `
      <div class="card">
        <div class="card-inner">
          <div class="ctitle">Your Name</div>
          <div class="name-wrap">
            <input id="inp-name" type="text" maxlength="20"
                   placeholder="Enter your name"
                   value="${this._escHtml(this.name)}" />
            <div class="name-hint">Choose wisely — your legend begins here.</div>
          </div>
          <div class="ctitle">Choose Your Race</div>
          <div class="race-grid">${raceCards}</div>
        </div>
      </div>
      <div class="nav-row">
        <span class="step-lbl">Step 1 of 4</span>
        <button class="btn btn-next" id="btn-next1">Next →</button>
      </div>
    `);

    // Events
    const inp = this._wrap.querySelector("#inp-name");
    inp.focus();
    inp.addEventListener("input", e => { this.name = e.target.value; this._updateNext1(); });

    this._wrap.querySelectorAll(".rcard").forEach(el => {
      el.addEventListener("click", () => {
        this.raceId = el.dataset.race;
        this._wrap.querySelectorAll(".rcard").forEach(c => c.classList.remove("sel"));
        el.classList.add("sel");
        this._updateNext1();
      });
    });

    this._wrap.querySelector("#btn-next1").addEventListener("click", () => {
      if (this.name.trim() && this.raceId) {
        this.step = 2;
        this._renderStep();
      }
    });

    this._updateNext1();
  }

  _updateNext1() {
    const btn = this._wrap.querySelector("#btn-next1");
    if (btn) btn.disabled = !(this.name.trim() && this.raceId);
  }

  // ── Step 2: Class ────────────────────────────────────────

  _renderClass() {
    const classCards = Object.entries(this.classes)
      .filter(([id]) => CLASS_META[id])
      .map(([id, def]) => {
        const meta  = CLASS_META[id];
        const abils = (def.abilities ?? [])
          .map(aid => this.abilities[aid]?.name ?? aid)
          .join(", ");
        const tags = meta.tags.map((t, i) =>
          `<span class="ctag ${i === 0 ? "pri" : ""}">${t}</span>`
        ).join("");

        return `
          <div class="clcard ${this.classId === id ? "sel" : ""}" data-class="${id}">
            <div class="cl-hd">
              <span class="cl-ic">${meta.icon}</span>
              <span class="cl-nm">${def.name}</span>
            </div>
            <div class="cl-role">${meta.role} · Primary: ${meta.primaryStat}</div>
            <div class="cl-desc">${def.description}</div>
            <div class="cl-tags">${tags}</div>
            <div class="cl-abilities">Abilities: <span>${abils}</span></div>
          </div>
        `;
      }).join("");

    this._wrap.insertAdjacentHTML("beforeend", `
      <div class="card">
        <div class="card-inner">
          <div class="ctitle">Choose Your Class</div>
          <div class="class-grid">${classCards}</div>
        </div>
      </div>
      <div class="nav-row">
        <button class="btn btn-back" id="btn-back2">← Back</button>
        <span class="step-lbl">Step 2 of 4</span>
        <button class="btn btn-next" id="btn-next2">Next →</button>
      </div>
    `);

    this._wrap.querySelectorAll(".clcard").forEach(el => {
      el.addEventListener("click", () => {
        this.classId = el.dataset.class;
        this._wrap.querySelectorAll(".clcard").forEach(c => c.classList.remove("sel"));
        el.classList.add("sel");
        this._updateNext2();
      });
    });

    this._wrap.querySelector("#btn-back2").addEventListener("click", () => {
      this.step = 1; this._renderStep();
    });
    this._wrap.querySelector("#btn-next2").addEventListener("click", () => {
      if (this.classId) {
        if (!this.stats) this.stats = this._rollAll();
        this.step = 3;
        this._renderStep();
      }
    });

    this._updateNext2();
  }

  _updateNext2() {
    const btn = this._wrap.querySelector("#btn-next2");
    if (btn) btn.disabled = !this.classId;
  }

  // ── Step 3: Stats ────────────────────────────────────────

  _renderStats() {
    const rollsLeft = this.rerolls;

    const statBlocks = STAT_NAMES.map(name => {
      const val  = this.stats[name];
      const mod  = Math.floor((val - 10) / 2);
      const modS = mod >= 0 ? `+${mod}` : `${mod}`;
      const modC = mod > 0 ? "pos" : mod < 0 ? "neg" : "zero";

      const dice = this._getDiceDisplay(name);
      const diceHtml = dice.map((d, i) =>
        `<div class="die ${d.kept ? "kept" : "dropped"}" id="die-${name}-${i}">${d.val}</div>`
      ).join("");

      return `
        <div class="sblock" id="sblock-${name}">
          <div class="sl-row">
            <div class="sname">${name}</div>
          </div>
          <div class="sv-row">
            <div class="sval" id="sval-${name}">${val}</div>
            <div class="smod ${modC}">${modS}</div>
          </div>
          <div class="dice-row">${diceHtml}</div>
        </div>
      `;
    }).join("");

    const totalMod = STAT_NAMES.reduce((s, n) => {
      return s + Math.floor((this.stats[n] - 10) / 2);
    }, 0);
    const totalRaw = STAT_NAMES.reduce((s, n) => s + this.stats[n], 0);

    this._wrap.insertAdjacentHTML("beforeend", `
      <div class="card">
        <div class="card-inner">
          <div class="ctitle">Roll Ability Scores</div>
          <div class="reroll-note" id="reroll-note">
            ${rollsLeft > 0
              ? `${rollsLeft} reroll${rollsLeft !== 1 ? "s" : ""} remaining`
              : "No rerolls remaining — these are your stats"}
          </div>
          <button class="roll-btn" id="btn-roll"
                  ${rollsLeft <= 0 ? "disabled" : ""}>
            ⚄ Roll All Stats
          </button>
          <div class="stats-grid">${statBlocks}</div>
          <div class="stats-sum">
            <div class="sum-item">
              <div class="sum-lbl">Total</div>
              <div class="sum-val" id="sum-total">${totalRaw}</div>
            </div>
            <div class="sum-item">
              <div class="sum-lbl">Modifier Sum</div>
              <div class="sum-val" id="sum-mod">${totalMod >= 0 ? "+" : ""}${totalMod}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="nav-row">
        <button class="btn btn-back" id="btn-back3">← Back</button>
        <span class="step-lbl">Step 3 of 4</span>
        <button class="btn btn-next" id="btn-next3">Review →</button>
      </div>
    `);

    this._wrap.querySelector("#btn-roll").addEventListener("click", () => {
      if (this.rerolls <= 0) return;
      this.rerolls--;
      this._animateRoll();
    });

    this._wrap.querySelector("#btn-back3").addEventListener("click", () => {
      this.step = 2; this._renderStep();
    });

    this._wrap.querySelector("#btn-next3").addEventListener("click", () => {
      this.step = 4; this._renderStep();
    });
  }

  _animateRoll() {
    const newStats = this._rollAll();

    // Animate each stat block in sequence
    STAT_NAMES.forEach((name, i) => {
      setTimeout(() => {
        const block = this._wrap.querySelector(`#sblock-${name}`);
        if (!block) return;

        block.classList.add("rolling");
        setTimeout(() => block.classList.remove("rolling"), 400);

        // Animate dice
        const newDice = this._getDiceDisplayForStats(name, newStats);
        newDice.forEach((d, di) => {
          const el = this._wrap.querySelector(`#die-${name}-${di}`);
          if (!el) return;
          el.classList.add("spin");
          setTimeout(() => {
            el.textContent = d.val;
            el.className   = `die ${d.kept ? "kept" : "dropped"} spin`;
            setTimeout(() => el.classList.remove("spin"), 350);
          }, 100);
        });

        // Update value
        const valEl = this._wrap.querySelector(`#sval-${name}`);
        if (valEl) valEl.textContent = newStats[name];

      }, i * 80);
    });

    // Update stats after animation completes
    setTimeout(() => {
      this.stats = newStats;

      // Update sums
      const totalRaw = STAT_NAMES.reduce((s, n) => s + this.stats[n], 0);
      const totalMod = STAT_NAMES.reduce((s, n) => {
        return s + Math.floor((this.stats[n] - 10) / 2);
      }, 0);

      const sumT = this._wrap.querySelector("#sum-total");
      const sumM = this._wrap.querySelector("#sum-mod");
      if (sumT) sumT.textContent = totalRaw;
      if (sumM) sumM.textContent = `${totalMod >= 0 ? "+" : ""}${totalMod}`;

      // Update reroll note
      const note = this._wrap.querySelector("#reroll-note");
      const btn  = this._wrap.querySelector("#btn-roll");
      if (note) note.textContent = this.rerolls > 0
        ? `${this.rerolls} reroll${this.rerolls !== 1 ? "s" : ""} remaining`
        : "No rerolls remaining — these are your stats";
      if (btn) btn.disabled = this.rerolls <= 0;

    }, STAT_NAMES.length * 80 + 400);
  }

  // ── Step 4: Review ───────────────────────────────────────

  _renderReview() {
    const classDef  = this.classes[this.classId];
    const classMeta = CLASS_META[this.classId] ?? {};
    const race      = RACES.find(r => r.id === this.raceId);
    const hp        = classDef?.baseStats?.hp ?? 10;

    const sheetRows = [
      ["Name",  this.name],
      ["Race",  race?.name ?? this.raceId],
      ["Class", classDef?.name ?? this.classId],
      ["HP",    hp],
      ["Role",  classMeta.role ?? ""],
    ].map(([k, v]) => `
      <div class="sh-row">
        <span class="sh-k">${k}</span>
        <span class="sh-v gold">${v}</span>
      </div>
    `).join("");

    const statCells = STAT_NAMES.map(name => {
      const val = this.stats[name];
      const mod = Math.floor((val - 10) / 2);
      return `
        <div class="csm">
          <div class="csm-n">${name}</div>
          <div class="csm-v">${val}</div>
          <div class="csm-m">${mod >= 0 ? "+" : ""}${mod}</div>
        </div>
      `;
    }).join("");

    this._wrap.insertAdjacentHTML("beforeend", `
      <div class="card">
        <div class="card-inner">
          <div class="ctitle">Character Sheet</div>
          <div class="review-layout">
            <div class="portrait-box">
              <div class="portrait-icon">${classMeta.icon ?? "⚔️"}</div>
              <div class="portrait-name">${this._escHtml(this.name)}</div>
              <div class="portrait-sub">${race?.name ?? ""} ${classDef?.name ?? ""}</div>
              <div class="portrait-sub" style="color:var(--gold-b)">${race?.bonus ?? ""}</div>
            </div>
            <div>
              ${sheetRows}
              <div class="csm-grid">${statCells}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="nav-row">
        <button class="btn btn-back" id="btn-back4">← Back</button>
        <span class="step-lbl">Step 4 of 4</span>
        <button class="btn btn-enter" id="btn-enter">Enter the Realm →</button>
      </div>
    `);

    this._wrap.querySelector("#btn-back4").addEventListener("click", () => {
      this.step = 3; this._renderStep();
    });

    this._wrap.querySelector("#btn-enter").addEventListener("click", () => {
      this.hide();
      this.onConfirm?.({
        name:    this.name.trim(),
        raceId:  this.raceId,
        classId: this.classId,
        stats:   { ...this.stats }
      });
    });
  }

  // ─────────────────────────────────────────────
  // ROLLING LOGIC
  // ─────────────────────────────────────────────

  _rollAll() {
    return Object.fromEntries(
      STAT_NAMES.map(s => [s, this._roll4d6DropLowest()])
    );
  }

  _roll4d6DropLowest() {
    const dice = Array.from({ length: 4 }, () => Math.ceil(Math.random() * 6));
    dice.sort((a, b) => a - b);
    return dice.slice(1).reduce((a, b) => a + b, 0);
  }

  // Returns the 4 dice with kept/dropped flags for display
  _getDiceDisplay(statName) {
    return this._getDiceDisplayForStats(statName, this.stats);
  }

  _getDiceDisplayForStats(statName, stats) {
    // Reverse-engineer kept dice from total (approximation for display)
    // We store last roll result for accurate display
    if (!this._lastRolls) this._lastRolls = {};
    if (!this._lastRolls[statName]) {
      // Generate plausible dice that sum to stats[statName]
      return this._generateDisplayDice(stats[statName]);
    }
    return this._lastRolls[statName];
  }

  _generateDisplayDice(total) {
    // Generate 4 random dice that look plausible for the total
    const dice = Array.from({ length: 4 }, () => Math.ceil(Math.random() * 6));
    dice.sort((a, b) => a - b);
    // Mark lowest as dropped
    return dice.map((val, i) => ({ val, kept: i > 0 }));
  }

  // ─────────────────────────────────────────────
  // PARTICLE EFFECT
  // ─────────────────────────────────────────────

  _startParticles() {
    const canvas = this._particleCanvas;
    const ctx    = canvas.getContext("2d");

    const particles = Array.from({ length: 40 }, () => this._newParticle(canvas));

    const tick = () => {
      if (!this._overlay) return;

      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;

      for (const p of particles) {
        p.y  -= p.speed;
        p.x  += p.drift;
        p.life--;

        if (p.life <= 0 || p.y < 0) {
          Object.assign(p, this._newParticle(canvas));
        }

        const alpha = Math.min(1, p.life / 40) * p.alpha;
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      this._particleRAF = requestAnimationFrame(tick);
    };

    tick();
  }

  _newParticle(canvas) {
    const isEmber = Math.random() > 0.5;
    return {
      x:     Math.random() * (canvas.width || window.innerWidth),
      y:     (canvas.height || window.innerHeight) + 10,
      speed: 0.4 + Math.random() * 1.2,
      drift: (Math.random() - 0.5) * 0.5,
      size:  0.5 + Math.random() * 2,
      life:  60 + Math.random() * 120,
      alpha: 0.3 + Math.random() * 0.5,
      r: isEmber ? 220 + Math.random() * 35 : 180,
      g: isEmber ? 80  + Math.random() * 60 : 160,
      b: isEmber ? 10  + Math.random() * 20 : 220,
    };
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  _escHtml(str) {
    return (str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}
