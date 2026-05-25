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

const SPRITE_FRAME_SIZE = 256
const SPRITE_FEET_Y = 228
const STICKMAN_SPRITE_SCALE = 0.55
const WORLD_WIDTH = 5000
const SPRITE_POSES = new Set([
  'idle',
  'walk',
  'jump',
  'laugh',
  'heavy_laugh',
  'cry',
  'angry',
  'moderately_angry',
])

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

    this.playerColor = 0xffffff

    this.name = `Guest ${Math.floor(Math.random() * 90) + 10}`
  }

  preload() {
    this.load.image('ufo', 'assets/ufo.png')

    this.load.spritesheet(
      'stickman-idle-sheet',
      'assets/stickman/stickman_idle_sheet.png',
      { frameWidth: SPRITE_FRAME_SIZE, frameHeight: SPRITE_FRAME_SIZE }
    )

    this.load.spritesheet(
      'stickman-jump-sheet',
      'assets/stickman/stickman_jump_sheet.png',
      { frameWidth: SPRITE_FRAME_SIZE, frameHeight: SPRITE_FRAME_SIZE }
    )

    this.load.spritesheet(
      'stickman-heavy-laugh-sheet',
      'assets/stickman/stickman_heavy_laugh_sheet.png',
      { frameWidth: SPRITE_FRAME_SIZE, frameHeight: SPRITE_FRAME_SIZE }
    )

    this.load.spritesheet(
      'stickman-angry-sheet',
      'assets/stickman/stickman_angry_sheet.png',
      { frameWidth: SPRITE_FRAME_SIZE, frameHeight: SPRITE_FRAME_SIZE }
    )

    this.load.spritesheet(
      'stickman-moderately-angry-sheet',
      'assets/stickman/stickman_moderately_angry_sheet.png',
      { frameWidth: SPRITE_FRAME_SIZE, frameHeight: SPRITE_FRAME_SIZE }
    )

    this.load.spritesheet(
      'stickman-walk-sheet',
      'assets/stickman/stickman_walk_sheet.png',
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
    this.groundY = this.scale.height - 91
    this.game.canvas.style.imageRendering = 'pixelated'

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, this.scale.height)
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, this.scale.height)

    // =================================================
    // BACKGROUND
    // =================================================
    // Handled by CSS div injected at bottom of file before Phaser starts

    // =================================================
    // GROUND
    // =================================================

    this.groundLine = this.add.rectangle(0, this.groundY, WORLD_WIDTH, 2, 0xcccccc).setOrigin(0).setAlpha(0)

    // =================================================
    // UFO — ambient background object
    // =================================================

    this.ufo = this.add.image(400, 440, 'ufo')
      .setScale(0.71)
      .setAlpha(0.82)
      .setDepth(1)
      .setScrollFactor(0.15)

    this.ufoScale  = 0.71
    this.ufoHeight = 440
    this.ufoTime   = 0


    // =================================================
    // PLAYER
    // =================================================

    this.player = {
      x: Math.floor(WORLD_WIDTH / 2),
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
    this.playerSprite.setScrollFactor(1)
    this.playerSprite.setDepth(10)
    this.createSpriteAnimations()

    // =================================================
    // INPUT
    // =================================================

    this.keys = this.input.keyboard.addKeys({
      left:            Phaser.Input.Keyboard.KeyCodes.A,
      right:           Phaser.Input.Keyboard.KeyCodes.D,
      jump:            Phaser.Input.Keyboard.KeyCodes.W,
      run:             Phaser.Input.Keyboard.KeyCodes.SHIFT,
      point:           Phaser.Input.Keyboard.KeyCodes.R,
      laugh:           Phaser.Input.Keyboard.KeyCodes.ONE,
      heavyLaugh:      Phaser.Input.Keyboard.KeyCodes.TWO,
      cry:             Phaser.Input.Keyboard.KeyCodes.THREE,
      angry:           Phaser.Input.Keyboard.KeyCodes.FOUR,
      moderatelyAngry: Phaser.Input.Keyboard.KeyCodes.FIVE,
      faceHeart:       Phaser.Input.Keyboard.KeyCodes.SIX,
      faceScream:      Phaser.Input.Keyboard.KeyCodes.SEVEN,
    })

    this.nameInput = document.getElementById('player-name')

    if (this.nameInput) {
      this.nameInput.value = this.name
      this.nameInput.addEventListener('change', () => this.handlePlayerNameChange())
    }

    // =================================================
    // SETTINGS PANEL — collapsible, behind ⚙ button
    // =================================================

    this.emoteNudge   = 35
    this.emoteScale   = 1.65
    this.groundOffset = 91
    this.ufoScale     = 0.71
    this.ufoHeight    = 440

    // ---- Settings button ----
    const settingsBtn = document.createElement('button')
    settingsBtn.id = 'settings-btn'
    settingsBtn.textContent = '⚙ Settings'
    settingsBtn.style.cssText = `
      position: fixed; top: 10px; right: 10px;
      padding: 6px 14px; font-family: Arial; font-size: 13px;
      background: rgba(255,255,255,0.92); border: 1px solid #ccc;
      border-radius: 8px; cursor: pointer; z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    `
    document.body.appendChild(settingsBtn)

    // ---- Panel ----
    const panel = document.createElement('div')
    panel.id = 'settings-panel'
    panel.style.cssText = `
      position: fixed; top: 44px; right: 10px;
      background: rgba(255,255,255,0.97); border: 1px solid #ddd;
      border-radius: 10px; padding: 14px 18px;
      font-family: Arial; font-size: 13px; z-index: 9998;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      display: none; flex-direction: column; gap: 10px; min-width: 260px;
    `
    document.body.appendChild(panel)

    settingsBtn.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'flex' : 'none'
    })

    // ---- Helper: build a labeled +/- row ----
    const makeRow = (label, desc, getValue, setValue, step, onChange) => {
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;align-items:center;gap:8px;'

      const lbl = document.createElement('div')
      lbl.style.cssText = 'flex:1;'
      lbl.innerHTML = `<div style="font-weight:bold;color:#333">${label}</div><div style="color:#999;font-size:11px">${desc}</div>`

      const btn1 = document.createElement('button')
      btn1.textContent = '−'
      btn1.style.cssText = 'width:24px;height:24px;cursor:pointer;font-size:15px;border-radius:4px;border:1px solid #ccc'

      const inp = document.createElement('input')
      inp.type = 'number'
      inp.value = getValue()
      inp.step = step
      inp.style.cssText = 'width:60px;text-align:center;font-size:13px;border:1px solid #ccc;border-radius:4px;padding:2px 4px'

      const btn2 = document.createElement('button')
      btn2.textContent = '+'
      btn2.style.cssText = 'width:24px;height:24px;cursor:pointer;font-size:15px;border-radius:4px;border:1px solid #ccc'

      btn1.addEventListener('click', () => {
        setValue(parseFloat((getValue() - parseFloat(step)).toFixed(3)))
        inp.value = getValue()
        onChange()
      })
      btn2.addEventListener('click', () => {
        setValue(parseFloat((getValue() + parseFloat(step)).toFixed(3)))
        inp.value = getValue()
        onChange()
      })
      inp.addEventListener('change', e => {
        setValue(parseFloat(e.target.value) || 0)
        onChange()
      })

      row.append(lbl, btn1, inp, btn2)
      return row
    }

    const sep = () => {
      const d = document.createElement('div')
      d.style.cssText = 'border-top:1px solid #eee;margin:2px 0'
      return d
    }

    // ---- Ground Level ----
    panel.appendChild(makeRow(
      'Ground Level', 'px from screen bottom — moves baseline & character feet',
      () => this.groundOffset,
      v => {
        this.groundOffset = v
        this.groundY = this.scale.height - this.groundOffset
        this.groundLine.setY(this.groundY)
        if (this.player.grounded) this.player.y = this.groundY
        console.log(`Ground: ${this.groundOffset} | EmoteNudge: ${this.emoteNudge} | EmoteScale: ${this.emoteScale}`)
      },
      1, () => {}
    ))
    panel.appendChild(sep())

    // ---- Emote Offset ----
    panel.appendChild(makeRow(
      'Emote Offset', 'vertical nudge for emote sprites (laugh, cry, angry…)',
      () => this.emoteNudge,
      v => { this.emoteNudge = v },
      1, () => {}
    ))

    panel.appendChild(sep())

    // ---- Emote Scale ----
    panel.appendChild(makeRow(
      'Emote Scale', 'size multiplier for emote sprites',
      () => this.emoteScale,
      v => { this.emoteScale = v },
      0.01, () => {}
    ))

    panel.appendChild(sep())

    // ---- BG Position X ----
    panel.appendChild(makeRow(
      'BG Position X', 'horizontal focus of background image (0=left, 100=right)',
      () => window._bgPosX ?? 50,
      v => { window._bgPosX = v; window._applyBg && window._applyBg() },
      1, () => {}
    ))

    panel.appendChild(sep())

    // ---- BG Position Y ----
    panel.appendChild(makeRow(
      'BG Position Y', 'vertical focus of background image (0=top, 100=bottom)',
      () => window._bgPosY ?? 50,
      v => { window._bgPosY = v; window._applyBg && window._applyBg() },
      1, () => {}
    ))

    panel.appendChild(sep())

    // ---- BG Size ----
    panel.appendChild(makeRow(
      'BG Size %', 'zoom level of background image (100=fit, higher=zoom in)',
      () => window._bgSize ?? 100,
      v => { window._bgSize = v; window._applyBg && window._applyBg() },
      5, () => {}
    ))

    panel.appendChild(sep())

    // ---- UFO Scale ----
    panel.appendChild(makeRow(
      'UFO Scale', 'size of the UFO (0.05=tiny, 0.3=large)',
      () => this.ufoScale,
      v => { this.ufoScale = v },
      0.01, () => {}
    ))

    panel.appendChild(sep())

    // ---- UFO Height ----
    panel.appendChild(makeRow(
      'UFO Height', 'mean vertical position on screen (px from top)',
      () => this.ufoHeight,
      v => { this.ufoHeight = v },
      5, () => {}
    ))

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
    ).setScrollFactor(0)

    this.controlsText = this.add.text(
      20, 50,
      'A/D move · W jump · SHIFT run · R point · 1 laugh · 2 heavy laugh · 3 cry · 4 angry · 5 mod.angry · 6 😍 · 7 😱',
      { fontFamily: 'Arial', fontSize: '13px', color: '#888888' }
    ).setScrollFactor(0)

    // Manual edge-scroll: camera only moves when player is near screen edges
    this.scrollX = Math.floor(WORLD_WIDTH / 2) - Math.floor(this.scale.width / 2)
    this.cameras.main.setScroll(0, 0)


    // =================================================
    // EMOJI POINTER SETUP
    // =================================================

    // Emoji on a circle around the character, pointing at cursor
    this.emojiPointer = this.add.text(0, 0, '👉', {
      fontSize: '28px'
    }).setOrigin(0.5, 0.5).setVisible(false).setDepth(20)

    this.emojiAngle = 0

    // Face emoji — shown on character's head when 6 or 7 is held
    this.faceEmoji = this.add.text(0, 0, '', {
      fontSize: '28px'
    }).setOrigin(0.5, 0.5).setVisible(false).setDepth(20)

    this.activeFaceEmoji = null  // '😍' | '😱' | null

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
  // SPRITE CREATION
  // =================================================

  createCharacterSprite() {
    return this.add.sprite(0, 0, 'stickman-idle-sheet')
      .setOrigin(0.5, 0.5)
      .setScale(STICKMAN_SPRITE_SCALE)
      .setVisible(false)
  }

  // =================================================
  // SPRITE ANIMATIONS
  // =================================================

  createSpriteAnimations() {
    const specs = [
      { key: 'stickman-idle',             sheet: 'stickman-idle-sheet',             frames: 16, frameRate: 8  },
      { key: 'stickman-walk',             sheet: 'stickman-walk-sheet',             frames: 16, frameRate: 14 },
      { key: 'stickman-jump',             sheet: 'stickman-jump-sheet',             frames: 16, frameRate: 10 },
      { key: 'stickman-laugh',            sheet: 'stickman-laugh-sheet',            frames: 16, frameRate: 12 },
      { key: 'stickman-heavy_laugh',      sheet: 'stickman-heavy-laugh-sheet',      frames: 16, frameRate: 14 },
      { key: 'stickman-cry',              sheet: 'stickman-cry-sheet',              frames: 16, frameRate: 9  },
      { key: 'stickman-angry',            sheet: 'stickman-angry-sheet',            frames: 16, frameRate: 8  },
      { key: 'stickman-moderately_angry', sheet: 'stickman-moderately-angry-sheet', frames: 16, frameRate: 8  },
    ]

    specs.forEach(spec => {
      if (this.anims.exists(spec.key)) return
      this.anims.create({
        key: spec.key,
        frames: this.anims.generateFrameNumbers(spec.sheet, { start: 0, end: spec.frames - 1 }),
        frameRate: spec.frameRate,
        repeat: -1,
      })
    })
  }

  // =================================================
  // RENDER CHARACTER — main dispatcher
  // =================================================

  renderCharacter(graphics, sprite, player, color, isLocal = false) {
    if (SPRITE_POSES.has(player.pose)) {
      this.drawSpriteCharacter(graphics, sprite, player, color)
      return
    }

    sprite.setVisible(false)
    this.drawCharacter(graphics, player, color, isLocal)
  }

  // =================================================
  // DRAW SPRITE CHARACTER
  // =================================================

  drawSpriteCharacter(graphics, sprite, player, color) {
    graphics.clear()

    const poseMap = {
      idle:             'stickman-idle',
      walk:             'stickman-walk',
      jump:             'stickman-jump',
      laugh:            'stickman-laugh',
      heavy_laugh:      'stickman-heavy_laugh',
      cry:              'stickman-cry',
      angry:            'stickman-angry',
      moderately_angry: 'stickman-moderately_angry',
    }

    const key = poseMap[player.pose]

    // Per-pose scale — live-tunable via the on-screen sliders
    const isEmotePose = !['idle','walk'].includes(player.pose)
    const scale = STICKMAN_SPRITE_SCALE * (isEmotePose ? (this.emoteScale ?? 1.65) : 1.0)

    // Base feet alignment: shift sprite up so feet pixel (SPRITE_FEET_Y) sits on player.y
    const feetOffsetY = (SPRITE_FEET_Y - SPRITE_FRAME_SIZE / 2) * scale

    // Per-pose vertical nudge — live-tunable via the on-screen sliders
    const isEmote = !['idle','walk'].includes(player.pose)
    const nudge = isEmote ? (this.emoteNudge ?? 35) : 0
    const posY = player.y - feetOffsetY + nudge

    sprite
      .setVisible(true)
      .setPosition(player.x, posY)
      .setTint()
      .setScale((player.facing || 1) * scale, scale)

    if (sprite.anims.currentAnim?.key !== key) {
      sprite.play(key)
    }

    if (player.pose === 'walk') {
      sprite.anims.timeScale = Phaser.Math.Clamp(Math.abs(player.vx) / 1.5, 0.65, 1.1)
    } else {
      sprite.anims.timeScale = 1
    }

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

    if (this.player.x < 40)              this.player.x = 40
    if (this.player.x > WORLD_WIDTH - 40) this.player.x = WORLD_WIDTH - 40

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
      this.player.pose = 'idle'
    } else if (this.keys.heavyLaugh.isDown) {
      this.player.pose = 'heavy_laugh'
    } else if (this.keys.laugh.isDown) {
      this.player.pose = 'laugh'
    } else if (this.keys.cry.isDown) {
      this.player.pose = 'cry'
    } else if (this.keys.angry.isDown) {
      this.player.pose = 'angry'
    } else if (this.keys.moderatelyAngry.isDown) {
      this.player.pose = 'moderately_angry'
    } else if (!this.player.grounded) {
      this.player.pose = 'jump'
    } else if (Math.abs(this.player.vx) > 0.15) {
      this.player.pose = 'walk'
    } else {
      this.player.pose = 'idle'
    }

    // =================================================
    // FACE EMOJI
    // =================================================

    if (this.keys.faceHeart.isDown) {
      this.activeFaceEmoji = '😍'
    } else if (this.keys.faceScream.isDown) {
      this.activeFaceEmoji = '😱'
    } else {
      this.activeFaceEmoji = null
    }

    if (this.activeFaceEmoji) {
      // Position on character head — slightly above nameText
      const headY = this.player.y - 148
      this.faceEmoji
        .setText(this.activeFaceEmoji)
        .setPosition(this.player.x, headY)
        .setVisible(true)
    } else {
      this.faceEmoji.setVisible(false)
    }

    // Edge-scroll: move camera so player stays within [margin, screenW-margin]
    const screenW       = this.scale.width
    const margin        = screenW * 0.15
    const playerScreenX = this.player.x - this.scrollX

    if (playerScreenX > screenW - margin) {
      this.scrollX = this.player.x - (screenW - margin)
    }
    if (playerScreenX < margin) {
      this.scrollX = this.player.x - margin
    }

    this.scrollX = Phaser.Math.Clamp(this.scrollX, 0, WORLD_WIDTH - screenW)
    this.cameras.main.setScroll(this.scrollX, 0)


    // =================================================
    // EMOJI POINTER UPDATE
    // =================================================

    if (this.keys.point.isDown) {
      // Hide real cursor
      this.game.canvas.style.cursor = 'none'

      // Get cursor world position
      const ptr = this.input.activePointer
      const cursorWorldX = ptr.x + this.scrollX
      const cursorWorldY = ptr.y

      // Angle from player to cursor
      const dx = cursorWorldX - this.player.x
      const dy = cursorWorldY - this.player.y
      const targetAngle = Math.atan2(dy, dx)

      // Smoothly rotate emoji angle toward cursor angle
      this.emojiAngle = Phaser.Math.Angle.RotateTo(this.emojiAngle, targetAngle, 0.18)

      // Place emoji on a circle centered at mid-body (half the character height above ground)
      const charHeight = SPRITE_FEET_Y * STICKMAN_SPRITE_SCALE  // ~125px
      const circleCenterY = this.player.y - charHeight * 0.5    // mid-body
      const radius = 80
      const ex = this.player.x + Math.cos(this.emojiAngle) * radius
      const ey = circleCenterY + Math.sin(this.emojiAngle) * radius

      // Rotate emoji text to face outward (pointing away from character)
      let deg = Phaser.Math.RadToDeg(this.emojiAngle)
      let flipX = 1
      if (deg > 90 || deg < -90) {
        flipX = -1
        deg += 180
      }

      this.emojiPointer
        .setVisible(true)
        .setPosition(ex, ey)
        .setRotation(Phaser.Math.DegToRad(deg))
        .setScale(flipX, 1)

    } else {
      // Restore cursor and hide emoji
      this.game.canvas.style.cursor = 'default'
      this.emojiPointer.setVisible(false)
    }

    this.renderCharacter(this.playerGraphics, this.playerSprite, this.player, this.playerColor, true)

    this.nameText.setPosition(this.player.x, this.player.y - 165)

    // =================================================
    // UFO ANIMATION
    // =================================================

    this.ufoTime += delta * 0.001
    const ufoScreenX = ((this.ufoTime * 28) % (this.scale.width + 200)) - 100
    const ufoScreenY = this.ufoHeight + Math.sin(this.ufoTime * 0.6) * 18
    const ufoRotation = Math.sin(this.ufoTime * 1.1) * 0.04

    this.ufo.setPosition(ufoScreenX, ufoScreenY)
    this.ufo.setScale(this.ufoScale)
    this.ufo.setRotation(ufoRotation)

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
      elbowSide:  data.elbowSide  || 1,
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

// =================================================
// BACKGROUND DIV — injected before Phaser starts
// =================================================

const _bgDiv = document.createElement('div')
_bgDiv.id = 'game-bg'
_bgDiv.style.cssText = `
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  z-index: -1;
  pointer-events: none;
`
document.body.style.margin = '0'
document.body.style.overflow = 'hidden'
document.body.appendChild(_bgDiv)

// -------------------------------------------------
// BG state — controlled via Settings panel in-game
// -------------------------------------------------

window._bgPosX = 50
window._bgPosY = 100
window._bgSize = 100

window._applyBg = function() {
  _bgDiv.style.backgroundImage = `url('assets/background.png')`
  _bgDiv.style.backgroundRepeat = 'no-repeat'
  _bgDiv.style.backgroundSize = `${window._bgSize}%`
  _bgDiv.style.backgroundPosition = `${window._bgPosX}% ${window._bgPosY}%`
}
window._applyBg()

console.log("CREATING GAME")

export const gameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'app',
  transparent: true,
  backgroundColor: 'transparent',
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