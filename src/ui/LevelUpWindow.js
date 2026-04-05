/**
 * LevelUpWindow.js
 *
 * HTML overlay shown at special levels (every 3rd).
 * Two panels:
 *   1. Skill pick — shows all 10 class skills, player picks one
 *      - Already learned: shows current rank + upgrade option
 *      - New skill: shows description and unlock option
 *      - At 6 skills and picking new: asks which to replace
 *   2. Stat points — 5 points to distribute across 6 stats
 *
 * Usage:
 *   const win = new LevelUpWindow({ player, classSkills, xpSystem });
 *   win.onConfirm = (skillId, replaceId, statDist) => { ... };
 *   win.show(level);
 */

const STAT_NAMES  = ["STR", "DEX", "INT", "CON", "WIS", "CHA"];
const TOTAL_POINTS = 5;

export class LevelUpWindow {
  constructor({ player, classSkills, xpSystem }) {
    this.player      = player;
    this.classSkills = classSkills; // array of skill defs for this class
    this.xpSystem    = xpSystem;
    this.onConfirm   = null;

    this._el           = null;
    this._selectedSkill = null;
    this._replaceSkill  = null;
    this._phase         = "skill";  // "skill" | "replace" | "stats"
    this._statPoints    = Object.fromEntries(STAT_NAMES.map(s => [s, 0]));
    this._pointsLeft    = TOTAL_POINTS;
    this._level         = 1;
  }

  show(level) {
    this._level      = level;
    this._phase      = "skill";
    this._selectedSkill = null;
    this._replaceSkill  = null;
    this._statPoints = Object.fromEntries(STAT_NAMES.map(s => [s, 0]));
    this._pointsLeft = TOTAL_POINTS;

    document.getElementById("levelup-window")?.remove();

    this._el = document.createElement("div");
    this._el.id = "levelup-window";
    this._el.style.cssText = `
      position: fixed; inset: 0; z-index: 160;
      background: rgba(0,0,0,0.88);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Crimson Text', serif; color: #f0ddb8;
    `;

    document.body.appendChild(this._el);
    this._render();
  }

  hide() {
    this._el?.remove();
    this._el = null;
  }

  // ─────────────────────────────────────────────
  // RENDERING
  // ─────────────────────────────────────────────

  _render() {
    if (!this._el) return;
    if (this._phase === "skill")   this._renderSkillPick();
    if (this._phase === "replace") this._renderReplacePick();
    if (this._phase === "stats")   this._renderStatPick();
  }

  _renderSkillPick() {
    const p           = this.player;
    const learned     = p.learnedSkills ?? {};
    const slotsFull   = Object.keys(learned).length >= 6;

    const skillsHtml = this.classSkills.map(skill => {
      const rank     = learned[skill.id] ?? 0;
      const hasIt    = rank > 0;
      const isSelected = this._selectedSkill === skill.id;

      // Effective damage at next rank
      const nextRank  = rank + 1;
      const dmg       = this.xpSystem.getEffectiveDamage(skill, nextRank);
      const dmgText   = dmg.base > 0 ? `${dmg.base}–${dmg.base + dmg.variance} dmg` : "";
      const rankLabel = hasIt ? `Rank ${rank} → ${nextRank}` : "New";
      const rankColor = hasIt ? "#88aaff" : "#88ee88";

      return `
        <div class="lu-skill ${isSelected ? "sel" : ""} ${hasIt ? "owned" : ""}"
             data-skill="${skill.id}"
             style="border:1px solid ${isSelected ? "#c9922a" : hasIt ? "#446644" : "#4a2e10"};
                    padding:12px 14px;cursor:pointer;transition:all .2s;
                    background:${isSelected ? "rgba(201,146,42,0.12)" : "rgba(0,0,0,0.3)"};
                    margin-bottom:6px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
            <span style="font-size:1.4rem;">${skill.icon}</span>
            <span style="font-family:'Cinzel',serif;font-size:.85rem;">${skill.name}</span>
            <span style="margin-left:auto;font-size:.62rem;padding:2px 6px;border:1px solid ${rankColor};color:${rankColor};">${rankLabel}</span>
            ${dmgText ? `<span style="font-size:.65rem;color:#a8865a;">${dmgText}</span>` : ""}
          </div>
          <div style="font-size:.72rem;color:#a8865a;font-style:italic;">${skill.description}</div>
          ${hasIt && skill.rankDescriptions?.[nextRank - 1] ? `
            <div style="font-size:.65rem;color:#88aaff;margin-top:3px;">✦ ${skill.rankDescriptions[nextRank - 1]}</div>
          ` : ""}
        </div>`;
    }).join("");

    this._el.innerHTML = `
      <div style="background:linear-gradient(160deg,#1a1006,#0d0802);border:1px solid #7a5020;
                  max-width:620px;width:100%;max-height:90vh;overflow-y:auto;
                  box-shadow:0 0 60px rgba(0,0,0,0.9),0 0 20px rgba(201,146,42,0.2);">

        <div style="padding:18px 22px 12px;border-bottom:1px solid #4a2e10;text-align:center;">
          <div style="font-family:'Cinzel Decorative',serif;font-size:.65rem;letter-spacing:4px;color:#a8865a;margin-bottom:4px;">
            LEVEL ${this._level}
          </div>
          <div style="font-family:'Cinzel Decorative',serif;font-size:1.3rem;color:#e8b84a;
                      text-shadow:0 0 20px rgba(201,146,42,0.5);">
            Choose Your Path
          </div>
          <div style="font-size:.75rem;color:#a8865a;font-style:italic;margin-top:6px;">
            ${slotsFull ? "Upgrade an existing skill or replace one." : `Pick a skill. (${Object.keys(learned).length}/6 slots used)`}
          </div>
        </div>

        <div style="padding:16px 20px;" id="lu-skill-list">
          ${skillsHtml}
        </div>

        <div style="padding:12px 20px;border-top:1px solid #4a2e10;display:flex;justify-content:flex-end;gap:10px;">
          <button id="lu-skill-next" style="font-family:'Cinzel',serif;font-size:.72rem;letter-spacing:2px;
                  text-transform:uppercase;padding:10px 24px;border:1px solid #c9922a;
                  color:#c9922a;background:transparent;cursor:pointer;opacity:0.4;" disabled>
            Next: Assign Stats →
          </button>
        </div>
      </div>
    `;

    // Skill card clicks
    this._el.querySelectorAll(".lu-skill").forEach(el => {
      el.addEventListener("click", () => {
        this._selectedSkill = el.dataset.skill;
        this._render();
      });
    });

    // Next button
    const nextBtn = this._el.querySelector("#lu-skill-next");
    if (this._selectedSkill) {
      nextBtn.disabled = false;
      nextBtn.style.opacity = "1";
    }

    nextBtn.addEventListener("click", () => {
      if (!this._selectedSkill) return;

      const learned   = this.player.learnedSkills ?? {};
      const slotsFull = Object.keys(learned).length >= 6;
      const hasIt     = learned[this._selectedSkill] !== undefined;

      // If slots full and picking something new, go to replace phase
      if (slotsFull && !hasIt) {
        this._phase = "replace";
      } else {
        this._phase = "stats";
      }
      this._render();
    });
  }

  _renderReplacePick() {
    const learned = this.player.learnedSkills ?? {};
    const ownedIds = Object.keys(learned);

    const slotsHtml = ownedIds.map(id => {
      const skill    = this.classSkills.find(s => s.id === id);
      if (!skill) return "";
      const rank     = learned[id] ?? 1;
      const isSelected = this._replaceSkill === id;
      return `
        <div class="lu-replace ${isSelected ? "sel" : ""}" data-replace="${id}"
             style="border:1px solid ${isSelected ? "#cc4444" : "#4a2e10"};
                    padding:10px 14px;cursor:pointer;margin-bottom:5px;
                    background:${isSelected ? "rgba(180,40,40,0.15)" : "rgba(0,0,0,0.3)"};">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.2rem;">${skill.icon}</span>
            <span style="font-family:'Cinzel',serif;font-size:.82rem;">${skill.name}</span>
            <span style="margin-left:auto;font-size:.62rem;color:#88aaff;">Rank ${rank}</span>
          </div>
        </div>`;
    }).join("");

    const newSkill = this.classSkills.find(s => s.id === this._selectedSkill);

    this._el.innerHTML = `
      <div style="background:linear-gradient(160deg,#1a1006,#0d0802);border:1px solid #7a5020;
                  max-width:480px;width:100%;box-shadow:0 0 60px rgba(0,0,0,0.9);">
        <div style="padding:16px 20px;border-bottom:1px solid #4a2e10;text-align:center;">
          <div style="font-family:'Cinzel',serif;font-size:.95rem;color:#e8b84a;margin-bottom:6px;">
            Replace a Skill
          </div>
          <div style="font-size:.75rem;color:#a8865a;font-style:italic;">
            You're learning <strong style="color:#88ee88;">${newSkill?.name}</strong>.
            Choose a skill to remove.
          </div>
        </div>
        <div style="padding:14px 18px;">${slotsHtml}</div>
        <div style="padding:10px 18px;border-top:1px solid #4a2e10;display:flex;justify-content:space-between;">
          <button id="lu-replace-back" style="font-family:'Cinzel',serif;font-size:.68rem;letter-spacing:2px;
                  text-transform:uppercase;padding:8px 16px;border:1px solid #4a2e10;
                  color:#a8865a;background:transparent;cursor:pointer;">← Back</button>
          <button id="lu-replace-next" style="font-family:'Cinzel',serif;font-size:.68rem;letter-spacing:2px;
                  text-transform:uppercase;padding:8px 20px;border:1px solid #c9922a;
                  color:#c9922a;background:transparent;cursor:pointer;opacity:0.4;" disabled>
            Confirm →
          </button>
        </div>
      </div>
    `;

    this._el.querySelectorAll(".lu-replace").forEach(el => {
      el.addEventListener("click", () => {
        this._replaceSkill = el.dataset.replace;
        this._render();
      });
    });

    const nextBtn = this._el.querySelector("#lu-replace-next");
    if (this._replaceSkill) { nextBtn.disabled = false; nextBtn.style.opacity = "1"; }
    nextBtn.addEventListener("click", () => { this._phase = "stats"; this._render(); });

    this._el.querySelector("#lu-replace-back").addEventListener("click", () => {
      this._phase = "skill"; this._replaceSkill = null; this._render();
    });
  }

  _renderStatPick() {
    const p     = this.player;
    const stats = p.stats ?? {};

    const statsHtml = STAT_NAMES.map(stat => {
      const current = (stats[stat] ?? 10) + (this._statPoints[stat] ?? 0);
      const mod     = Math.floor((current - 10) / 2);
      return `
        <div style="border:1px solid #4a2e10;padding:10px;text-align:center;">
          <div style="font-family:'Cinzel',serif;font-size:.6rem;letter-spacing:2px;color:#c9922a;">${stat}</div>
          <div style="font-family:'Cinzel',serif;font-size:1.8rem;font-weight:900;margin:4px 0;">${current}</div>
          <div style="font-size:.7rem;color:#a8865a;">${mod >= 0 ? "+" : ""}${mod}</div>
          <div style="display:flex;gap:4px;justify-content:center;margin-top:6px;">
            <button class="sp-btn sp-minus" data-stat="${stat}"
                    style="width:24px;height:24px;border:1px solid #4a2e10;background:transparent;
                           color:#a8865a;cursor:pointer;font-size:.9rem;"
                    ${(this._statPoints[stat] ?? 0) <= 0 ? "disabled" : ""}>−</button>
            <span style="font-size:.75rem;color:#e8b84a;min-width:16px;text-align:center;
                         line-height:24px;">+${this._statPoints[stat] ?? 0}</span>
            <button class="sp-btn sp-plus" data-stat="${stat}"
                    style="width:24px;height:24px;border:1px solid #4a2e10;background:transparent;
                           color:#a8865a;cursor:pointer;font-size:.9rem;"
                    ${this._pointsLeft <= 0 ? "disabled" : ""}>+</button>
          </div>
        </div>`;
    }).join("");

    const skill    = this.classSkills.find(s => s.id === this._selectedSkill);
    const learned  = p.learnedSkills ?? {};
    const hasIt    = learned[this._selectedSkill] !== undefined;
    const newRank  = (learned[this._selectedSkill] ?? 0) + 1;

    this._el.innerHTML = `
      <div style="background:linear-gradient(160deg,#1a1006,#0d0802);border:1px solid #7a5020;
                  max-width:560px;width:100%;box-shadow:0 0 60px rgba(0,0,0,0.9);">

        <div style="padding:16px 20px;border-bottom:1px solid #4a2e10;text-align:center;">
          <div style="font-family:'Cinzel Decorative',serif;font-size:1.1rem;color:#e8b84a;margin-bottom:6px;">
            Assign Stat Points
          </div>
          <div style="font-size:.72rem;color:#a8865a;font-style:italic;">
            ${this._pointsLeft} points remaining
          </div>
        </div>

        <div style="padding:14px 18px;">
          <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:16px;">
            ${statsHtml}
          </div>

          <div style="border-top:1px solid #4a2e10;padding-top:12px;">
            <div style="font-size:.7rem;color:#a8865a;text-align:center;font-style:italic;">
              ${skill ? `
                Skill: <strong style="color:${hasIt ? "#88aaff" : "#88ee88"}">
                  ${skill.icon} ${skill.name}
                  ${hasIt ? `(Rank ${newRank})` : "(New)"}
                  ${this._replaceSkill ? `— replaces ${this.classSkills.find(s=>s.id===this._replaceSkill)?.name}` : ""}
                </strong>` : ""}
            </div>
          </div>
        </div>

        <div style="padding:10px 18px;border-top:1px solid #4a2e10;display:flex;justify-content:space-between;">
          <button id="sp-back" style="font-family:'Cinzel',serif;font-size:.68rem;letter-spacing:2px;
                  text-transform:uppercase;padding:8px 16px;border:1px solid #4a2e10;
                  color:#a8865a;background:transparent;cursor:pointer;">← Back</button>
          <button id="sp-confirm" style="font-family:'Cinzel',serif;font-size:.72rem;letter-spacing:2px;
                  text-transform:uppercase;padding:10px 28px;
                  border:1px solid #8b1a1a;color:#f0ddb8;background:#8b1a1a;cursor:pointer;">
            ⚔ Enter the Realm
          </button>
        </div>
      </div>
    `;

    // Stat point buttons
    this._el.querySelectorAll(".sp-plus").forEach(btn => {
      btn.addEventListener("click", () => {
        if (this._pointsLeft <= 0) return;
        const stat = btn.dataset.stat;
        this._statPoints[stat] = (this._statPoints[stat] ?? 0) + 1;
        this._pointsLeft--;
        this._render();
      });
    });

    this._el.querySelectorAll(".sp-minus").forEach(btn => {
      btn.addEventListener("click", () => {
        const stat = btn.dataset.stat;
        if ((this._statPoints[stat] ?? 0) <= 0) return;
        this._statPoints[stat]--;
        this._pointsLeft++;
        this._render();
      });
    });

    // Back button — go back to skill or replace phase
    this._el.querySelector("#sp-back").addEventListener("click", () => {
      this._phase = this._replaceSkill ? "replace" : "skill";
      this._render();
    });

    // Confirm
    this._el.querySelector("#sp-confirm").addEventListener("click", () => {
      this.hide();
      this.onConfirm?.(
        this._selectedSkill,
        this._replaceSkill,
        { ...this._statPoints }
      );
    });
  }
}
