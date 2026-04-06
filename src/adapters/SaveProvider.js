/**
 * SaveProvider.js
 *
 * Reads and writes save slots using the `player_saves` Supabase table.
 * Falls back to localStorage if Supabase fails.
 *
 * Table schema (existing):
 *   player_saves (
 *     uuid         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     player_token text NOT NULL,   -- browser identity (stored in localStorage)
 *     char_name    text,            -- character name (for quick display)
 *     data         jsonb            -- full save data
 *   )
 *
 * Save data shape stored in `data`:
 *   {
 *     slot:      number,   -- 1-5, which slot this belongs to
 *     name:      string,
 *     raceId:    string,
 *     classId:   string,
 *     stats:     object,
 *     position:  { worldId, x, y },
 *     gold:      number,
 *     inventory: [],
 *     savedAt:   ISO string
 *   }
 */

import { createClient }               from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config/supabaseConfig.js";

const MAX_SLOTS      = 5;
const LS_PREFIX      = "roe_save_slot_";
const LS_PLAYER_TOKEN = "roe_player_token";

function getPlayerToken() {
  let token = localStorage.getItem(LS_PLAYER_TOKEN);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(LS_PLAYER_TOKEN, token);
  }
  return token;
}

export class SaveProvider {
  constructor() {
    this._supabase    = null;
    this._useSupabase = false;
    this._playerToken = getPlayerToken();

    try {
      this._supabase    = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      this._useSupabase = true;
    } catch {
      console.warn("[SaveProvider] Supabase unavailable — using localStorage only");
    }
  }

  // ─────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────

  /**
   * Load all slots for this player.
   * Always returns an array of length MAX_SLOTS, nulls for empty slots.
   */
  async loadAll() {
    const slots = new Array(MAX_SLOTS).fill(null);

    try {
      if (this._useSupabase) {
        try {
          const { data, error } = await this._supabase
            .from("player_saves")
            .select("*")
            .eq("player_token", this._playerToken);

          if (!error && data) {
            for (const row of data) {
              const save = row.data;
              if (!save) continue;
              const idx = (save.slot ?? 1) - 1;
              if (idx >= 0 && idx < MAX_SLOTS) {
                slots[idx] = save;
              }
            }
            // Mirror to localStorage as backup
            this._mirrorToLocalStorage(slots);
            return slots;
          }

          console.warn("[SaveProvider] Supabase error:", error?.message);
        } catch (e) {
          console.warn("[SaveProvider] Supabase read failed:", e.message);
        }
      }

      // localStorage fallback
      for (let i = 0; i < MAX_SLOTS; i++) {
        const raw = localStorage.getItem(`${LS_PREFIX}${i + 1}`);
        if (raw) {
          try { slots[i] = JSON.parse(raw); }
          catch { /* corrupt — leave null */ }
        }
      }

    } catch (e) {
      console.warn("[SaveProvider] loadAll failed entirely:", e.message);
    }

    return slots;
  }

  /**
   * Save a character into a slot (1-based).
   */
  async save(slot, data) {
    if (slot < 1 || slot > MAX_SLOTS) {
      console.warn(`[SaveProvider] Invalid slot: ${slot}`);
      return;
    }

    const payload = {
      ...data,
      slot,
      savedAt: new Date().toISOString()
    };

    // Always save to localStorage first (instant, no network)
    localStorage.setItem(`${LS_PREFIX}${slot}`, JSON.stringify(payload));

    if (this._useSupabase) {
      try {
        // Select all columns — avoids issues if column names differ from expected
        const { data: rows, error: selError } = await this._supabase
          .from("player_saves")
          .select("*")
          .eq("player_token", this._playerToken);

        if (selError) {
          console.warn("[SaveProvider] Select failed:", selError.message);
        }

        // Find the row matching this slot by checking the data JSON
        const existing = (rows ?? []).find(r =>
          r.data?.slot === slot || r.slot === slot
        );

        // Use whichever id column exists
        const rowId = existing?.id;

        if (rowId) {
          const { error } = await this._supabase
            .from("player_saves")
            .update({ char_name: payload.name, data: payload })
            .eq("id", rowId);

          if (error) console.warn("[SaveProvider] Update failed:", error.message);
        } else {
          const { error } = await this._supabase
            .from("player_saves")
            .insert({ player_token: this._playerToken, char_name: payload.name, data: payload });

          if (error) console.warn("[SaveProvider] Insert failed:", error.message);
        }
      } catch (e) {
        console.warn("[SaveProvider] Supabase save exception:", e.message);
      }
    }
  }

  /**
   * Delete a save slot (1-based).
   */
  async delete(slot) {
    if (slot < 1 || slot > MAX_SLOTS) return;

    localStorage.removeItem(`${LS_PREFIX}${slot}`);

    if (this._useSupabase) {
      try {
        const { data: rows } = await this._supabase
          .from("player_saves")
          .select("*")
          .eq("player_token", this._playerToken);

        const target = (rows ?? []).find(r =>
          r.data?.slot === slot || r.slot === slot
        );
        const rowId = target?.id;
        const idCol = "id";

        if (rowId) {
          await this._supabase
            .from("player_saves")
            .delete()
            .eq(idCol, rowId);
        }
      } catch (e) {
        console.warn("[SaveProvider] Supabase delete failed:", e.message);
      }
    }
  }

  get maxSlots() { return MAX_SLOTS; }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  _mirrorToLocalStorage(slots) {
    for (let i = 0; i < slots.length; i++) {
      const key = `${LS_PREFIX}${i + 1}`;
      if (slots[i]) {
        localStorage.setItem(key, JSON.stringify(slots[i]));
      } else {
        localStorage.removeItem(key);
      }
    }
  }
}
