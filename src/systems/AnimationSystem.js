/**
 * AnimationSystem.js
 *
 * Manages per-entity animation states and projectiles.
 * Called by Renderer each frame to get current animation data.
 *
 * Animation states:
 *   idle      — gentle bob
 *   attack    — lunge forward toward target
 *   hit       — flash white, knock back
 *   dying     — fall and fade
 *   healing   — green pulse upward
 *   casting   — glow pulse
 *   levelup   — gold burst
 */

export class AnimationSystem {
  constructor() {
    this._anims      = new Map(); // entityId -> AnimState
    this._projectiles = [];       // active projectiles
    this._particles   = [];       // active particles
    this._frame       = 0;
  }

  // ── Update ──────────────────────────────────────────────────────────────

  update() {
    this._frame++;

    // Tick entity animations
    for (const [id, anim] of this._anims) {
      anim.elapsed++;
      if (anim.elapsed >= anim.duration) {
        anim.done = true;
        this._anims.delete(id);
      }
    }

    // Tick projectiles
    this._projectiles = this._projectiles.filter(p => {
      p.elapsed++;
      const t = p.elapsed / p.duration;
      p.x = p.startX + (p.endX - p.startX) * t;
      p.y = p.startY + (p.endY - p.startY) * t;
      return p.elapsed < p.duration;
    });

    // Tick particles
    this._particles = this._particles.filter(p => {
      p.elapsed++;
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += p.gravity ?? 0;
      p.alpha = Math.max(0, 1 - p.elapsed / p.duration);
      return p.elapsed < p.duration;
    });
  }

  // ── Trigger animations ───────────────────────────────────────────────────

  playAttack(entityId, dirX, dirY) {
    this._anims.set(entityId, {
      type: "attack", elapsed: 0, duration: 12,
      dirX: dirX ?? 0, dirY: dirY ?? 0
    });
  }

  playHit(entityId) {
    this._anims.set(entityId, {
      type: "hit", elapsed: 0, duration: 10
    });
  }

  playDying(entityId) {
    this._anims.set(entityId, {
      type: "dying", elapsed: 0, duration: 40
    });
  }

  playHeal(entityId) {
    this._anims.set(entityId, {
      type: "healing", elapsed: 0, duration: 30
    });
    // Green rising particles
    for (let i = 0; i < 6; i++) {
      this._particles.push({
        x: 0, y: 0, // set relative, resolved in renderer
        entityId,
        offsetX: (Math.random() - 0.5) * 20,
        offsetY: -Math.random() * 10,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -1 - Math.random(),
        gravity: 0,
        color: "#44ee66",
        size: 2 + Math.random() * 3,
        alpha: 1,
        elapsed: 0,
        duration: 20 + Math.floor(Math.random() * 15)
      });
    }
  }

  playLevelUp(entityId) {
    this._anims.set(entityId, {
      type: "levelup", elapsed: 0, duration: 60
    });
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      this._particles.push({
        entityId,
        offsetX: 0, offsetY: 0,
        vx: Math.cos(angle) * (1 + Math.random()),
        vy: Math.sin(angle) * (1 + Math.random()) - 1,
        gravity: 0.05,
        color: "#f1c40f",
        size: 3 + Math.random() * 3,
        alpha: 1,
        elapsed: 0,
        duration: 40 + Math.floor(Math.random() * 20)
      });
    }
  }

  // ── Projectiles ──────────────────────────────────────────────────────────

  /**
   * Launch a projectile from one world position to another.
   * @param {object} opts
   */
  spawnProjectile({ type, startX, startY, endX, endY, color, speed = 8 }) {
    const dx   = endX - startX;
    const dy   = endY - startY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const duration = Math.max(6, Math.round(dist / speed * 3));

    this._projectiles.push({
      type, startX, startY, endX, endY,
      x: startX, y: startY,
      color: color ?? "#ffdd44",
      elapsed: 0, duration,
      angle: Math.atan2(dy, dx)
    });
  }

  spawnArrow(startX, startY, endX, endY) {
    this.spawnProjectile({
      type: "arrow", startX, startY, endX, endY,
      color: "#c8a96e", speed: 10
    });
  }

  spawnHolyBolt(startX, startY, endX, endY) {
    this.spawnProjectile({
      type: "holy", startX, startY, endX, endY,
      color: "#ffffaa", speed: 7
    });
  }

  spawnSpellBolt(startX, startY, endX, endY, color = "#aa44ff") {
    this.spawnProjectile({
      type: "spell", startX, startY, endX, endY,
      color, speed: 8
    });
  }

  // ── AOE markers ──────────────────────────────────────────────────────────

  spawnAOE({ x, y, radius, color, duration = 30 }) {
    this._particles.push({
      type: "aoe",
      x, y, radius,
      offsetX: 0, offsetY: 0,
      vx: 0, vy: 0,
      color: color ?? "rgba(255,100,0,0.4)",
      alpha: 1,
      elapsed: 0,
      duration
    });
  }

  // ── Query ────────────────────────────────────────────────────────────────

  getAnim(entityId) {
    return this._anims.get(entityId) ?? null;
  }

  get projectiles()  { return this._projectiles; }
  get particles()    { return this._particles; }

  /** Get animation-driven render params for an entity */
  getEntityRenderState(entityId, tileSize) {
    const anim = this._anims.get(entityId);
    const bob  = Math.sin(this._frame * 0.08) * 1.5; // gentle idle bob

    if (!anim) {
      return { offsetX: 0, offsetY: bob, scaleY: 1, alpha: 1, flash: null };
    }

    const t = anim.elapsed / anim.duration;

    switch (anim.type) {
      case "attack": {
        // Lunge forward then snap back
        const lunge = t < 0.4
          ? t / 0.4
          : 1 - (t - 0.4) / 0.6;
        return {
          offsetX: anim.dirX * lunge * tileSize * 0.4,
          offsetY: anim.dirY * lunge * tileSize * 0.4,
          scaleY: 1, alpha: 1, flash: null
        };
      }
      case "hit": {
        // Flash white and knock back
        const knock = Math.sin(t * Math.PI) * tileSize * 0.3;
        return {
          offsetX: -knock, offsetY: 0,
          scaleY: 1, alpha: 1,
          flash: `rgba(255,255,255,${0.7 * (1 - t)})`
        };
      }
      case "dying": {
        // Fall sideways and fade
        return {
          offsetX: t * tileSize * 0.5,
          offsetY: t * tileSize * 0.3,
          scaleY: 1 - t * 0.5,
          alpha: 1 - t,
          flash: null
        };
      }
      case "healing": {
        // Pulse green glow
        const pulse = Math.sin(t * Math.PI * 3);
        return {
          offsetX: 0, offsetY: -pulse * 3,
          scaleY: 1, alpha: 1,
          flash: `rgba(50,220,80,${pulse * 0.4})`
        };
      }
      case "casting": {
        const pulse = Math.sin(t * Math.PI * 4);
        return {
          offsetX: 0, offsetY: 0,
          scaleY: 1, alpha: 1,
          flash: `rgba(180,100,255,${pulse * 0.5})`
        };
      }
      case "levelup": {
        const bounce = Math.abs(Math.sin(t * Math.PI * 4)) * tileSize * 0.3;
        return {
          offsetX: 0, offsetY: -bounce,
          scaleY: 1, alpha: 1,
          flash: `rgba(255,215,0,${0.6 * (1 - t)})`
        };
      }
      default:
        return { offsetX: 0, offsetY: bob, scaleY: 1, alpha: 1, flash: null };
    }
  }
}
