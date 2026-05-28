// =================================================
// NPCs (Non-Player Characters)
// Extends the Entity concept but uses procedural
// character rendering and AI state machines.
// =================================================

import { SIGN_MESSAGES } from './entities.js'

class BaseNPC {
  constructor(scene, data) {
    this.scene = scene
    this.id = data.id
    this.type = data.type
    this.x = data.x
    this.y = data.y
    this.groundY = scene.groundY
    this.config = data.config || {}

    // Character state (mirrors player state for renderCharacter)
    this.state = {
      x: this.x,
      y: this.y,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: true,
      pose: 'idle',
      animTime: 0,
      walkCycle: 0,
      pointAngle: 0,
      elbowSide: 1,
      squashY: 1,
      squashX: 1,
      tearTimer: 0,
      iceTimer: 0
    }

    this.color = this.config.color || 0xdddddd
    this.hat = this.config.hat || 'none'
    this.glasses = this.config.glasses || false
    this.name = this.config.name || 'NPC'

    this.graphics = scene.add.graphics().setDepth(10)
    this.sprite = scene.createCharacterSprite().setDepth(10)
    this.shadow = scene.add.ellipse(this.x, this.y, 40, 10, 0x000000, 0.5).setDepth(2)

    this.label = scene.add.text(this.x, this.y - 165, this.name, {
      fontFamily: 'Arial', fontSize: '14px', color: '#aaaaaa'
    }).setOrigin(0.5).setDepth(11)

    // Dialogue Bubble
    this.bubbleVisible = false
    this.bubble = scene.add.container(this.x, this.y - 120).setDepth(15).setVisible(false)
    this.bubbleBg = scene.add.rectangle(0, 0, 160, 44, 0xffffff, 0.9).setStrokeStyle(2, 0xaaaaaa).setOrigin(0.5)
    this.bubbleText = scene.add.text(0, 0, '', {
      fontFamily: 'Arial', fontSize: '12px', color: '#111111',
      wordWrap: { width: 148 }, align: 'center'
    }).setOrigin(0.5)
    this.bubble.add([this.bubbleBg, this.bubbleText])

    this.aiState = 'idle'
    this.stateTimer = 0
  }

  say(text) {
    this.bubbleText.setText(text)
    this.bubbleVisible = true
    this.bubble.setVisible(true)
    this.bubbleTimer = 3000 // hide after 3s
  }

  update(player, delta, onEntityEvent) {
    const dt = delta / 16.666
    
    // AI Logic (override in subclasses)
    this.think(player, delta)

    // Physics
    this.state.vy += 0.4 * dt
    this.state.y += this.state.vy * dt
    if (this.state.y >= this.groundY) {
      this.state.y = this.groundY
      this.state.vy = 0
      this.state.grounded = true
    } else {
      this.state.grounded = false
    }

    this.state.x += this.state.vx * dt
    
    // Animation timing
    if (Math.abs(this.state.vx) > 0.1) {
      this.state.pose = 'walk'
      this.state.walkCycle += (Math.abs(this.state.vx) * 0.05) * dt
      this.state.animTime = 0
    } else {
      this.state.pose = 'idle'
      this.state.animTime += delta * 0.001
      this.state.walkCycle = 0
    }

    // Sync physical position
    this.x = this.state.x
    this.y = this.state.y

    // Render
    this.scene.renderCharacter(this.graphics, this.sprite, this.state, this.color, false)
    
    // UI positions
    this.label.setPosition(this.x, this.y - 165)
    this.shadow.setPosition(this.x, this.groundY)
    const shadowScale = Phaser.Math.Clamp(1 - (this.groundY - this.y) / 200, 0.2, 1)
    this.shadow.setScale(shadowScale).setAlpha(shadowScale * 0.5)

    this.bubble.setPosition(this.x, this.y - 120)
    if (this.bubbleVisible) {
      this.bubbleTimer -= delta
      if (this.bubbleTimer <= 0) {
        this.bubbleVisible = false
        this.bubble.setVisible(false)
      }
    }
  }

  think(player, delta) {
    // Base class does nothing
  }

  overlaps(player, radius = 60) {
    const dx = player.x - this.x
    const dy = player.y - this.y
    return Math.sqrt(dx*dx + dy*dy) < radius
  }

  destroy() {
    this.graphics.destroy()
    this.sprite.destroy()
    this.shadow.destroy()
    this.label.destroy()
    this.bubble.destroy()
  }
}

// --------------------------------------------------
// GUIDE NPC - Stands still, waves and talks when near
// --------------------------------------------------
export class GuideNPC extends BaseNPC {
  constructor(scene, data) {
    data.config = data.config || {}
    data.config.name = "The Guide"
    data.config.color = 0x22aa55
    data.config.hat = "wizard"
    super(scene, data)
    this.hasSpoken = false
  }

  think(player, delta) {
    const dist = Math.abs(player.x - this.x)
    
    // Face player
    this.state.facing = player.x > this.x ? 1 : -1

    if (dist < 150) {
      if (!this.hasSpoken) {
        this.say("Welcome! Use the entities to explore.")
        this.state.pose = 'jump' // little wave jump
        this.state.vy = -5
        this.hasSpoken = true
      }
    } else {
      this.hasSpoken = false
    }
  }
}

// --------------------------------------------------
// WANDERER NPC - Patrols, runs away if startled
// --------------------------------------------------
export class WandererNPC extends BaseNPC {
  constructor(scene, data) {
    data.config = data.config || {}
    data.config.name = "Wanderer"
    data.config.color = 0xcc5522
    data.config.hat = "cap"
    super(scene, data)
    this.startX = this.x
  }

  think(player, delta) {
    this.stateTimer -= delta
    
    const dist = Math.abs(player.x - this.x)
    const playerSprinting = Math.abs(player.vx) > 0.8
    
    // Flee!
    if (dist < 200 && playerSprinting) {
      this.aiState = 'flee'
      this.stateTimer = 1000
      this.state.facing = player.x > this.x ? -1 : 1
      this.state.vx = this.state.facing * 1.5
      if (!this.bubbleVisible) this.say("Ahhh!")
      return
    }

    if (this.stateTimer <= 0) {
      // Pick new state
      if (this.aiState === 'flee') {
        this.aiState = 'idle'
        this.stateTimer = 2000
        this.state.vx = 0
      } else if (this.aiState === 'idle') {
        this.aiState = 'wander'
        this.stateTimer = 2000 + Math.random() * 2000
        this.state.facing = Math.random() > 0.5 ? 1 : -1
      } else if (this.aiState === 'wander') {
        this.aiState = 'idle'
        this.stateTimer = 1000 + Math.random() * 2000
      }
    }

    // Execute state
    if (this.aiState === 'idle') {
      this.state.vx *= 0.8 // friction
    } else if (this.aiState === 'wander') {
      this.state.vx = this.state.facing * 0.5
      // Don't wander too far from spawn
      if (Math.abs(this.x - this.startX) > 400) {
        this.state.facing = this.startX > this.x ? 1 : -1
      }
    }
  }
}
