// ── MultiEngine.js ───────────────────────────────────────────────────────────
// Self-contained multiplayer module for Realm of Echoes.
// Handles Firebase signaling, WebRTC peer connections, and message routing.
//
// Usage in main.js:
//
//   import { MultiEngine } from './engine/multi/MultiEngine.js';
//
//   const multi = new MultiEngine(firebaseConfig, G);
//
//   // Wire up callbacks:
//   multi.onPartyUpdate  = (party) => { /* update HUD, render peers on map */ };
//   multi.onData         = (type, data) => { /* route to game systems */ };
//   multi.onStatusChange = (role, level, html) => { /* update lobby status UI */ };
//   multi.onLog          = (text, tag) => { /* addLog(text, tag) */ };
//
//   await multi.init();   // connect to Firebase
//   await multi.host();   // open a room as host
//   await multi.join(code); // join as peer
//   multi.broadcast(msg);   // send to all connected peers
//   multi.disconnect();     // clean up everything

import { PartyManager, PARTY_COLORS } from './partyManager.js';
import { MSG, routeMessage }          from './syncProtocol.js';

// ── WebRTC TURN/STUN config ───────────────────────────────────────────────────
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Add TURN credentials here if needed for NAT traversal:
    // { urls: 'turn:your-turn-server.com', username: '...', credential: '...' }
  ],
};

// How often (ms) the host broadcasts world state to all peers
const SYNC_INTERVAL_MS = 150;

export class MultiEngine {
  /**
   * @param {object} firebaseConfig  - Your Firebase project config object
   * @param {object} G               - Live game state reference (mutated externally)
   */
  constructor(firebaseConfig, G) {
    this._fbConfig  = firebaseConfig;
    this.G          = G;
    this.party      = new PartyManager(G);

    // Public state
    this.active     = false;   // true once a connection is established
    this.isHost     = false;
    this.roomCode   = null;
    this.myPartyIdx = 0;

    // Internal
    this._db            = null;   // Firebase database instance
    this._roomRef       = null;   // Firebase ref for current room
    this._peers         = [];     // [{ pc, conn, partyIdx }] — one per remote player
    this._syncTimer     = null;

    // ── Callbacks — override these from main.js ───────────────────────────────
    /** Called whenever the party array changes. Receives full party array. */
    this.onPartyUpdate  = (_party) => {};
    /** Called for every inbound game message. Receives (type, data). */
    this.onData         = (_type, _data) => {};
    /** Called to update lobby status UI. (role='host'|'join', level='ok'|'warn'|'err', html) */
    this.onStatusChange = (_role, _level, _html) => {};
    /** Called to append a line to the game log. */
    this.onLog          = (_text, _tag) => {};
  }

  // ── Initialisation ──────────────────────────────────────────────────────────

  /**
   * Connect to Firebase. Call once on page load (or lazily before host/join).
   * Safe to call multiple times — skips if already connected.
   */
  async init() {
    if (this._db) return;   // already connected

    if (!window.firebase) {
      throw new Error('[MultiEngine] Firebase SDK not loaded. Add the compat script tags.');
    }

    // Initialise or reuse existing Firebase app
    if (!firebase.apps.length) {
      firebase.initializeApp(this._fbConfig);
    }
    this._db = firebase.database();
    console.log('[MultiEngine] Firebase connected.');
  }

  // ── Host ────────────────────────────────────────────────────────────────────

  /**
   * Open a room as host. Returns the 6-digit room code.
   */
  async host() {
    await this.init();

    this.isHost   = true;
    this.myPartyIdx = 0;
    const code    = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('');
    this.roomCode = code;

    // Seed party with host's own data
    this.party.setParty([this.party.buildMyPlayerData(0)]);
    this._notifyPartyUpdate();

    const roomRef = this._db.ref('rooms/' + code);
    this._roomRef = roomRef;

    // Clear any stale data, write host presence
    await roomRef.remove();
    await roomRef.child('host').set({ name: this.G.name, ts: Date.now() });

    // Clean up room from Firebase when host closes tab
    roomRef.onDisconnect().remove();

    // Watch for incoming peer offers (one per peer)
    roomRef.child('offers').on('child_added', snap => {
      const offer = snap.val();
      if (offer?.sdp) this._handleIncomingOffer(roomRef, snap.key, offer);
    });

    this._startSyncLoop();
    this.onStatusChange('host', 'warn', `Room <strong>${code}</strong> open — share this code!`);
    this.onLog(`Co-op room opened: ${code}`, 'sys');

    return code;
  }

  /** Handle a new peer offer arriving in Firebase. */
  async _handleIncomingOffer(roomRef, offerId, offer) {
    const peerSlot  = { pc: null, conn: null, partyIdx: -1 };
    const pc        = new RTCPeerConnection(RTC_CONFIG);
    peerSlot.pc     = pc;

    const iceQueue  = [];
    let   remoteReady = false;

    const flushIce = async () => {
      remoteReady = true;
      for (const ic of iceQueue) {
        try { await pc.addIceCandidate(new RTCIceCandidate(ic)); } catch (_) {}
      }
      iceQueue.length = 0;
    };

    // Receive data channel opened by peer
    pc.ondatachannel = e => {
      const ch   = e.channel;
      const conn = {
        send: d => ch.readyState === 'open' && ch.send(JSON.stringify(d)),
      };
      peerSlot.conn = conn;

      ch.onopen = () => {
        this._peers.push(peerSlot);
        this.onStatusChange('host', 'ok', `Party: ${this.party.size} player(s). Connected!`);
        this._startSyncLoop();
      };

      ch.onmessage = e => {
        try { this._handleMessage(JSON.parse(e.data), peerSlot); } catch (_) {}
      };

      ch.onclose = () => {
        this._removePeer(peerSlot);
      };
    };

    pc.onicecandidate = e => {
      if (e.candidate) {
        roomRef.child(`answers/${offerId}/host_ice`).push(e.candidate.toJSON());
      }
    };

    // SDP negotiation
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await roomRef.child(`answers/${offerId}/sdp`).set({ sdp: answer.sdp, type: answer.type });
      await flushIce();
    } catch (e) {
      console.error('[MultiEngine Host] SDP negotiation failed:', e);
    }

    // Watch peer ICE candidates
    roomRef.child(`offers/${offerId}/peer_ice`).on('value', snap => {
      const cs = snap.val();
      if (!cs) return;
      Object.values(cs).forEach(async ic => {
        if (remoteReady) {
          try { await pc.addIceCandidate(new RTCIceCandidate(ic)); } catch (_) {}
        } else {
          iceQueue.push(ic);
        }
      });
    });
  }

  // ── Join ────────────────────────────────────────────────────────────────────

  /**
   * Join an existing room as a peer.
   * @param {string} code - 6-digit room code
   */
  async join(code) {
    if (!/^\d{6}$/.test(code)) {
      this.onStatusChange('join', 'err', 'Enter a 6-digit room code.');
      return;
    }
    await this.init();

    this.isHost   = false;
    this.roomCode = code;
    this.onStatusChange('join', 'warn', `Looking for room ${code}…`);

    const roomRef = this._db.ref('rooms/' + code);
    this._roomRef = roomRef;

    const hostData = await roomRef.child('host').get().then(s => s.val());
    if (!hostData) {
      this.onStatusChange('join', 'err', `Room ${code} not found.`);
      return;
    }
    this.onStatusChange('join', 'warn', 'Found room — connecting…');

    const pc       = new RTCPeerConnection(RTC_CONFIG);
    const offerId  = Date.now().toString(36);   // unique key for this peer's offer

    const iceQueue   = [];
    let   remoteReady = false;

    const flushIce = async () => {
      remoteReady = true;
      for (const ic of iceQueue) {
        try { await pc.addIceCandidate(new RTCIceCandidate(ic)); } catch (_) {}
      }
      iceQueue.length = 0;
    };

    // Create data channel
    const ch   = pc.createDataChannel('game', { ordered: true });
    const peerSlot = { pc, conn: null, partyIdx: 0 };

    const conn = {
      send: d => ch.readyState === 'open' && ch.send(JSON.stringify(d)),
    };
    peerSlot.conn = conn;
    this._peers   = [peerSlot];

    ch.onopen = () => {
      this.onStatusChange('join', 'ok', 'Connected! Joining party…');
      conn.send({ type: MSG.PLAYER_JOIN, player: this.party.buildMyPlayerData(0) });
      this.active = true;
    };

    ch.onmessage = e => {
      try { this._handleMessage(JSON.parse(e.data), peerSlot); } catch (_) {}
    };

    ch.onclose = () => {
      this.active = false;
      this._peers = [];
      this.onStatusChange('join', 'warn', 'Disconnected from host.');
      this.onLog('Disconnected from party.', 'sys');
      this._notifyPartyUpdate();
    };

    pc.onicecandidate = e => {
      if (e.candidate) {
        roomRef.child(`offers/${offerId}/peer_ice`).push(e.candidate.toJSON());
      }
    };

    // Send offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await roomRef.child(`offers/${offerId}`).set({ sdp: offer.sdp, type: offer.type });

    // Watch for answer
    roomRef.child(`answers/${offerId}/sdp`).on('value', async snap => {
      const answer = snap.val();
      if (!answer?.sdp || pc.signalingState !== 'have-local-offer') return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        roomRef.child(`answers/${offerId}/sdp`).off();
        await flushIce();
      } catch (e) {
        console.warn('[MultiEngine Peer] setRemoteDescription failed:', e);
      }
    });

    // Watch for host ICE
    roomRef.child(`answers/${offerId}/host_ice`).on('value', snap => {
      const cs = snap.val();
      if (!cs) return;
      Object.values(cs).forEach(async ic => {
        if (remoteReady) {
          try { await pc.addIceCandidate(new RTCIceCandidate(ic)); } catch (_) {}
        } else {
          iceQueue.push(ic);
        }
      });
    });

    setTimeout(() => {
      if (!this.active) this.onStatusChange('join', 'err', 'Timed out. Make sure host has room open.');
    }, 30000);
  }

  // ── Messaging ───────────────────────────────────────────────────────────────

  /**
   * Send a message to all connected peers.
   * If called by a peer (not host), sends only to host — host relays.
   */
  broadcast(data) {
    for (const p of this._peers) {
      p.conn?.send(data);
    }
  }

  /**
   * Send a message to a specific peer by partyIdx.
   */
  sendTo(partyIdx, data) {
    const p = this._peers.find(p => p.partyIdx === partyIdx);
    p?.conn?.send(data);
  }

  /** Handle an inbound message from any peer. */
  _handleMessage(data, fromPeer) {
    switch (data.type) {

      case MSG.PLAYER_JOIN: {
        if (!this.isHost) break;
        const idx = this.party.addPeer(data.player, fromPeer.peer || 'peer');
        fromPeer.partyIdx = idx;
        // Send welcome with their assigned index + full world state
        fromPeer.conn.send({
          type:        MSG.WELCOME,
          partyIdx:    idx,
          party:       this.party.party,
          worldState:  this.party.buildWorldSnapshot(),
        });
        // Tell everyone else
        this.broadcast({ type: MSG.PARTY_UPDATE, party: this.party.party });
        this.onLog(`⚔ ${data.player.name} (${data.player.cls}) joined the party!`, 'disc');
        this.onStatusChange('host', 'ok', `Party: ${this.party.size} player(s).`);
        this._notifyPartyUpdate();
        break;
      }

      case MSG.WELCOME: {
        this.myPartyIdx = data.partyIdx;
        this.G.partyIdx = data.partyIdx;
        this.party.setParty(data.party);
        this.active = true;
        this.onLog(`Joined party as ${this.G.name}!`, 'disc');
        this._notifyPartyUpdate();
        // Let game systems know about the world snapshot
        this.onData(MSG.WELCOME, data);
        break;
      }

      case MSG.PARTY_UPDATE: {
        this.party.setParty(data.party);
        this._notifyPartyUpdate();
        break;
      }

      case MSG.WORLD_SYNC: {
        // Update remote members' positions and vitals
        data.members?.forEach(m => {
          if (m.partyIdx !== this.myPartyIdx) {
            this.party.updateMember(m.partyIdx, m);
          }
        });
        this._notifyPartyUpdate();
        this.onData(MSG.WORLD_SYNC, data);
        break;
      }

      case MSG.PLAYER_MOVE: {
        if (data.partyIdx !== this.myPartyIdx) {
          this.party.updateMember(data.partyIdx, { x: data.x, y: data.y });
        }
        // If host, relay to all other peers
        if (this.isHost) {
          this._relayExcept(data, fromPeer);
        }
        this.onData(MSG.PLAYER_MOVE, data);
        break;
      }

      case MSG.PLAYER_STAT: {
        if (data.partyIdx !== this.myPartyIdx) {
          this.party.updateMember(data.partyIdx, { hp: data.hp, hpMax: data.hpMax, mp: data.mp, mpMax: data.mpMax });
        }
        if (this.isHost) this._relayExcept(data, fromPeer);
        this.onData(MSG.PLAYER_STAT, data);
        break;
      }

      case MSG.CHAT: {
        if (this.isHost) this._relayExcept(data, fromPeer);
        this.onData(MSG.CHAT, data);
        break;
      }

      default: {
        // Relay anything else from peers if we're host
        if (this.isHost) this._relayExcept(data, fromPeer);
        // Always pass to game
        this.onData(data.type, data);
        break;
      }
    }
  }

  /** Relay a message to all peers except the sender. */
  _relayExcept(data, excludePeer) {
    for (const p of this._peers) {
      if (p !== excludePeer) p.conn?.send(data);
    }
  }

  // ── Sync loop ───────────────────────────────────────────────────────────────

  /** Host broadcasts world state periodically. */
  _startSyncLoop() {
    if (this._syncTimer || !this.isHost) return;
    this._syncTimer = setInterval(() => {
      if (!this._peers.length) return;
      this.broadcast({
        type:    MSG.WORLD_SYNC,
        members: this.party.buildWorldSnapshot().members,
      });
    }, SYNC_INTERVAL_MS);
  }

  _stopSyncLoop() {
    clearInterval(this._syncTimer);
    this._syncTimer = null;
  }

  // ── Peer cleanup ─────────────────────────────────────────────────────────────

  _removePeer(peerSlot) {
    const name = this.party.party[peerSlot.partyIdx]?.name || 'A player';
    this._peers = this._peers.filter(p => p !== peerSlot);
    this.party.removePeer(peerSlot.partyIdx);
    this.broadcast({ type: MSG.PARTY_UPDATE, party: this.party.party });
    this.onLog(`${name} left the party.`, 'sys');
    this._notifyPartyUpdate();
    if (this._peers.length === 0) this._stopSyncLoop();
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  _notifyPartyUpdate() {
    this.onPartyUpdate(this.party.party);
    this.party.renderLobbyList();
    this.party.renderHUD(this.isHost, this.myPartyIdx);
  }

  // ── Disconnect ──────────────────────────────────────────────────────────────

  /** Clean up all connections and Firebase listeners. */
  disconnect() {
    this._stopSyncLoop();
    for (const p of this._peers) {
      try { p.pc?.close(); } catch (_) {}
    }
    this._peers   = [];
    this._roomRef?.off();
    this._roomRef = null;
    this.active   = false;
    this.roomCode = null;
    this.party.setParty([]);
    this._notifyPartyUpdate();
    console.log('[MultiEngine] Disconnected.');
  }

  // ── Convenience getters ──────────────────────────────────────────────────────

  get partySize()  { return this.party.size; }
  get partyArray() { return this.party.party; }
}
