// ── syncProtocol.js ──────────────────────────────────────────────────────────
// Message type constants and inbound message routing.
// Import this wherever you need to send or handle multiplayer messages.

export const MSG = {
  // Connection lifecycle
  PLAYER_JOIN:    'player_join',    // peer → host: "I just connected"
  WELCOME:        'welcome',        // host → peer: party state + world snapshot
  PARTY_UPDATE:   'party_update',   // host → all:  full party array changed
  PLAYER_LEAVE:   'player_leave',   // host → all:  a peer disconnected

  // World sync (host → all, periodic)
  WORLD_SYNC:     'world_sync',     // positions + vitals for all members

  // Player actions (any → host → all)
  PLAYER_MOVE:    'player_move',    // { partyIdx, x, y }
  PLAYER_STAT:    'player_stat',    // { partyIdx, hp, hpMax, mp, mpMax }
  CHAT:           'chat',           // { name, text }

  // Combat
  COMBAT_START:   'combat_start',   // host → all: { enemies }
  COMBAT_ACTION:  'combat_action',  // any → host: { partyIdx, action, target }
  MEMBER_QUEUED:  'member_queued',  // host → all: { partyIdx, action }
  COMBAT_END:     'combat_end',     // host → all: { result, loot }

  // Dungeon
  DUNGEON_INVITE: 'dungeon_invite', // host → all: { campaignId, name, desc }
  DUNGEON_ACCEPT: 'dungeon_accept', // peer → host: { partyIdx }
  DUNGEON_DECLINE:'dungeon_decline',// peer → host: { partyIdx }
  START_CAMPAIGN: 'start_campaign', // host → all: { url }
};

/**
 * Route an inbound message to the appropriate callback.
 * @param {object}   data      - Parsed message object (must have .type)
 * @param {object}   handlers  - Map of MSG constant → handler function
 */
export function routeMessage(data, handlers) {
  const handler = handlers[data.type];
  if (handler) {
    handler(data);
  } else {
    console.warn('[MultiEngine] Unhandled message type:', data.type);
  }
}
