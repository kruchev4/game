/**
 * SaveProvider.js
 *
 * Handles reading and writing save slots.
 * Strategy:
 *   1. Try Supabase (persists across devices, requires `saves` table)
 *   2. Fall back to localStorage silently if Supabase fails or is unavailable
 *
 * Save slot schema:
 * {
 *   slot:      number (1-5),
 *   name:      string,
 *   classId:   string,
 *   stats:     { STR, DEX, INT, CON, WIS, CHA },
 *   position:  { worldId, x, y },
 *   gold:      number,
 *   inventory: [],
 *   savedAt:   ISO timestamp
 * }
 *
 * Supabase table required:
 *   CREATE TABLE saves (
 *     id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     slot      int NOT NULL,
 *     client_id text NOT NULL,
 *     data      jsonb NOT NULL,
 *     saved_at  timestamptz DEFAULT now()
 *   );
 *   CREATE UNIQUE INDEX saves_slot_client ON saves(slot, client_id);
 *
 * client_id is a random UUID stored in localStorage — identifies this browser.
 * No auth required. For future multiplayer, swap with real user id.
 */

import { createClient }        from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config/supabaseConfig.js";

const MAX_SLOTS    = 5;
const LS_PREFIX    = "roe_save_slot_";
const LS_CLIENT_ID = "roe_client_id";

function getClientId() {
  let id = localStorage.getItem(LS_CLIENT_ID);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(LS_CLIENT_ID, id);
  }
  return id;
}

export class SaveProvider {
  constructor() {
    this._supabase  = null;
    this._clientId  = getClientId();
    this._useSupabase = false;

    try {
      this._supabase    = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      this._useSupabase = true;
    } catch {
      console.warn("[SaveProvider] Supabase unavailable — using localStorage");
    }
  }

  // ─────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────

  /**
   * Load all 5 slots. Returns array of length MAX_SLOTS.
   * Empty slots have value null.
   * @returns {Promise<Array<object|null>>}
   */
  async loadAll() {
    const slots = new Array(MAX_SLOTS).fill(null);

    if (this._useSupabase) {
      try {
        const { data, error } = await this._supabase
          .from("saves")
          .select("slot, data")
          .eq("client_id", this._clientId);

        if (!error && data) {
          for (const row of data) {
            const idx = row.slot - 1;
            if (idx >= 0 && idx < MAX_SLOTS) {
              slots[idx] = row.data;
            }
          }
          return slots;
        }
      } catch {
        console.warn("[SaveProvider] Supabase read failed — falling back to localStorage");
      }
    }

    // localStorage fallback
    for (let i = 0; i < MAX_SLOTS; i++) {
      const raw = localStorage.getItem(`${LS_PREFIX}${i + 1}`);
      if (raw) {
        try { slots[i] = JSON.parse(raw); }
        catch { /* corrupt save — leave as null */ }
      }
    }

    return slots;
  }

  /**
   * Save character data into a specific slot (1-based).
   * @param {number} slot  1–5
   * @param {object} data  Save data object
   */
  async save(slot, data) {
    if (slot < 1 || slot > MAX_SLOTS) throw new Error(`Invalid slot: ${slot}`);

    const payload = { ...data, slot, savedAt: new Date().toISOString() };

    if (this._useSupabase) {
      try {
        const { error } = await this._supabase
          .from("saves")
          .upsert(
            { slot, client_id: this._clientId, data: payload },
            { onConflict: "slot,client_id" }
          );

        if (!error) {
          // Mirror to localStorage as backup
          localStorage.setItem(`${LS_PREFIX}${slot}`, JSON.stringify(payload));
          return;
        }
        console.warn("[SaveProvider] Supabase write failed — falling back to localStorage", error);
      } catch (e) {
        console.warn("[SaveProvider] Supabase exception — falling back to localStorage", e);
      }
    }

    // localStorage fallback
    localStorage.setItem(`${LS_PREFIX}${slot}`, JSON.stringify(payload));
  }

  /**
   * Delete a save slot.
   * @param {number} slot  1–5
   */
  async delete(slot) {
    if (slot < 1 || slot > MAX_SLOTS) return;

    localStorage.removeItem(`${LS_PREFIX}${slot}`);

    if (this._useSupabase) {
      try {
        await this._supabase
          .from("saves")
          .delete()
          .eq("slot", slot)
          .eq("client_id", this._clientId);
      } catch {
        // Non-fatal
      }
    }
  }

  get maxSlots() { return MAX_SLOTS; }
}
