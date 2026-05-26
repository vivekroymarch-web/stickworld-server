console.log("GAME FILE LOADED")

// =================================================
// ANIMATION HELPERS
// =================================================

function lerp(a, b, t) {
  return a + (b - a) * t
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

// =================================================
// POSE DRAWING HELPERS
// =================================================

function drawHead(graphics, x, y, r = 16) {
  graphics.strokeCircle(x, y, r)
}

function drawLine(graphics, x1, y1, x2, y2) {
  graphics.lineBetween(x1, y1, x2, y2)
}

const SPRITE_FRAME_SIZE = 240
const SPRITE_FEET_Y = 218
const STICKMAN_SPRITE_SCALE = 0.78
const SPRITE_POSES = new Set(['walk', 'wave', 'laugh', 'cry'])

// =================================================
// IDLE POSE
// =================================================

function drawIdlePose(graphics, x, chestY, hipY, feetY, t) {
  const breath = Math.sin(t * 0.04) * 1.2

  drawLine(graphics, x, chestY + breath, x - 20, chestY + 14 + breath)
  drawLine(graphics, x - 20, chestY + 14 + breath, x - 14, chestY + 28 + breath)
  drawLine(graphics, x, chestY + breath, x + 20, chestY + 14 + breath)
  drawLine(graphics, x + 20, chestY + 14 + breath, x + 14, chestY + 28 + breath)

  drawStandingLegs(graphics, x, hipY + breath, feetY)
}

// =================================================
// STANDING LEGS
// =================================================

function drawStandingLegs(graphics, x, hipY, feetY) {
  drawLine(graphics, x, hipY, x - 9, feetY)
  drawLine(graphics, x, hipY, x + 9, feetY)
  drawLine(graphics, x - 9, feetY, x - 17, feetY)
  drawLine(graphics, x + 9, feetY, x + 17, feetY)
}

class MainScene extends Phaser.Scene {

  constructor() {
    super('main-scene')

    this.clientId =
      crypto.randomUUID?.() ??
      `tab-${Math.random().toString(36).slice(2, 9)}`

    this.remotePlayers = {}

    this.colorMap = {
      red: 0xff0000,
      orange: 0xff8800,
      green: 0x00cc44,
      purple: 0x9933cc,
    }

    this.playerColorName = 'red'
    this.playerColor = this.colorMap[this.playerColorName]

    this.name = `Guest ${Math.floor(Math.random() * 90) + 10}`
  }

  preload() {
    this.load.spritesheet(
      'stickman-walk-sheet',
      'assets/stickman/stickman_walk_sheet.png',
      { frameWidth: SPRITE_FRAME_SIZE, frameHeight: SPRITE_FRAME_SIZE }
    )

    this.load.spritesheet(
      'stickman-wave-sheet',
      'assets/stickman/stickman_wave_sheet.png',
      { frameWidth: SPRITE_FRAME_SIZE, frameHeight: SPRITE_FRAME_SIZE }
    )

    this.load.spritesheet(
      'stickman-laugh-sheet',
      'assets/stickman/stickman_laugh_sheet.png',
      { frameWidth: SPRITE_FRAME_SIZE, frameHeight: SPRITE_FRAME_SIZE }
    )

    this.load.spritesheet(
      'stickman-cry-sheet',
      'assets/stickman/stickman_cry_sheet.png',
      { frameWidth: SPRITE_FRAME_SIZE, frameHeight: SPRITE_FRAME_SIZE }
    )
  }

  create() {
    console.log("CREATE RUNNING")

    this.groundY = this.scale.height - 120

    // =================================================
    // BACKGROUND
    // =================================================

    this.add.rectangle(
      0, 0,
      this.scale.width * 4,
      this.scale.height,
      0xfafafa
    ).setOrigin(0)

    // =================================================
    // GROUND
    // =================================================

    this.add.rectangle(
      0,
      this.groundY,
      this.scale.width * 4,
      120,
      0xe8e8e8
    ).setOrigin(0)

    this.add.rectangle(
      0,
      this.groundY,
      this.scale.width * 4,
      2,
      0xcccccc
    ).setOrigin(0)

    // =================================================
    // PLAYER
    // =================================================

    this.player = {
      x: this.scale.width / 2,
      y: this.groundY,
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
    }

    // =================================================
    // GRAPHICS
    // =================================================

    this.playerGraphics = this.add.graphics()
    this.playerSprite = this.createCharacterSprite()
    this.createSpriteAnimations()

    // =================================================
    // INPUT
    // =================================================

    this.keys = this.input.keyboard.addKeys({
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      jump:  Phaser.Input.Keyboard.KeyCodes.W,
      wave:  Phaser.Input.Keyboard.KeyCodes.Q,
      laugh: Phaser.Input.Keyboard.KeyCodes.E,
      point: Phaser.Input.Keyboard.KeyCodes.R,
      cry:   Phaser.Input.Keyboard.KeyCodes.F,
      run:   Phaser.Input.Keyboard.KeyCodes.SHIFT,
    })

    this.nameInput   = document.getElementById('player-name')
    this.colorSelect = document.getElementById('player-color')

    if (this.nameInput) {
      this.nameInput.value = this.name
      this.nameInput.addEventListener('change', () => this.handlePlayerNameChange())
    }

    if (this.colorSelect) {
      this.colorSelect.value = this.playerColorName
      this.colorSelect.addEventListener('change', () => this.handlePlayerColorChange())
    }

    // =================================================
    // UI
    // =================================================

    this.nameText = this.add.text(
      this.player.x,
      this.player.y - 160,
      this.name,
      { fontFamily: 'Arial', fontSize: '18px', color: '#111111' }
    ).setOrigin(0.5)

    this.onlineText = this.add.text(
      20, 20,
      'Players Online: 1',
      { fontFamily: 'Arial', fontSize: '20px', color: '#111111' }
    )

    this.controlsText = this.add.text(
      20, 50,
      'A/D move · W jump · SHIFT+A/D run · Q wave · E laugh · F cry · R point',
      { fontFamily: 'Arial', fontSize: '13px', color: '#888888' }
    ).setScrollFactor(0)

    this.cameras.main.startFollow(
      { x: this.player.x, y: this.player.y },
      true, 0.08, 0.08
    )
    this.cameras.main.setBounds(0, 0, this.scale.width * 4, this.scale.height)

    // =================================================
    // NETWORK
    // =================================================

    this.connectNetwork()

    this.time.addEvent({
      delay: 40,
      loop: true,
      callback: this.broadcastPosition,
      callbackScope: this,
    })
  }

  // =================================================
  // DRAW CHARACTER — main dispatcher
  // =================================================

  createCharacterSprite() {
    return this.add.sprite(0, 0, 'stickman-walk-sheet')
      .setOrigin(0.5, SPRITE_FEET_Y / SPRITE_FRAME_SIZE)
      .setScale(STICKMAN_SPRITE_SCALE)
      .setVisible(false)
  }

  createSpriteAnimations() {
    const specs = [
      { key: 'stickman-walk',  sheet: 'stickman-walk-sheet',  frames: 12, frameRate: 14 },
      { key: 'stickman-wave',  sheet: 'stickman-wave-sheet',  frames: 12, frameRate: 10 },
      { key: 'stickman-laugh', sheet: 'stickman-laugh-sheet', frames: 10, frameRate: 12 },
      { key: 'stickman-cry',   sheet: 'stickman-cry-sheet',   frames: 12, frameRate: 9  },
    ]

    for (const spec of specs) {
      if (this.anims.exists(spec.key)) continue

      this.anims.create({
        key: spec.key,
        frames: this.anims.generateFrameNumbers(spec.sheet, {
          start: 0,
          end: spec.frames - 1,
        }),
        frameRate: spec.frameRate,
        repeat: -1,
      })
    }
  }

  renderCharacter(graphics, sprite, player, color, isLocal = false) {
    if (SPRITE_POSES.has(player.pose)) {
      this.drawSpriteCharacter(graphics, sprite, player, color)
      return
    }

    sprite.setVisible(false)
    this.drawCharacter(graphics, player, color, isLocal)
  }

  drawSpriteCharacter(graphics, sprite, player, color) {
    graphics.clear()

    const key = `stickman-${player.pose}`
    sprite
      .setVisible(true)
      .setPosition(player.x, player.y)
      .setTint(color)
      .setScale((player.facing || 1) * STICKMAN_SPRITE_SCALE, STICKMAN_SPRITE_SCALE)

    if (sprite.anims.currentAnim?.key !== key) {
      sprite.play(key)
    }

    sprite.anims.timeScale = player.pose === 'walk'
      ? Phaser.Math.Clamp(Math.abs(player.vx) / 1.8, 0.7, 1.3)
      : 1

    if (player.pose === 'cry') {
      this.drawSpriteCryTears(graphics, player)
    }
  }

  drawSpriteCryTears(graphics, player) {
    const phase = (this.time.now / 900) % 1
    const mirror = player.facing || 1
    const headX = player.x + mirror * 8 * STICKMAN_SPRITE_SCALE
    const headY = player.y - 127 * STICKMAN_SPRITE_SCALE

    graphics.fillStyle(0x4aa3ff, 0.88)

    for (let i = 0; i < 2; i++) {
      const fall = (phase + i * 0.5) % 1
      const tearX = headX + mirror * (i === 0 ? -7 : 7) * STICKMAN_SPRITE_SCALE
      const tearY = headY + (14 + fall * 52) * STICKMAN_SPRITE_SCALE
      const radius = Math.max(1, 3.5 - fall * 2.4)

      graphics.fillCircle(tearX, tearY, radius)
    }
  }

  drawCharacter(graphics, player, color, isLocal = false) {
    graphics.clear()
    graphics.lineStyle(5, color, 1)
    graphics.lineCap = 'round'

    const x     = player.x
    const feetY = player.y
    const t     = player.animTime

    // =================================================
    // WALK CYCLE SMOOTHING
    // =================================================

    const moveSpeed = Math.abs(player.vx)
    const isRunning = player.pose === 'run'

    const targetWalkSpeed = moveSpeed > 0.05
      ? (isRunning ? 0.14 + moveSpeed * 0.10 : 0.06 + moveSpeed * 0.07)
      : 0

    player.walkCycle = Phaser.Math.Linear(player.walkCycle, targetWalkSpeed, 0.12)
    player.animTime += player.walkCycle * 0.18

    // =================================================
    // SQUASH & STRETCH on landing
    // =================================================

    player.squashY = Phaser.Math.Linear(player.squashY, 1, 0.18)
    player.squashX = Phaser.Math.Linear(player.squashX, 1, 0.18)

    // =================================================
    // BODY POSITIONS (shared across most poses)
    // =================================================

    const torsoBob  = Math.abs(Math.sin(t)) * moveSpeed * 2.5
    const torsoLean = player.vx * (isRunning ? 3.2 : 1.8)

    const headX  = x + torsoLean
    const headY  = (feetY - 118 - torsoBob) * player.squashY + feetY * (1 - player.squashY)
    const neckY  = (feetY - 96  - torsoBob) * player.squashY + feetY * (1 - player.squashY)
    const chestY = (feetY - 72  - torsoBob) * player.squashY + feetY * (1 - player.squashY)
    const hipY   = (feetY - 38  - torsoBob) * player.squashY + feetY * (1 - player.squashY)

    // =================================================
    // DISPATCH TO POSE
    // =================================================

    switch (player.pose) {
      case 'idle':  this.drawIdle( graphics, player, x, headX, headY, neckY, chestY, hipY, feetY, t); break
      case 'walk':  this.drawWalk( graphics, player, x, headX, headY, neckY, chestY, hipY, feetY, t); break
      case 'run':   this.drawRun(  graphics, player, x, headX, headY, neckY, chestY, hipY, feetY, t); break
      case 'jump':  this.drawJump( graphics, player, x, headX, headY, neckY, chestY, hipY, feetY, t); break
      case 'wave':  this.drawWave( graphics, player, x, headX, headY, neckY, chestY, hipY, feetY, t); break
      case 'laugh': this.drawLaugh(graphics, player, x, headX, headY, neckY, chestY, hipY, feetY, t); break
      case 'cry':   this.drawCry(  graphics, player, x, headX, headY, neckY, chestY, hipY, feetY, t); break
      case 'point': this.drawPoint(graphics, player, x, headX, headY, neckY, chestY, hipY, feetY, t, isLocal); break
    }
  }

  // =================================================
  // IDLE
  // =================================================

  drawIdle(graphics, player, x, headX, headY, neckY, chestY, hipY, feetY, t) {
    const breath = Math.sin(t * 0.04) * 1.5

    drawHead(graphics, headX, headY)
    drawLine(graphics, headX, neckY, x, hipY - breath)

    drawLine(graphics, x, chestY, x - 22, chestY + 12 + breath)
    drawLine(graphics, x - 22, chestY + 12 + breath, x - 15, chestY + 28 + breath * 0.5)
    drawLine(graphics, x, chestY, x + 22, chestY + 12 + breath)
    drawLine(graphics, x + 22, chestY + 12 + breath, x + 15, chestY + 28 + breath * 0.5)

    drawStandingLegs(graphics, x, hipY, feetY)
  }

  // =================================================
  // WALK — 4-phase gait with full IK legs
  // =================================================

  drawWalk(graphics, player, x, headX, headY, neckY, chestY, hipY, feetY, t) {
    const phase = (t * 0.55) % 1
    const p4    = phase * 4
    const idx   = Math.floor(p4) % 4
    const blend = easeInOut(p4 - Math.floor(p4))

    const poses = [
      // CONTACT — heel strike
      { bodyY:  0, lFX: -20, lFY: 0, lKX: -9,  lKY: 30, rFX: 18, rFY: -6, rKX: 8,  rKY: 22, lAX: 12, rAX: -12 },
      // DOWN — weight loaded
      { bodyY:  4, lFX: -16, lFY: 0, lKX: -5,  lKY: 34, rFX: 10, rFY:-14, rKX: 5,  rKY: 18, lAX: 8,  rAX: -8  },
      // PASSING — mid swing
      { bodyY: -2, lFX:  -5, lFY: 0, lKX: -2,  lKY: 28, rFX: 6,  rFY:-24, rKX: 2,  rKY: 12, lAX:-10, rAX: 10  },
      // UP — toe off
      { bodyY: -6, lFX:  12, lFY:-18,lKX:  5,  lKY: 16, rFX:-12, rFY: 0,  rKX: -5, rKY: 30, lAX:-12, rAX: 12  },
    ]

    const cur  = poses[idx]
    const next = poses[(idx + 1) % 4]
    const L = (a, b) => lerp(a, b, blend)

    const bodyOffY = L(cur.bodyY, next.bodyY)

    drawHead(graphics, headX, headY)
    drawLine(graphics, headX, neckY + bodyOffY, x, hipY + bodyOffY)

    const lAX = L(cur.lAX, next.lAX)
    const rAX = L(cur.rAX, next.rAX)
    drawLine(graphics, x, chestY, x + lAX,        chestY + 18)
    drawLine(graphics, x + lAX,  chestY + 18,     x + lAX * 0.6, chestY + 32)
    drawLine(graphics, x, chestY, x + rAX,        chestY + 18)
    drawLine(graphics, x + rAX,  chestY + 18,     x + rAX * 0.6, chestY + 32)

    const hip = hipY + bodyOffY

    const lFX = x + L(cur.lFX, next.lFX)
    const lFY = feetY + L(cur.lFY, next.lFY)
    const lKX = x + L(cur.lKX, next.lKX)
    const lKY = hip + L(cur.lKY, next.lKY)
    drawLine(graphics, x, hip, lKX, lKY)
    drawLine(graphics, lKX, lKY, lFX, lFY)
    drawLine(graphics, lFX, lFY, lFX - 10 * (lFY < feetY ? 0.5 : 1), lFY)

    const rFX = x + L(cur.rFX, next.rFX)
    const rFY = feetY + L(cur.rFY, next.rFY)
    const rKX = x + L(cur.rKX, next.rKX)
    const rKY = hip + L(cur.rKY, next.rKY)
    drawLine(graphics, x, hip, rKX, rKY)
    drawLine(graphics, rKX, rKY, rFX, rFY)
    drawLine(graphics, rFX, rFY, rFX + 10 * (rFY < feetY ? 0.5 : 1), rFY)
  }

  // =================================================
  // RUN — aggressive lean, high knees, pumping arms
  // =================================================

  drawRun(graphics, player, x, headX, headY, neckY, chestY, hipY, feetY, t) {
    const phase = (t * 0.9) % 1
    const p2    = phase * 2
    const idx   = Math.floor(p2) % 2
    const blend = easeInOut(p2 - Math.floor(p2))

    const poses = [
      // DRIVE — push off back, drive knee forward
      { bodyY: -4, lFX: -28, lFY: 0, lKX: -18, lKY: 18, rFX: 20, rFY:-30, rKX: 16, rKY: 6,  lAX:-28, lAY:-20, rAX: 24, rAY: 14 },
      // RECOVERY — float phase, switch legs
      { bodyY: -2, lFX:  22, lFY:-28,lKX: 18,  lKY: 4,  rFX:-26, rFY: 0,  rKX:-16, rKY: 20, lAX: 26, lAY: 12, rAX:-26, rAY:-22 },
    ]

    const cur  = poses[idx]
    const next = poses[(idx + 1) % 2]
    const L = (a, b) => lerp(a, b, blend)

    const bodyOffY = L(cur.bodyY, next.bodyY)

    drawHead(graphics, headX, headY)
    drawLine(graphics, headX, neckY + bodyOffY, x, hipY + bodyOffY)

    const lAX = L(cur.lAX, next.lAX)
    const lAY = L(cur.lAY, next.lAY)
    const rAX = L(cur.rAX, next.rAX)
    const rAY = L(cur.rAY, next.rAY)
    drawLine(graphics, x, chestY, x + lAX * 0.6, chestY + lAY * 0.5)
    drawLine(graphics, x + lAX * 0.6, chestY + lAY * 0.5, x + lAX, chestY + lAY)
    drawLine(graphics, x, chestY, x + rAX * 0.6, chestY + rAY * 0.5)
    drawLine(graphics, x + rAX * 0.6, chestY + rAY * 0.5, x + rAX, chestY + rAY)

    const hip = hipY + bodyOffY

    const lFX = x + L(cur.lFX, next.lFX)
    const lFY = feetY + L(cur.lFY, next.lFY)
    const lKX = x + L(cur.lKX, next.lKX)
    const lKY = hip + L(cur.lKY, next.lKY)
    drawLine(graphics, x, hip, lKX, lKY)
    drawLine(graphics, lKX, lKY, lFX, lFY)
    if (lFY >= feetY - 2) drawLine(graphics, lFX, lFY, lFX - 12, lFY)

    const rFX = x + L(cur.rFX, next.rFX)
    const rFY = feetY + L(cur.rFY, next.rFY)
    const rKX = x + L(cur.rKX, next.rKX)
    const rKY = hip + L(cur.rKY, next.rKY)
    drawLine(graphics, x, hip, rKX, rKY)
    drawLine(graphics, rKX, rKY, rFX, rFY)
    if (rFY >= feetY - 2) drawLine(graphics, rFX, rFY, rFX + 12, rFY)
  }

  // =================================================
  // JUMP — rising / peak / falling states
  // =================================================

  drawJump(graphics, player, x, headX, headY, neckY, chestY, hipY, feetY, t) {
    const vy      = player.vy
    const rising  = vy < 0
    const peak    = Math.abs(vy) < 2
    const stretch = Phaser.Math.Clamp(Math.abs(vy) / 8, 0, 1)

    const hStretch = rising ? 1 + stretch * 0.25 : 1 - stretch * 0.12
    graphics.strokeEllipse(headX, headY, 32 / hStretch, 32 * hStretch)

    drawLine(graphics, headX, neckY, x, hipY)

    if (peak) {
      drawLine(graphics, x, chestY, x - 34, chestY - 22)
      drawLine(graphics, x - 34, chestY - 22, x - 28, chestY - 6)
      drawLine(graphics, x, chestY, x + 34, chestY - 22)
      drawLine(graphics, x + 34, chestY - 22, x + 28, chestY - 6)

      drawLine(graphics, x, hipY, x - 26, feetY - 30)
      drawLine(graphics, x - 26, feetY - 30, x - 18, feetY - 8)
      drawLine(graphics, x, hipY, x + 26, feetY - 30)
      drawLine(graphics, x + 26, feetY - 30, x + 18, feetY - 8)

    } else if (rising) {
      const s = stretch
      drawLine(graphics, x, chestY, x - 22, chestY - 20 * s)
      drawLine(graphics, x - 22, chestY - 20 * s, x - 10, chestY - 8 * s)
      drawLine(graphics, x, chestY, x + 22, chestY - 20 * s)
      drawLine(graphics, x + 22, chestY - 20 * s, x + 10, chestY - 8 * s)

      drawLine(graphics, x, hipY, x - 12, feetY - 20 * s)
      drawLine(graphics, x - 12, feetY - 20 * s, x - 4, feetY - 4 * s)
      drawLine(graphics, x, hipY, x + 12, feetY - 20 * s)
      drawLine(graphics, x + 12, feetY - 20 * s, x + 4, feetY - 4 * s)

    } else {
      const s = stretch
      drawLine(graphics, x, chestY, x - 26, chestY + 14 + 8 * s)
      drawLine(graphics, x - 26, chestY + 14 + 8 * s, x - 16, chestY + 30 + 10 * s)
      drawLine(graphics, x, chestY, x + 26, chestY + 14 + 8 * s)
      drawLine(graphics, x + 26, chestY + 14 + 8 * s, x + 16, chestY + 30 + 10 * s)

      drawLine(graphics, x, hipY, x - 14, feetY - 18 * s)
      drawLine(graphics, x - 14, feetY - 18 * s, x - 6, feetY)
      drawLine(graphics, x, hipY, x + 14, feetY - 18 * s)
      drawLine(graphics, x + 14, feetY - 18 * s, x + 6, feetY)

      drawLine(graphics, x - 6, feetY, x - 14, feetY)
      drawLine(graphics, x + 6, feetY, x + 14, feetY)
    }
  }

  // =================================================
  // WAVE — 3-segment arm with wrist snap
  // =================================================

  drawWave(graphics, player, x, headX, headY, neckY, chestY, hipY, feetY, t) {
    const wt   = t * 4.2
    const side = player.facing || 1

    const sway  = Math.sin(wt * 0.38) * 2.5
    const bob   = Math.abs(Math.sin(wt * 0.55)) * 2
    const hTilt = Math.sin(wt * 0.6) * 3

    drawHead(graphics, headX + hTilt, headY - bob)
    drawLine(graphics, headX + hTilt, neckY, x + sway, hipY)

    const shoulderX    = x + side * 8
    const shoulderY    = chestY - 2
    const elbowSwing   = Math.sin(wt) * 10
    const forearmSwing = Math.sin(wt * 1.8) * 14
    const wristSnap    = Math.cos(wt * 2.4) * 18

    const elbowX = shoulderX + side * (16 + elbowSwing)
    const elbowY = shoulderY - 16
    const wristX = elbowX + side * 10
    const wristY = elbowY - (20 + forearmSwing)
    const handX  = wristX + wristSnap * side
    const handY  = wristY - 10

    drawLine(graphics, shoulderX, shoulderY, elbowX, elbowY)
    drawLine(graphics, elbowX, elbowY, wristX, wristY)
    drawLine(graphics, wristX, wristY, handX, handY)

    drawLine(graphics, x, chestY, x - side * 20, chestY + 14)
    drawLine(graphics, x - side * 20, chestY + 14, x - side * 12, chestY + 28)

    const legBounce = Math.sin(wt * 1.9) * 2
    drawLine(graphics, x, hipY, x - 8, feetY + legBounce)
    drawLine(graphics, x, hipY, x + 8, feetY - legBounce)
    drawLine(graphics, x - 8, feetY + legBounce, x - 16, feetY + legBounce)
    drawLine(graphics, x + 8, feetY - legBounce, x + 16, feetY - legBounce)
  }

  // =================================================
  // LAUGH — doubled-over, hands on knees
  // =================================================

  drawLaugh(graphics, player, x, headX, headY, neckY, chestY, hipY, feetY, t) {
    const lt     = t * 9
    const shake  = Math.sin(lt) * 5
    const bounce = Math.abs(Math.sin(lt)) * 6
    const lean   = 14 + bounce * 0.6

    const hx = x + lean + Math.sin(lt * 0.7) * 3
    const hy = headY + bounce * 0.8
    drawHead(graphics, hx, hy)

    const chestFwd = x + lean * 0.7
    drawLine(graphics, hx, hy + 16, chestFwd, chestY + bounce * 0.4)

    const kneeL = x - 12
    const kneeR = x + 12
    const kneeY = feetY - 28

    drawLine(graphics, chestFwd, chestY + bounce * 0.4, kneeL - 4 + shake, kneeY - 8)
    drawLine(graphics, kneeL - 4 + shake, kneeY - 8, kneeL, kneeY + 6)
    drawLine(graphics, chestFwd, chestY + bounce * 0.4, kneeR + 4 - shake, kneeY - 8)
    drawLine(graphics, kneeR + 4 - shake, kneeY - 8, kneeR, kneeY + 6)

    drawLine(graphics, x, hipY + bounce * 0.3, kneeL, kneeY)
    drawLine(graphics, kneeL, kneeY, x - 14, feetY)
    drawLine(graphics, x - 14, feetY, x - 22, feetY)
    drawLine(graphics, x, hipY + bounce * 0.3, kneeR, kneeY)
    drawLine(graphics, kneeR, kneeY, x + 14, feetY)
    drawLine(graphics, x + 14, feetY, x + 22, feetY)
  }

  // =================================================
  // CRY — hunched, bowed head, falling tears
  // =================================================

  drawCry(graphics, player, x, headX, headY, neckY, chestY, hipY, feetY, t) {
    const ct    = t * 6
    const sob   = Math.sin(ct) * 3
    const hunch = 10

    const hx = x + hunch * 0.5
    const hy = headY + 8 + Math.abs(Math.sin(ct * 0.5)) * 3
    drawHead(graphics, hx, hy)

    const torsoFwd = x + hunch
    drawLine(graphics, hx, hy + 16, torsoFwd, chestY + 10)
    drawLine(graphics, torsoFwd, chestY + 10, x + sob * 0.5, hipY + 4)

    drawLine(graphics, torsoFwd, chestY + 12, torsoFwd - 16 + sob, chestY + 28)
    drawLine(graphics, torsoFwd - 16 + sob, chestY + 28, torsoFwd - 10 + sob * 0.5, chestY + 44)
    drawLine(graphics, torsoFwd, chestY + 12, torsoFwd + 16 - sob, chestY + 28)
    drawLine(graphics, torsoFwd + 16 - sob, chestY + 28, torsoFwd + 10 - sob * 0.5, chestY + 44)

    drawLine(graphics, x, hipY + 4, x - 6, feetY)
    drawLine(graphics, x, hipY + 4, x + 6, feetY)
    drawLine(graphics, x - 6, feetY, x - 14, feetY)
    drawLine(graphics, x + 6, feetY, x + 14, feetY)

    player.tearTimer = (player.tearTimer || 0) + 0.016
    const tearCycle = player.tearTimer % 1.2

    if (tearCycle < 0.9) {
      const ty = hy + tearCycle * 40
      const tr = 2.5 - tearCycle * 1.5
      if (tr > 0.5) { graphics.fillStyle(0x4499ff, 0.85); graphics.fillCircle(hx - 8, ty, tr) }
    }
    const tearCycle2 = (player.tearTimer + 0.6) % 1.2
    if (tearCycle2 < 0.9) {
      const ty2 = hy + tearCycle2 * 40
      const tr2 = 2.5 - tearCycle2 * 1.5
      if (tr2 > 0.5) { graphics.fillStyle(0x4499ff, 0.85); graphics.fillCircle(hx + 8, ty2, tr2) }
    }

    graphics.lineStyle(5, player.color || 0xff0000, 1)
  }

  // =================================================
  // POINT — IK arm following cursor
  // =================================================

  drawPoint(graphics, player, x, headX, headY, neckY, chestY, hipY, feetY, t, isLocal) {
    drawHead(graphics, headX, headY)
    drawLine(graphics, headX, neckY, x, hipY)

    const pointer = isLocal
      ? this.input.activePointer
      : { worldX: x + player.facing * 120, worldY: chestY }

    const shoulderX = x
    const shoulderY = chestY
    const targetX   = pointer.worldX
    const targetY   = pointer.worldY
    const upperArm  = 24
    const forearm   = 26

    const dx = targetX - shoulderX
    const dy = targetY - shoulderY
    let dist = Math.sqrt(dx * dx + dy * dy)
    dist = Phaser.Math.Clamp(dist, 8, upperArm + forearm - 0.001)

    const aimAngle = Math.atan2(dy, dx)
    player.pointAngle = Phaser.Math.Angle.RotateTo(player.pointAngle, aimAngle, 0.22)

    const a = upperArm, b = forearm, c = dist
    const elbowAngle = Math.acos(Phaser.Math.Clamp((a*a + c*c - b*b) / (2*a*c), -1, 1))

    const desiredSide = dx >= 0 ? 1 : -1
    player.elbowSide  = Phaser.Math.Linear(player.elbowSide, desiredSide, 0.18)
    if (Math.abs(player.elbowSide - desiredSide) < 0.05) player.elbowSide = desiredSide

    const shoulderAngle = player.pointAngle + elbowAngle * player.elbowSide
    const elbowX = shoulderX + Math.cos(shoulderAngle) * upperArm
    const elbowY = shoulderY + Math.sin(shoulderAngle) * upperArm
    const handX  = elbowX   + Math.cos(player.pointAngle) * forearm
    const handY  = elbowY   + Math.sin(player.pointAngle) * forearm

    drawLine(graphics, shoulderX, shoulderY, elbowX, elbowY)
    drawLine(graphics, elbowX, elbowY, handX, handY)

    drawLine(graphics, x, chestY, x - 20, chestY + 14)
    drawLine(graphics, x - 20, chestY + 14, x - 12, chestY + 28)

    drawStandingLegs(graphics, x, hipY, feetY)
  }

  // =================================================
  // UPDATE
  // =================================================

  update(_, delta) {
    const dt       = delta / 16.666
    const running  = this.keys.run.isDown
    const accel    = running ? 0.40 : 0.24
    const maxSpeed = running ? 4.2  : 2.0
    const friction = 0.82

    if (this.keys.left.isDown) {
      this.player.vx -= accel * dt
      this.player.facing = -1
    }

    if (this.keys.right.isDown) {
      this.player.vx += accel * dt
      this.player.facing = 1
    }

    this.player.vx = Phaser.Math.Clamp(this.player.vx, -maxSpeed, maxSpeed)
    this.player.vx *= friction

    this.player.x += this.player.vx * dt * 4
    this.player.x  = Phaser.Math.Clamp(this.player.x, 40, this.scale.width * 4 - 40)

    if (this.keys.jump.isDown && this.player.grounded) {
      this.player.vy = running ? -9 : -7
      this.player.grounded = false
    }

    this.player.vy += 0.32 * dt
    this.player.y  += this.player.vy * dt * 3

    if (this.player.y >= this.groundY) {
      if (!this.player.grounded && Math.abs(this.player.vy) > 3) {
        const impact = Phaser.Math.Clamp(Math.abs(this.player.vy) / 12, 0, 0.35)
        this.player.squashY = 1 - impact
        this.player.squashX = 1 + impact * 0.6
      }
      this.player.y        = this.groundY
      this.player.vy       = 0
      this.player.grounded = true
    }

    // =================================================
    // POSE SELECTION
    // =================================================

    if (this.keys.point.isDown) {
      this.player.pose = 'point'
    } else if (this.keys.wave.isDown) {
      this.player.pose = 'wave'
    } else if (this.keys.laugh.isDown) {
      this.player.pose = 'laugh'
    } else if (this.keys.cry.isDown) {
      this.player.pose = 'cry'
    } else if (!this.player.grounded) {
      this.player.pose = 'jump'
    } else if (running && Math.abs(this.player.vx) > 0.3) {
      this.player.pose = 'run'
    } else if (Math.abs(this.player.vx) > 0.15) {
      this.player.pose = 'walk'
    } else {
      this.player.pose = 'idle'
    }

    this.renderCharacter(this.playerGraphics, this.playerSprite, this.player, this.playerColor, true)

    this.nameText.setPosition(this.player.x, this.player.y - 165)

    this.cameras.main.startFollow(
      { x: this.player.x, y: this.player.y },
      true, 0.08, 0.08
    )

    for (const id in this.remotePlayers) {
      const remote = this.remotePlayers[id]
      this.renderCharacter(remote.graphics, remote.sprite, remote, remote.color, false)
      remote.label.setPosition(remote.x, remote.y - 165)
    }
  }

  // =================================================
  // NETWORK
  // =================================================

  connectNetwork() {
    const url = 'wss://stickworld-server.onrender.com'
    this.socket = new WebSocket(url)

    this.socket.addEventListener('open', () => { this.sendPacket('join') })
    this.socket.addEventListener('message', (event) => { this.handleMessage(event.data) })
  }

  broadcastPosition() {
    this.sendPacket('position', {
      x:          this.player.x,
      y:          this.player.y,
      vx:         this.player.vx,
      vy:         this.player.vy,
      pose:       this.player.pose,
      grounded:   this.player.grounded,
      facing:     this.player.facing,
      animTime:   this.player.animTime,
      pointAngle: this.player.pointAngle,
      name:       this.name,
      color:      this.playerColor,
    })
  }

  sendPacket(type, extra = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return
    this.socket.send(JSON.stringify({ type, id: this.clientId, name: this.name, ...extra }))
  }

  handleMessage(message) {
    let data
    try { data = JSON.parse(message) } catch { return }
    if (!data || data.id === this.clientId) return

    switch (data.type) {
      case 'join':     this.createRemotePlayer(data); break
      case 'position': this.updateRemotePlayer(data); break
    }

    this.onlineText.setText(`Players Online: ${Object.keys(this.remotePlayers).length + 1}`)
  }

  handlePlayerNameChange() {
    if (!this.nameInput) return
    const nextName = this.nameInput.value.trim()
    if (nextName.length > 0) {
      this.name = nextName
      this.nameText.setText(this.name)
    }
  }

  handlePlayerColorChange() {
    if (!this.colorSelect) return
    const nextColor = this.colorSelect.value
    if (this.colorMap[nextColor]) {
      this.playerColorName = nextColor
      this.playerColor     = this.colorMap[nextColor]
    }
  }

  createRemotePlayer(data) {
    if (this.remotePlayers[data.id]) return

    const graphics = this.add.graphics()
    const sprite   = this.createCharacterSprite()
    const label    = this.add.text(
      data.x, data.y - 165, data.name,
      { fontFamily: 'Arial', fontSize: '18px', color: '#111111' }
    ).setOrigin(0.5)

    this.remotePlayers[data.id] = {
      graphics,
      sprite,
      label,
      x:          data.x ?? this.scale.width / 2,
      y:          data.y ?? this.groundY,
      vx: 0, vy: 0,
      facing:     1,
      grounded:   data.grounded ?? true,
      pose:       data.pose || 'idle',
      animTime:   data.animTime || 0,
      walkCycle:  0,
      pointAngle: data.pointAngle || 0,
      elbowSide:  data.elbowSide || 1,
      color:      data.color || 0x0066ff,
      name:       data.name,
      squashY: 1, squashX: 1,
      tearTimer: 0,
    }
  }

  updateRemotePlayer(data) {
    if (!this.remotePlayers[data.id]) this.createRemotePlayer(data)
    const remote = this.remotePlayers[data.id]

    remote.x  = Phaser.Math.Linear(remote.x, data.x, 0.35)
    const targetY = data.grounded ? this.groundY : data.y
    remote.y  = Phaser.Math.Linear(remote.y, targetY, 0.35)
    remote.vx = Phaser.Math.Linear(remote.vx, data.vx, 0.25)
    remote.vy = Phaser.Math.Linear(remote.vy, data.vy, 0.25)

    remote.pose       = data.pose
    remote.grounded   = data.grounded
    remote.facing     = data.facing
    remote.animTime   = data.animTime
    remote.pointAngle = data.pointAngle || 0
    remote.elbowSide  = data.elbowSide  || 1
    remote.name       = data.name  || remote.name
    remote.color      = data.color || remote.color || 0x0066ff

    remote.label.setText(remote.name)
    this.renderCharacter(remote.graphics, remote.sprite, remote, remote.color, false)
    remote.label.setPosition(remote.x, remote.y - 165)
  }
}

console.log("CREATING GAME")

export const gameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'app',
  backgroundColor: '#fafafa',
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: MainScene,
}

new Phaser.Game(gameConfig)
