/**
 * ScreenManager.js
 *
 * Pre-game HTML overlay: Character Select + Character Creation.
 *
 * DOM structure (injected into body):
 *   #roe-screen
 *     #roe-particles  (canvas, pointer-events:none, position:fixed behind)
 *     #roe-content    (scrollable content area, always present)
 *
 * Only #roe-content innerHTML changes between screens.
 * This avoids any DOM removal/re-attachment issues.
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

    this.onPlay   = null;
    this.onCreate = null;

    // Creation state
    this._step    = 1;
    this._name    = "";
    this._raceId  = null;
    this._classId = null;
    this._stats   = null;
    this._rerolls = MAX_REROLLS;
    this._newSlot = 0;

    this._overlay  = null;
    this._content  = null;   // #roe-content — only this changes
    this._raf      = null;
  }

  // ─────────────────────────────────────────────
  // PUBLIC
  // ─────────────────────────────────────────────

  show() {
    this._build();
    this._showCharSelect();
    this._startParticles();
  }

  hide() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    this._overlay?.remove();
    this._overlay = null;
    this._content = null;
  }

  // ─────────────────────────────────────────────
  // DOM SETUP — called once
  // ─────────────────────────────────────────────

  _build() {
    // Remove any stale overlay
    document.getElementById("roe-screen")?.remove();

    this._overlay = document.createElement("div");
    this._overlay.id = "roe-screen";
    document.body.appendChild(this._overlay);

    // Particle canvas — behind everything, never removed
    const pc = document.createElement("canvas");
    pc.id = "roe-particles";
    this._overlay.appendChild(pc);
    this._particleCanvas = pc;

    // Content area — only innerHTML changes
    this._content = document.createElement("div");
    this._content.id = "roe-content";
    this._overlay.appendChild(this._content);
  }

  // ─────────────────────────────────────────────
  // CHARACTER SELECT
  // ─────────────────────────────────────────────

  _showCharSelect() {
    const playerToken = localStorage.getItem("roe_player_token") ?? "";
    const shortToken  = playerToken ? playerToken.substring(0, 8) + "…" : "—";

    const slotsHtml = this.slots.map((data, i) => {
      if (data) {
        const classDef  = this.classes[data.classId] ?? {};
        const classMeta = CLASS_META[data.classId]   ?? {};
        const race      = RACES.find(r => r.id === data.raceId);
        const savedDate = data.savedAt ? new Date(data.savedAt).toLocaleDateString() : "";
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
                <button class="cs-del-btn" data-del="${i}">✕</button>
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

    this._content.innerHTML = `
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
    `;

    // Play buttons
    this._content.querySelectorAll(".cs-play-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.slot);
        this.hide();
        this.onPlay?.(idx, this.slots[idx]);
      });
    });

    // Empty slot — new character
    this._content.querySelectorAll(".char-slot.empty").forEach(el => {
      el.addEventListener("click", () => {
        this._newSlot = parseInt(el.dataset.new);
        this._startCreation();
      });
    });

    // Delete buttons
    this._content.querySelectorAll(".cs-del-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this._showDeleteConfirm(parseInt(btn.dataset.del));
      });
    });

    // New character button
    this._content.querySelector("#cs-new-btn")?.addEventListener("click", () => {
      const idx = this.slots.findIndex(s => s === null);
      this._newSlot = idx >= 0 ? idx : 0;
      this._startCreation();
    });

    // Token copy
    this._content.querySelector("#cs-copy-btn")?.addEventListener("click", () => {
      navigator.clipboard?.writeText(playerToken);
      const el = this._content.querySelector("#cs-token-val");
      if (el) { el.textContent = "Copied!"; setTimeout(() => el.textContent = shortToken, 1500); }
    });

    // Token import
    this._content.querySelector("#cs-import-btn")?.addEventListener("click", () => {
      const token = prompt("Paste your Player ID:");
      if (token?.trim()) { localStorage.setItem("roe_player_token", token.trim()); location.reload(); }
    });
  }

  _showDeleteConfirm(slotIndex) {
    const data = this.slots[slotIndex];
    if (!data) return;

    const el = document.createElement("div");
    el.className = "cs-confirm-overlay";
    el.style.zIndex = "300";
    el.innerHTML = `
      <div class="cs-confirm-box">
        <div style="font-family:'Cinzel',serif;font-size:.85rem;color:var(--gold-b);margin-bottom:10px;">
          Delete ${this._esc(data.name)}?
        </div>
        <p>This cannot be undone.</p>
        <div class="cs-confirm-btns">
          <button class="btn btn-back" id="cc-cancel">Cancel</button>
          <button class="btn btn-enter" id="cc-confirm" style="padding:10px 22px;font-size:.75rem;">Delete</button>
        </div>
      </div>`;

    this._overlay.appendChild(el);
    el.querySelector("#cc-cancel").addEventListener("click",  () => el.remove());
    el.querySelector("#cc-confirm").addEventListener("click", async () => {
      await this.saveProvider.delete(slotIndex + 1);
      this.slots[slotIndex] = null;
      el.remove();
      this._showCharSelect();
    });
  }

  // ─────────────────────────────────────────────
  // CHARACTER CREATION
  // ─────────────────────────────────────────────

  _startCreation() {
    this._step    = 1;
    this._name    = "";
    this._raceId  = null;
    this._classId = null;
    this._stats   = null;
    this._rerolls = MAX_REROLLS;
    this._renderStep();
  }

  _renderStep() {
    const dots = [1,2,3,4].map(i =>
      `<div class="sdot ${i === this._step ? "active" : i < this._step ? "done" : ""}"></div>`
    ).join("");

    this._content.innerHTML = `
      <header style="text-align:center;margin-bottom:28px;">
        <div class="realm-title">Realm of Echoes</div>
        <div class="forge-title">Forge Your Fate</div>
        <div class="orn">✦</div>
      </header>
      <div class="step-dots">${dots}</div>
      <div id="cc-step"></div>
    `;

    switch (this._step) {
      case 1: this._renderNameRace(); break;
      case 2: this._renderClass();   break;
      case 3: this._renderStats();   break;
      case 4: this._renderReview();  break;
    }
  }

  _step$(sel) { return this._content.querySelector(sel); }

  // Step 1 — Name + Race
  _renderNameRace() {
    const racesHtml = RACES.map(r => `
      <div class="rcard ${this._raceId === r.id ? "sel" : ""}" data-race="${r.id}">
        <div class="rice">${r.icon}</div>
        <div class="rname">${r.name}</div>
        <div class="rbonus">${r.bonus}</div>
      </div>`).join("");

    this._step$('#cc-step').innerHTML = `
      <div class="card"><div class="card-inner">
        <div class="ctitle">I — Name &amp; Heritage</div>
        <div class="name-wrap">
          <input type="text" id="inp-name" maxlength="20" autocomplete="off"
                 placeholder="Your name…" value="${this._esc(this._name)}">
          <div class="name-hint">What do the bards call you?</div>
        </div>
        <div class="ctitle" style="margin-top:18px;">Choose Your Race</div>
        <div class="race-grid">${racesHtml}</div>
        <div class="nav-row">
          <button class="btn btn-back" id="b-back">← Select</button>
          <span class="step-lbl">1 of 4</span>
          <button class="btn btn-next" id="b-next" ${!(this._name.trim() && this._raceId) ? "disabled" : ""}>Next →</button>
        </div>
      </div></div>`;

    const inp  = this._step$('#inp-name');
    const next = this._step$('#b-next');

    inp.addEventListener('input', e => {
      this._name = e.target.value;
      next.disabled = !(this._name.trim() && this._raceId);
    });

    this._content.querySelectorAll('.rcard').forEach(el => {
      el.addEventListener('click', () => {
        this._raceId = el.dataset.race;
        this._content.querySelectorAll('.rcard').forEach(c => c.classList.remove('sel'));
        el.classList.add('sel');
        next.disabled = !(this._name.trim() && this._raceId);
      });
    });

    this._step$('#b-back').addEventListener('click', () => this._showCharSelect());
    next.addEventListener('click', () => { if (!next.disabled) { this._step = 2; this._renderStep(); } });

    setTimeout(() => inp.focus(), 50);
  }

  // Step 2 — Class
  _renderClass() {
    const html = Object.entries(this.classes)
      .filter(([id]) => CLASS_META[id])
      .map(([id, def]) => {
        const m     = CLASS_META[id];
        const abils = (def.abilities ?? []).map(a => this.abilities[a]?.name ?? a).join(", ");
        const tags  = m.tags.map((t,i) => `<span class="ctag ${i===0?"pri":""}">${t}</span>`).join("");
        return `
          <div class="clcard ${this._classId === id ? "sel" : ""}" data-class="${id}">
            <div class="cl-hd"><span class="cl-ic">${m.icon}</span><span class="cl-nm">${def.name}</span></div>
            <div class="cl-role">${m.role} · ${m.primaryStat}</div>
            <div class="cl-desc">${def.description}</div>
            <div class="cl-tags">${tags}</div>
            <div class="cl-abilities">Abilities: <span>${abils}</span></div>
          </div>`;
      }).join("");

    this._step$('#cc-step').innerHTML = `
      <div class="card"><div class="card-inner">
        <div class="ctitle">II — Choose Your Path</div>
        <div class="class-grid">${html}</div>
        <div class="nav-row">
          <button class="btn btn-back" id="b-back">← Back</button>
          <span class="step-lbl">2 of 4</span>
          <button class="btn btn-next" id="b-next" ${!this._classId ? "disabled" : ""}>Next →</button>
        </div>
      </div></div>`;

    const next = this._step$('#b-next');

    this._content.querySelectorAll('.clcard').forEach(el => {
      el.addEventListener('click', () => {
        this._classId = el.dataset.class;
        this._content.querySelectorAll('.clcard').forEach(c => c.classList.remove('sel'));
        el.classList.add('sel');
        next.disabled = false;
      });
    });

    this._step$('#b-back').addEventListener('click', () => { this._step = 1; this._renderStep(); });
    next.addEventListener('click', () => {
      if (!next.disabled) {
        if (!this._stats) this._stats = this._rollAll();
        this._step = 3; this._renderStep();
      }
    });
  }

  // Step 3 — Stats
  _renderStats() {
    const blocksHtml = STAT_NAMES.map(n => {
      const v   = this._stats[n];
      const mod = Math.floor((v - 10) / 2);
      const mc  = mod > 0 ? "pos" : mod < 0 ? "neg" : "zero";
      const dice = this._genDice(v);
      const diceHtml = dice.map((d,i) =>
        `<div class="die ${d.kept?"kept":"dropped"}" id="d-${n}-${i}">${d.val}</div>`
      ).join("");
      return `
        <div class="sblock" id="sb-${n}">
          <div class="sl-row"><span class="sname">${n}</span></div>
          <div class="sv-row">
            <div class="sval" id="sv-${n}">${v}</div>
            <div class="smod ${mc}">${mod >= 0 ? "+":""}${mod}</div>
          </div>
          <div class="dice-row">${diceHtml}</div>
        </div>`;
    }).join("");

    const tot = STAT_NAMES.reduce((s,n) => s + this._stats[n], 0);
    const mod = STAT_NAMES.reduce((s,n) => s + Math.floor((this._stats[n]-10)/2), 0);

    this._step$('#cc-step').innerHTML = `
      <div class="card"><div class="card-inner">
        <div class="ctitle">III — Ability Scores</div>
        <button class="roll-btn" id="b-roll" ${this._rerolls<=0?"disabled":""}>⚄ Roll All Abilities</button>
        <div class="reroll-note" id="reroll-note">${this._rerolls > 0 ? `${this._rerolls} reroll${this._rerolls!==1?"s":""} remaining` : "No rerolls remaining"}</div>
        <div class="stats-grid">${blocksHtml}</div>
        <div class="stats-sum">
          <div class="sum-item"><div class="sum-lbl">Total</div><div class="sum-val" id="s-tot">${tot}</div></div>
          <div class="sum-item"><div class="sum-lbl">Modifier Sum</div><div class="sum-val" id="s-mod">${mod>=0?"+":""}${mod}</div></div>
        </div>
        <div class="nav-row">
          <button class="btn btn-back" id="b-back">← Back</button>
          <span class="step-lbl">3 of 4</span>
          <button class="btn btn-next" id="b-next">Review →</button>
        </div>
      </div></div>`;

    this._step$('#b-roll').addEventListener('click', () => {
      if (this._rerolls <= 0) return;
      this._rerolls--;
      this._animateRoll();
    });
    this._step$('#b-back').addEventListener('click', () => { this._step = 2; this._renderStep(); });
    this._step$('#b-next').addEventListener('click', () => { this._step = 4; this._renderStep(); });
  }

  _animateRoll() {
    const ns = this._rollAll();
    STAT_NAMES.forEach((n, i) => {
      setTimeout(() => {
        this._step$(`#sb-${n}`)?.classList.add("rolling");
        setTimeout(() => this._step$(`#sb-${n}`)?.classList.remove("rolling"), 400);
        this._genDice(ns[n]).forEach((d, di) => {
          const el = this._step$(`#d-${n}-${di}`);
          if (!el) return;
          el.classList.add("spin");
          setTimeout(() => { el.textContent = d.val; el.className = `die ${d.kept?"kept":"dropped"}`; }, 180);
        });
        setTimeout(() => { const el = this._step$(`#sv-${n}`); if (el) el.textContent = ns[n]; }, 180);
      }, i * 80);
    });

    setTimeout(() => {
      this._stats = ns;
      const tot = STAT_NAMES.reduce((s,n) => s + ns[n], 0);
      const mod = STAT_NAMES.reduce((s,n) => s + Math.floor((ns[n]-10)/2), 0);
      const st = this._step$('#s-tot');  if (st) st.textContent = tot;
      const sm = this._step$('#s-mod');  if (sm) sm.textContent = `${mod>=0?"+":""}${mod}`;
      const note = this._step$('#reroll-note');
      const btn  = this._step$('#b-roll');
      if (note) note.textContent = this._rerolls > 0 ? `${this._rerolls} reroll${this._rerolls!==1?"s":""} remaining` : "No rerolls remaining";
      if (btn)  btn.disabled = this._rerolls <= 0;
    }, STAT_NAMES.length * 80 + 400);
  }

  // Step 4 — Review
  _renderReview() {
    const cd   = this.classes[this._classId] ?? {};
    const cm   = CLASS_META[this._classId]   ?? {};
    const race = RACES.find(r => r.id === this._raceId);

    const cells = STAT_NAMES.map(n => {
      const v = this._stats[n], m = Math.floor((v-10)/2);
      return `<div class="csm"><div class="csm-n">${n}</div><div class="csm-v">${v}</div><div class="csm-m">${m>=0?"+":""}${m}</div></div>`;
    }).join("");

    this._step$('#cc-step').innerHTML = `
      <div class="card"><div class="card-inner">
        <div class="ctitle">IV — Character Sheet</div>
        <div class="confirm-lay">
          <div class="portrait-box">
            <div class="portrait-icon">${cm.icon ?? "⚔️"}</div>
            <div class="portrait-name">${this._esc(this._name)}</div>
            <div class="portrait-sub">${race?.name ?? ""} ${cd.name ?? ""}</div>
            <div class="portrait-sub" style="color:var(--gold-b)">${race?.bonus ?? ""}</div>
          </div>
          <div>
            <div class="sh-row"><span class="sh-k">Name</span><span class="sh-v gold">${this._esc(this._name)}</span></div>
            <div class="sh-row"><span class="sh-k">Race</span><span class="sh-v">${race?.name ?? ""}</span></div>
            <div class="sh-row"><span class="sh-k">Class</span><span class="sh-v">${cd.name ?? ""}</span></div>
            <div class="sh-row"><span class="sh-k">Level</span><span class="sh-v">1</span></div>
            <div class="sh-row"><span class="sh-k">Hit Points</span><span class="sh-v gold">${cd.baseStats?.hp ?? "—"}</span></div>
            <div class="sh-row"><span class="sh-k">Gold</span><span class="sh-v gold">50 gp</span></div>
            <div class="csm-grid">${cells}</div>
          </div>
        </div>
        <div class="nav-row">
          <button class="btn btn-back" id="b-back">← Back</button>
          <button class="btn btn-enter" id="b-enter">⚔ Enter the Realm</button>
        </div>
      </div></div>`;

    this._step$('#b-back').addEventListener('click', () => { this._step = 3; this._renderStep(); });
    this._step$('#b-enter').addEventListener('click', async () => {
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
  // DICE
  // ─────────────────────────────────────────────

  _rollAll() {
    return Object.fromEntries(STAT_NAMES.map(s => [s, this._roll4d6()]));
  }

  _roll4d6() {
    const d = Array.from({length:4}, () => Math.ceil(Math.random()*6));
    d.sort((a,b) => a-b);
    return d.slice(1).reduce((a,b) => a+b, 0);
  }

  _genDice(total) {
    const d = Array.from({length:4}, () => Math.ceil(Math.random()*6));
    d.sort((a,b) => a-b);
    return d.map((val,i) => ({ val, kept: i > 0 }));
  }

  // ─────────────────────────────────────────────
  // PARTICLES
  // ─────────────────────────────────────────────

  _startParticles() {
    const canvas = this._particleCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const pts = Array.from({length:40}, () => this._newParticle());

    const tick = () => {
      if (!this._overlay) return;
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      for (const p of pts) {
        p.y -= p.speed; p.x += p.drift; p.life--;
        if (p.life <= 0 || p.y < 0) Object.assign(p, this._newParticle());
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${Math.min(1,p.life/40)*p.alpha})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
      }
      this._raf = requestAnimationFrame(tick);
    };
    tick();
  }

  _newParticle() {
    const e = Math.random() > 0.5;
    return {
      x:     Math.random() * window.innerWidth,
      y:     window.innerHeight + 10,
      speed: 0.4 + Math.random() * 1.2,
      drift: (Math.random() - 0.5) * 0.4,
      size:  0.5 + Math.random() * 1.8,
      life:  60 + Math.random() * 120,
      alpha: 0.3 + Math.random() * 0.5,
      r: e ? 220 : 180, g: e ? 100 : 160, b: e ? 20 : 220,
    };
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  _esc(s) {
    return (s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
}
