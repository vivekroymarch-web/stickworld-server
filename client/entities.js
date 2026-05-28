// =================================================
// ENTITIES — Interactive world objects
// Portal, Crate, Sign, Spike, Spring, Ice, Fire, Hole, Arrow
// =================================================

const SIGN_MESSAGES = [
  'Welcome to Stickworld!',
  'Beware of the spikes ahead!',
  'Jump on the spring!',
  'Watch your step...',
  'Mind the gap!',
  'This place is dangerous.',
  'Hello traveller!',
  'Turn back now!',
  'The portal leads somewhere...',
  'Push the crate!'
]

export class EntityManager {
  constructor(scene) {
    this.scene = scene
    this.entities = new Map()
    this.arrows = []     // active flying arrows
  }

  // --------------------------------------------------
  // Create entity from data object
  // --------------------------------------------------
  create(data) {
    if (this.entities.has(data.id)) {
      this.destroy(data.id)
    }

    let entity
    switch (data.type) {
      case 'portal':  entity = new Portal(this.scene, data); break
      case 'crate':   entity = new Crate(this.scene, data);  break
      case 'sign':    entity = new Sign(this.scene, data);   break
      case 'spike':   entity = new SpikeTrap(this.scene, data); break
      case 'spring':  entity = new SpringTrap(this.scene, data); break
      case 'ice':     entity = new IceTrap(this.scene, data); break
      case 'fire':    entity = new FireTrap(this.scene, data); break
      case 'hole':    entity = new HoleTrap(this.scene, data); break
      case 'arrow':   entity = new ArrowTrap(this.scene, data); break
      default: return null
    }

    this.entities.set(data.id, entity)
    return entity
  }

  destroy(id) {
    const e = this.entities.get(id)
    if (e) { e.destroy(); this.entities.delete(id) }
  }

  destroyAll() {
    for (const e of this.entities.values()) e.destroy()
    this.entities.clear()
  }

  // --------------------------------------------------
  // Update all entities — called from scene update()
  // --------------------------------------------------
  update(player, delta, onEntityEvent) {
    for (const entity of this.entities.values()) {
      entity.update(player, delta, onEntityEvent)
    }

    // Update flying arrows
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i]
      a.x += a.vx * (delta / 16)
      a.sprite.setPosition(a.x, a.y)
      if (a.x < -200 || a.x > 10000) {
        a.sprite.destroy()
        this.arrows.splice(i, 1)
      }
    }
  }

  fireArrow(x, y, direction) {
    const scene = this.scene
    const sprite = scene.add.rectangle(x, y, 24, 6, 0x8B4513).setDepth(20)
    this.arrows.push({ x, y, vx: direction * 12, sprite })
  }

  // Move a crate (from server entity_push)
  moveCrate(entityId, x, y) {
    const e = this.entities.get(entityId)
    if (e && e.type === 'crate') {
      e.x = x; e.y = y
      e.container.setPosition(x, y)
    }
  }

  // Get all entity data for broadcasting
  getAllData() {
    const result = []
    for (const [id, e] of this.entities.entries()) {
      result.push({ id, type: e.type, x: e.x, y: e.y, config: e.config })
    }
    return result
  }
}

// --------------------------------------------------
// Base Entity
// --------------------------------------------------
class Entity {
  constructor(scene, data) {
    this.scene    = scene
    this.id       = data.id
    this.type     = data.type
    this.x        = data.x
    this.y        = data.y
    this.config   = data.config || {}
    this.cooldown = 0
  }
  update() {}
  destroy() {}

  overlaps(player, radius = 40) {
    const dx = player.x - this.x
    const dy = player.y - this.y
    return Math.sqrt(dx*dx + dy*dy) < radius
  }
}

// --------------------------------------------------
// PORTAL — Teleport player to target X,Y
// --------------------------------------------------
class Portal extends Entity {
  constructor(scene, data) {
    super(scene, data)
    this.angle = 0

    // Glowing outer ring
    this.ring = scene.add.circle(data.x, data.y, 36, 0x4466ff, 0.25).setDepth(5)
    this.inner = scene.add.circle(data.x, data.y, 24, 0x88aaff, 0.6).setDepth(6)
    this.particles = []
    for (let i = 0; i < 8; i++) {
      const p = scene.add.circle(data.x, data.y, 4, 0xaaccff, 0.8).setDepth(7)
      this.particles.push({ sprite: p, offset: (i / 8) * Math.PI * 2 })
    }

    // Label
    this.label = scene.add.text(data.x, data.y - 50, '[ PORTAL ]', {
      fontFamily: 'Arial', fontSize: '11px', color: '#88aaff'
    }).setOrigin(0.5).setDepth(8)
  }

  update(player, delta, onEntityEvent) {
    this.angle += delta * 0.003
    const r = 28
    for (const p of this.particles) {
      const a = p.offset + this.angle
      p.sprite.setPosition(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r)
      p.sprite.setAlpha(0.5 + 0.5 * Math.sin(a * 3))
    }

    // Pulse inner
    const scale = 1 + 0.08 * Math.sin(this.angle * 2)
    this.inner.setScale(scale)

    if (this.cooldown > 0) { this.cooldown -= delta; return }

    if (this.overlaps(player, 36)) {
      this.cooldown = 1500
      const dest = this.config.destX ?? (this.x + 400)
      const destY = this.config.destY ?? player.y
      onEntityEvent({ type: 'teleport', x: dest, y: destY })
    }
  }

  setPosition(x, y) {
    this.x = x; this.y = y
    this.ring.setPosition(x, y)
    this.inner.setPosition(x, y)
    this.label.setPosition(x, y - 50)
  }

  destroy() {
    this.ring.destroy(); this.inner.destroy(); this.label.destroy()
    for (const p of this.particles) p.sprite.destroy()
  }
}

// --------------------------------------------------
// CRATE — Pushable box, synced to all
// --------------------------------------------------
class Crate extends Entity {
  constructor(scene, data) {
    super(scene, data)
    this.w = 48; this.h = 48
    this.vx = 0

    this.container = scene.add.container(data.x, data.y).setDepth(9)
    const body  = scene.add.rectangle(0, 0, this.w, this.h, 0x8B6914).setStrokeStyle(2, 0x5c4a0f)
    const plank1 = scene.add.line(0, 0, -24, 0, 24, 0, 0x5c4a0f, 0.5)
    const plank2 = scene.add.line(0, 0, 0, -24, 0, 24, 0x5c4a0f, 0.5)
    const corner = scene.add.rectangle(0, 0, 8, 8, 0x4a3a0a).setStrokeStyle(1, 0x333)
    this.container.add([body, plank1, plank2, corner])
  }

  update(player, delta, onEntityEvent) {
    const groundY = this.scene.groundY

    // Gravity
    this.vy = (this.vy || 0) + 0.4 * (delta / 16)
    this.y += this.vy * (delta / 16)
    if (this.y >= groundY) { this.y = groundY; this.vy = 0 }

    // Slide friction
    this.vx *= 0.85
    this.x += this.vx * (delta / 16)
    this.container.setPosition(this.x, this.y)

    // Player pushes crate
    const dx = player.x - this.x
    const dy = player.y - this.y - this.h / 2
    if (Math.abs(dx) < this.w / 2 + 20 && Math.abs(dy) < this.h / 2 + 40) {
      const pushDir = dx < 0 ? 1 : -1
      this.vx += pushDir * 3
      onEntityEvent({ type: 'crate_push', entityId: this.id, x: this.x, y: this.y })
    }
  }

  destroy() { this.container.destroy() }
}

// --------------------------------------------------
// SIGN — Shows speech bubble when nearby
// --------------------------------------------------
class Sign extends Entity {
  constructor(scene, data) {
    super(scene, data)
    this.message = data.config?.message || SIGN_MESSAGES[0]
    this.bubbleVisible = false

    // Sign post (drawn as graphics)
    this.gfx = scene.add.graphics().setDepth(8)
    this.drawSign()

    // Bubble (hidden by default)
    this.bubble = scene.add.container(data.x, data.y - 80).setDepth(15).setVisible(false)
    const bg = scene.add.rectangle(0, 0, 160, 44, 0xfffef5, 1).setStrokeStyle(2, 0x888).setOrigin(0.5)
    const txt = scene.add.text(0, 0, this.message, {
      fontFamily: 'Arial', fontSize: '11px', color: '#333333',
      wordWrap: { width: 148 }, align: 'center'
    }).setOrigin(0.5)
    this.bubble.add([bg, txt])
  }

  drawSign() {
    this.gfx.clear()
    // Post
    this.gfx.fillStyle(0x6b4c2a)
    this.gfx.fillRect(this.x - 4, this.y - 60, 8, 60)
    // Board
    this.gfx.fillStyle(0x9c6f3a)
    this.gfx.fillRoundedRect(this.x - 30, this.y - 60, 60, 30, 4)
    this.gfx.lineStyle(2, 0x5c3d1a)
    this.gfx.strokeRoundedRect(this.x - 30, this.y - 60, 60, 30, 4)
  }

  update(player, delta, onEntityEvent) {
    const near = this.overlaps(player, 80)
    if (near !== this.bubbleVisible) {
      this.bubbleVisible = near
      this.bubble.setVisible(near)
    }
  }

  destroy() { this.gfx.destroy(); this.bubble.destroy() }
}

// --------------------------------------------------
// SPIKE TRAP — Knockback
// --------------------------------------------------
class SpikeTrap extends Entity {
  constructor(scene, data) {
    super(scene, data)
    this.gfx = scene.add.graphics().setDepth(8)
    this.drawSpikes()
  }

  drawSpikes() {
    this.gfx.clear()
    this.gfx.fillStyle(0x888888)
    // Draw 5 spikes
    for (let i = 0; i < 5; i++) {
      const sx = this.x - 32 + i * 16
      this.gfx.fillTriangle(sx, this.y, sx + 8, this.y, sx + 4, this.y - 24)
    }
    // Base plate
    this.gfx.fillStyle(0x555555)
    this.gfx.fillRect(this.x - 36, this.y, 72, 6)
  }

  update(player, delta, onEntityEvent) {
    if (this.cooldown > 0) { this.cooldown -= delta; return }
    if (this.overlaps(player, 45)) {
      this.cooldown = 1200
      onEntityEvent({ type: 'trap_spike', direction: player.x > this.x ? 1 : -1 })
    }
  }

  destroy() { this.gfx.destroy() }
}

// --------------------------------------------------
// SPRING TRAP — Launch player upward
// --------------------------------------------------
class SpringTrap extends Entity {
  constructor(scene, data) {
    super(scene, data)
    this.compressed = 0
    this.gfx = scene.add.graphics().setDepth(8)
    this.drawSpring(1)
  }

  drawSpring(scale) {
    this.gfx.clear()
    const h = 32 * scale
    // Coil lines
    this.gfx.lineStyle(4, 0xddaa00)
    const coils = 4
    for (let i = 0; i < coils; i++) {
      const y1 = this.y - (i / coils) * h
      const y2 = this.y - ((i + 1) / coils) * h
      const side = i % 2 === 0 ? 1 : -1
      this.gfx.lineBetween(this.x + side * 12, y1, this.x - side * 12, y2)
    }
    // Base plate
    this.gfx.fillStyle(0x888888)
    this.gfx.fillRect(this.x - 20, this.y, 40, 6)
    // Top plate
    this.gfx.fillStyle(0xddaa00)
    this.gfx.fillRect(this.x - 18, this.y - h - 4, 36, 6)
  }

  update(player, delta, onEntityEvent) {
    if (this.cooldown > 0) {
      this.cooldown -= delta
      this.drawSpring(0.4 + 0.6 * (1 - this.cooldown / 300))
      return
    }
    this.drawSpring(1)

    if (this.overlaps(player, 36)) {
      this.cooldown = 300
      onEntityEvent({ type: 'trap_spring' })
    }
  }

  destroy() { this.gfx.destroy() }
}

// --------------------------------------------------
// ICE TRAP — Uncontrollable slide
// --------------------------------------------------
class IceTrap extends Entity {
  constructor(scene, data) {
    super(scene, data)
    this.width = data.config?.width || 120
    this.gfx = scene.add.graphics().setDepth(8)
    this.drawIce()
  }

  drawIce() {
    this.gfx.clear()
    // Ice surface
    this.gfx.fillStyle(0xaaddff, 0.6)
    this.gfx.fillRect(this.x - this.width/2, this.y - 6, this.width, 6)
    this.gfx.lineStyle(2, 0x88bbee)
    this.gfx.strokeRect(this.x - this.width/2, this.y - 6, this.width, 6)
    // Sheen lines
    for (let i = 0; i < 4; i++) {
      const lx = this.x - this.width/2 + 10 + i * 28
      this.gfx.lineStyle(1, 0xffffff, 0.5)
      this.gfx.lineBetween(lx, this.y - 6, lx + 12, this.y)
    }
  }

  update(player, delta, onEntityEvent) {
    const dx = Math.abs(player.x - this.x)
    const dy = Math.abs(player.y - this.y)
    if (dx < this.width/2 + 20 && dy < 20 && player.grounded) {
      onEntityEvent({ type: 'trap_ice' })
    }
  }

  destroy() { this.gfx.destroy() }
}

// --------------------------------------------------
// FIRE TRAP — Screen flash + shake
// --------------------------------------------------
class FireTrap extends Entity {
  constructor(scene, data) {
    super(scene, data)
    this.flickerT = 0
    this.gfx = scene.add.graphics().setDepth(8)
    this.drawFire(1)
  }

  drawFire(flicker) {
    this.gfx.clear()
    // Fire base
    this.gfx.fillStyle(0xff4400, 0.9 * flicker)
    this.gfx.fillTriangle(this.x - 18, this.y, this.x + 18, this.y, this.x, this.y - 32 * flicker)
    this.gfx.fillStyle(0xff8800, 0.85 * flicker)
    this.gfx.fillTriangle(this.x - 12, this.y, this.x + 12, this.y, this.x + 4, this.y - 22 * flicker)
    this.gfx.fillStyle(0xffdd00, 0.8 * flicker)
    this.gfx.fillTriangle(this.x - 7, this.y, this.x + 7, this.y, this.x, this.y - 14 * flicker)
    // Base
    this.gfx.fillStyle(0x444444)
    this.gfx.fillRect(this.x - 20, this.y, 40, 5)
  }

  update(player, delta, onEntityEvent) {
    this.flickerT += delta * 0.012
    const flicker = 0.85 + 0.15 * Math.sin(this.flickerT)
    this.drawFire(flicker)

    if (this.cooldown > 0) { this.cooldown -= delta; return }
    if (this.overlaps(player, 38)) {
      this.cooldown = 1500
      onEntityEvent({ type: 'trap_fire' })
    }
  }

  destroy() { this.gfx.destroy() }
}

// --------------------------------------------------
// HOLE TRAP — Fall through + respawn nearby
// --------------------------------------------------
class HoleTrap extends Entity {
  constructor(scene, data) {
    super(scene, data)
    this.width = data.config?.width || 60
    this.gfx = scene.add.graphics().setDepth(8)
    this.drawHole()
  }

  drawHole() {
    this.gfx.clear()
    // Dark hole
    this.gfx.fillStyle(0x111111, 0.95)
    this.gfx.fillEllipse(this.x, this.y, this.width, 14)
    // Rim shadow
    this.gfx.lineStyle(3, 0x333333)
    this.gfx.strokeEllipse(this.x, this.y, this.width, 14)
    // Inner glow
    this.gfx.fillStyle(0x222244, 0.5)
    this.gfx.fillEllipse(this.x, this.y, this.width * 0.6, 8)
  }

  update(player, delta, onEntityEvent) {
    if (this.cooldown > 0) { this.cooldown -= delta; return }
    const dx = Math.abs(player.x - this.x)
    const dy = Math.abs(player.y - this.y)
    if (dx < this.width / 2 && dy < 20 && player.grounded) {
      this.cooldown = 2000
      onEntityEvent({ type: 'trap_hole', respawnX: this.x + 100 })
    }
  }

  destroy() { this.gfx.destroy() }
}

// --------------------------------------------------
// ARROW TRAP — Trigger fires arrow across screen
// --------------------------------------------------
class ArrowTrap extends Entity {
  constructor(scene, data) {
    super(scene, data)
    this.direction = data.config?.direction ?? 1
    this.triggerX  = data.config?.triggerX ?? (data.x + this.direction * 40)
    this.armed     = true

    this.gfx = scene.add.graphics().setDepth(8)
    this.drawLauncher()

    // Trigger indicator
    this.triggerGfx = scene.add.graphics().setDepth(7)
    this.triggerGfx.lineStyle(1, 0xff4444, 0.4)
    this.triggerGfx.lineBetween(this.triggerX, data.y - 40, this.triggerX, data.y)
  }

  drawLauncher() {
    this.gfx.clear()
    // Launcher body
    this.gfx.fillStyle(0x6b4c2a)
    this.gfx.fillRect(
      this.direction > 0 ? this.x - 20 : this.x,
      this.y - 24,
      20, 16
    )
    // Arrow tip pointing in direction
    this.gfx.fillStyle(0x888888)
    const tipX = this.direction > 0 ? this.x : this.x - 20
    this.gfx.fillTriangle(tipX, this.y - 20, tipX, this.y - 12, tipX + this.direction * 12, this.y - 16)
  }

  update(player, delta, onEntityEvent) {
    if (this.cooldown > 0) { this.cooldown -= delta; return }

    // Check if player crosses trigger line
    const crossed = this.direction > 0
      ? (player.x > this.triggerX - 10 && player.x < this.triggerX + 20)
      : (player.x < this.triggerX + 10 && player.x > this.triggerX - 20)

    if (crossed && player.grounded) {
      this.cooldown = 3000
      onEntityEvent({ type: 'arrow_fire', x: this.x, y: this.y - 16, direction: this.direction })
    }
  }

  destroy() { this.gfx.destroy(); this.triggerGfx.destroy() }
}

export { SIGN_MESSAGES }
