// ── partyManager.js ──────────────────────────────────────────────────────────
// Owns the coopParty array and all party-related UI rendering.
// Depends on G (game state) being passed in at init — no direct global reads.

export const PARTY_COLORS = ['#c9a227', '#4a9eff', '#ff6b6b', '#6bff6b'];

export class PartyManager {
  constructor(G) {
    this.G     = G;
    this.party = [];   // array of player data objects, index = partyIdx
  }

  // ── Data builders ──────────────────────────────────────────────────────────

  /** Build this player's shareable data object. partyIdx assigned by host. */
  buildMyPlayerData(partyIdx = 0) {
    const G = this.G;
    return {
      partyIdx,
      name:   G.name,
      cls:    G.cls,
      race:   G.race  || '',
      level:  G.level || 1,
      hp:     G.hp,
      hpMax:  G.hpMax,
      mp:     G.mp,
      mpMax:  G.mpMax,
      x:      G.x,
      y:      G.y,
      color:  PARTY_COLORS[partyIdx % PARTY_COLORS.length],
    };
  }

  /** Snapshot of all party positions + vitals (used in welcome message). */
  buildWorldSnapshot() {
    const G = this.G;
    const members = this.party.map((p, i) => p ? {
      partyIdx: i,
      name:     p.name,
      cls:      p.cls,
      color:    p.color || PARTY_COLORS[i % PARTY_COLORS.length],
      x:        i === 0 ? G.x    : (p.x    || 30),
      y:        i === 0 ? G.y    : (p.y    || 22),
      hp:       i === 0 ? G.hp   : (p.hp   || 10),
      hpMax:    i === 0 ? G.hpMax: (p.hpMax|| 10),
      mp:       i === 0 ? G.mp   : (p.mp   || 10),
      mpMax:    i === 0 ? G.mpMax: (p.mpMax|| 10),
      level:    i === 0 ? G.level: (p.level||  1),
    } : null).filter(Boolean);
    return { members, hostX: G.x, hostY: G.y };
  }

  // ── Party mutation ─────────────────────────────────────────────────────────

  /** Add a new peer to the party. Returns the assigned partyIdx. */
  addPeer(playerData, peerId) {
    const idx   = this.party.length;
    playerData.partyIdx = idx;
    playerData.peerId   = peerId;
    playerData.color    = PARTY_COLORS[idx % PARTY_COLORS.length];
    playerData.x        = this.G.x;
    playerData.y        = this.G.y;
    this.party[idx]     = playerData;
    return idx;
  }

  /** Remove a peer by partyIdx. Compacts the array. */
  removePeer(partyIdx) {
    this.party[partyIdx] = null;
    this.party = this.party.filter(Boolean);
    // Re-assign indices after compaction
    this.party.forEach((p, i) => { p.partyIdx = i; });
  }

  /** Replace the full party array (from a welcome or party_update message). */
  setParty(partyArray) {
    this.party = partyArray.filter(Boolean);
  }

  /** Update a single member's fields (position, vitals, etc.). */
  updateMember(partyIdx, fields) {
    if (this.party[partyIdx]) {
      Object.assign(this.party[partyIdx], fields);
    }
  }

  get size() { return this.party.filter(Boolean).length; }

  // ── UI rendering ───────────────────────────────────────────────────────────

  /** Render the lobby player list (#coop-player-list). */
  renderLobbyList() {
    const list = document.getElementById('coop-player-list');
    if (!list) return;
    list.innerHTML = this.party.filter(Boolean).map((p, i) => `
      <div class="player-row">
        <div class="player-dot" style="background:${p.color || PARTY_COLORS[i]}"></div>
        <div class="player-name-display">${p.name}</div>
        <div class="player-class-display">${p.race || ''} ${p.cls} · Lv.${p.level}</div>
      </div>`).join('');
  }

  /** Render the in-game party HUD (#party-hud). */
  renderHUD(isHost, myPartyIdx) {
    const hud = document.getElementById('party-hud');
    if (!hud) return;

    const G = this.G;
    const active = this.party.filter(Boolean);

    if (active.length < 2) {
      hud.style.display = 'none';
      return;
    }

    hud.style.display = 'flex';
    hud.innerHTML = active.map((p, i) => {
      const hp    = (isHost && i === 0) || (!isHost && i === myPartyIdx) ? G.hp    : (p.hp    || 0);
      const hpMax = (isHost && i === 0) || (!isHost && i === myPartyIdx) ? G.hpMax : (p.hpMax || 1);
      const pct   = Math.max(0, hp / hpMax * 100);
      const color = p.color || PARTY_COLORS[i % PARTY_COLORS.length];
      const isMe  = (isHost && i === 0) || (!isHost && p.partyIdx === myPartyIdx);

      return `<div style="display:flex;align-items:center;gap:5px;padding:3px 6px;
          border:1px solid ${isMe ? color : '#3a2010'};background:rgba(0,0,0,.4);min-width:110px;">
        <span style="color:${color};font-size:.6rem;">●</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.58rem;color:${color};font-family:Cinzel,serif;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}${isMe ? ' ★' : ''}</div>
          <div style="height:4px;background:#1a0e06;margin-top:2px;">
            <div style="width:${pct}%;height:100%;background:${color};opacity:.8;transition:width .3s;"></div>
          </div>
        </div>
        <span style="font-size:.56rem;color:#7a6050;">${hp}/${hpMax}</span>
      </div>`;
    }).join('');
  }
}
