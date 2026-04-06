/**
 * SaveProvider.js
 *
 * Reads and writes save slots using the `player_saves` Supabase table.
 * Falls back to localStorage if Supabase fails.
 *
 * Table schema (existing):
 *   player_saves (
 *     id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     player_token text NOT NULL,
 *     char_name    text,
 *     data         jsonb
 *   )
 */

import { createClient }               from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config/supabaseConfig.js";

const MAX_SLOTS       = 5;
const LS_PREFIX       = "roe_save_slot_";
const LS_PLAYER_TOKEN = "roe_player_token";

function getPlayerToken() {
  let token = localStorage.getItem(LS_PLAYER_TOKEN);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(LS_PLAYER_TOKEN, token);
  }
  return token;
}

/** Supabase sometimes returns jsonb as a string — parse if needed */
function parseData(raw) {
  if (!raw) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
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
              const save = parseData(row.data);
              if (!save) continue;
              const idx = (save.slot ?? 1) - 1;
              if (idx >= 0 && idx < MAX_SLOTS) {
                slots[idx] = save;
              }
            }
            this._mirrorToLocalStorage(slots);
            return slots;
          }

          console.warn("[SaveProvider] Supabase loadAll error:", error?.message);
        } catch (e) {
          console.warn("[SaveProvider] Supabase read failed:", e.message);
        }
      }

      // localStorage fallback
      for (let i = 0; i < MAX_SLOTS; i++) {
        const raw = localStorage.getItem(`${LS_PREFIX}${i + 1}`);
        if (raw) {
          try { slots[i] = JSON.parse(raw); } catch { /* corrupt */ }
        }
      }

    } catch (e) {
      console.warn("[SaveProvider] loadAll failed entirely:", e.message);
    }

    return slots;
  }

  async save(slot, data) {
    if (slot < 1 || slot > MAX_SLOTS) {
      console.warn(`[SaveProvider] Invalid slot: ${slot}`);
      return;
    }

    const payload = { ...data, slot, savedAt: new Date().toISOString() };

    // Always localStorage first — instant, no network dependency
    localStorage.setItem(`${LS_PREFIX}${slot}`, JSON.stringify(payload));

    if (this._useSupabase) {
      try {
        const { data: rows, error: selError } = await this._supabase
          .from("player_saves")
          .select("*")
          .eq("player_token", this._playerToken);

        if (selError) console.warn("[SaveProvider] Select failed:", selError.message);

        console.log("[SaveProvider] Rows from Supabase:", rows?.length, rows?.map(r => ({ id: r.id, dataType: typeof r.data, slot: parseData(r.data)?.slot })));

        // Parse data column — may be string or object
        const existing = (rows ?? []).find(r => parseData(r.data)?.slot === slot);

        if (existing?.id) {
          const { error } = await this._supabase
            .from("player_saves")
            .update({ char_name: payload.name, data: payload })
            .eq("id", existing.id);
          if (error) console.warn("[SaveProvider] Update failed:", error.message);
          else console.log(`[SaveProvider] Saved slot ${slot} (update)`);
        } else {
          const { error } = await this._supabase
            .from("player_saves")
            .insert({ player_token: this._playerToken, char_name: payload.name, data: payload });
          if (error) console.warn("[SaveProvider] Insert failed:", error.message);
          else console.log(`[SaveProvider] Saved slot ${slot} (insert)`);
        }
      } catch (e) {
        console.warn("[SaveProvider] Save exception:", e.message);
      }
    }
  }

  async delete(slot) {
    if (slot < 1 || slot > MAX_SLOTS) return;

    localStorage.removeItem(`${LS_PREFIX}${slot}`);

    if (this._useSupabase) {
      try {
        const { data: rows } = await this._supabase
          .from("player_saves")
          .select("*")
          .eq("player_token", this._playerToken);

        const target = (rows ?? []).find(r => parseData(r.data)?.slot === slot);
        if (target?.id) {
          await this._supabase
            .from("player_saves")
            .delete()
            .eq("id", target.id);
        }
      } catch (e) {
        console.warn("[SaveProvider] Delete failed:", e.message);
      }
    }
  }

  get maxSlots() { return MAX_SLOTS; }

  _mirrorToLocalStorage(slots) {
    for (let i = 0; i < slots.length; i++) {
      const key = `${LS_PREFIX}${i + 1}`;
      if (slots[i]) localStorage.setItem(key, JSON.stringify(slots[i]));
      else          localStorage.removeItem(key);
    }
  }
}
