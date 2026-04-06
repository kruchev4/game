
// src/entities/humanoidBase.js

import { HUMANOID_RIG } from "./humanoidRig.js";

/**
 * Draw a single humanoid sprite frame.
 * This is intentionally layered for future extensibility.
 */
export function drawHumanoid(ctx, sprite, frame) {
  drawBaseBody(ctx, sprite.body, frame);
  drawArmor(ctx, sprite.armor, frame);
  drawHeadgear(ctx, sprite.headgear, frame);
  drawWeapon(ctx, sprite.weapon, frame);
}

/* ---------------- base layers ---------------- */

function drawBaseBody(ctx, bodyDef, frame) {
  if (!bodyDef) return;

  // Placeholder: silhouette or body sprite draw
  // Later: palette, race, gender, etc.
}

function drawArmor(ctx, armorDef, frame) {
  if (!armorDef) return;

  // Placeholder for armor overlays
}

function drawHeadgear(ctx, headgearDef, frame) {
  if (!headgearDef) return;
}

function drawWeapon(ctx, weaponDef, frame) {
  if (!weaponDef) return;

  const { handR } = HUMANOID_RIG.anchors;

  // Later: rotate weapon around anchor during attack frames
}
