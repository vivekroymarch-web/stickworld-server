
console.log("GAME FILE LOADED")

import { DEFAULT_WORLD } from './worlds.js'
import { EntityManager, SIGN_MESSAGES } from './entities.js'

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
const WORLD_WIDTH = DEFAULT_WORLD.width
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
    this.playerColor = 0x2255ff
    this.playerHat = 'none'
    this.playerGlasses = false
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

    // =================================================
    // MUSHROOM CHARACTER — 640×64 sheet, 10 frames of 64×64
    // =================================================
    this.load.spritesheet(
      'mushroom-sheet',
      'assets/stickman/mushroom.png',
      { frameWidth: 80, frameHeight: 64 }
    )
  }

  create() {
    console.log("CREATE RUNNING")

    this.role = 'player'
    this.worldId = DEFAULT_WORLD.id

    // -----------------------------------------------
    // LOGIN OVERLAY — redesigned with color + accessories
    // -----------------------------------------------
    const COLORS = [
      { hex: '#2255ff', val: 0x2255ff }, { hex: '#ff3333', val: 0xff3333 },
      { hex: '#22bb44', val: 0x22bb44 }, { hex: '#cc44cc', val: 0xcc44cc },
      { hex: '#ff8800', val: 0xff8800 }, { hex: '#00bbcc', val: 0x00bbcc },
      { hex: '#ffdd00', val: 0xffdd00 }, { hex: '#ffffff', val: 0xffffff },
    ]
    const HATS = ['none', 'cap', 'wizard', 'crown']
    const HAT_LABELS = { none: 'None', cap: '🧢 Cap', wizard: '🎩 Wizard', crown: '👑 Crown' }

    let selectedColor = COLORS[0].val
    let selectedHat = 'none'
    let selectedGlasses = false
    let selectedRole = null

    const loginOverlay = document.createElement('div')
    loginOverlay.style.cssText = `
      position:fixed; top:0; left:0; width:100%; height:100%;
      background:rgba(0,0,0,0.88); z-index:10000;
      display:flex; justify-content:center; align-items:center;
      font-family:'Segoe UI',Arial,sans-serif;
    `
    loginOverlay.innerHTML = `
      <div id="login-box" style="background:#1a1a2e; color:#fff; padding:32px 36px;
        border-radius:16px; text-align:center; min-width:340px;
        box-shadow:0 8px 40px rgba(0,0,0,0.7); border:1px solid #333;">
        <h2 style="margin:0 0 6px; font-size:22px; color:#8899ff;">Welcome to Stickworld</h2>
        <p style="margin:0 0 20px; color:#888; font-size:13px;">Choose your role to enter</p>

        <div style="display:flex; gap:12px; justify-content:center; margin-bottom:24px;">
          <button id="btn-player" style="flex:1; padding:12px 0; font-size:15px; font-weight:bold;
            background:#2255ff; color:#fff; border:none; border-radius:8px; cursor:pointer;">
            🎮 Player
          </button>
          <button id="btn-editor" style="flex:1; padding:12px 0; font-size:15px; font-weight:bold;
            background:#333; color:#aaa; border:1px solid #555; border-radius:8px; cursor:pointer;">
            ✏️ Editor
          </button>
        </div>

        <div id="login-form" style="display:none;">
          <input type="text" id="login-input" placeholder="Your name"
            style="width:100%; box-sizing:border-box; padding:10px 14px; font-size:15px;
            border-radius:8px; border:1px solid #444; background:#111; color:#fff; margin-bottom:16px;"/>

          <div id="customization-section" style="display:none;">
            <p style="margin:0 0 8px; color:#aaa; font-size:12px; text-align:left;">Character Color</p>
            <div id="color-swatches" style="display:flex; gap:7px; flex-wrap:wrap; margin-bottom:14px;">
              ${COLORS.map((c,i) => `
                <div class="swatch" data-color="${c.val}" style="
                  width:28px; height:28px; border-radius:50%; background:${c.hex}; cursor:pointer;
                  border:3px solid ${i===0?'#fff':'transparent'}; box-sizing:border-box;"
                ></div>`).join('')}
            </div>

            <p style="margin:0 0 8px; color:#aaa; font-size:12px; text-align:left;">Hat</p>
            <div id="hat-swatches" style="display:flex; gap:7px; margin-bottom:14px;">
              ${HATS.map((h,i) => `
                <button class="hat-btn" data-hat="${h}" style="
                  flex:1; padding:6px 0; font-size:12px; cursor:pointer; border-radius:6px;
                  background:${i===0?'#2255ff':'#222'}; color:#fff; border:1px solid #444;">
                  ${HAT_LABELS[h]}
                </button>`).join('')}
            </div>

            <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
              <input type="checkbox" id="glasses-check" style="width:16px;height:16px;cursor:pointer;"/>
              <label for="glasses-check" style="color:#aaa; font-size:13px; cursor:pointer;">👓 Glasses</label>
            </div>
          </div>

          <button id="btn-proceed" style="width:100%; padding:12px 0; font-size:15px; font-weight:bold;
            background:#2255ff; color:#fff; border:none; border-radius:8px; cursor:pointer;">
            Proceed →
          </button>
        </div>
      </div>
    `
    document.body.appendChild(loginOverlay)

    // Color swatches
    loginOverlay.querySelectorAll('.swatch').forEach(el => {
      el.onclick = () => {
        selectedColor = parseInt(el.dataset.color)
        loginOverlay.querySelectorAll('.swatch').forEach(s => s.style.borderColor = 'transparent')
        el.style.borderColor = '#fff'
      }
    })

    // Hat buttons
    loginOverlay.querySelectorAll('.hat-btn').forEach(el => {
      el.onclick = () => {
        selectedHat = el.dataset.hat
        loginOverlay.querySelectorAll('.hat-btn').forEach(b => b.style.background = '#222')
        el.style.background = '#2255ff'
      }
    })

    document.getElementById('glasses-check').onchange = (e) => { selectedGlasses = e.target.checked }

    document.getElementById('btn-player').onclick = () => {
      selectedRole = 'player'
      const form = document.getElementById('login-form')
      form.style.display = 'block'
      document.getElementById('login-input').placeholder = 'Your name'
      document.getElementById('login-input').type = 'text'
      document.getElementById('customization-section').style.display = 'block'
      document.getElementById('login-input').focus()
    }

    document.getElementById('btn-editor').onclick = () => {
      selectedRole = 'editor'
      const form = document.getElementById('login-form')
      form.style.display = 'block'
      document.getElementById('login-input').placeholder = 'Enter password'
      document.getElementById('login-input').type = 'password'
      document.getElementById('customization-section').style.display = 'none'
      document.getElementById('login-input').focus()
    }

    document.getElementById('btn-proceed').onclick = () => {
      const val = document.getElementById('login-input').value.trim()
      if (selectedRole === 'editor') {
        if (val !== 'qwerty') { alert('Incorrect password!'); return }
      } else {
        if (val) this.name = val
        this.playerColor = selectedColor
        this.playerHat = selectedHat
        this.playerGlasses = selectedGlasses
      }
      loginOverlay.remove()
      this.role = selectedRole
      if (this.role === 'editor') {
        const settingsBtn = document.getElementById('settings-btn')
        if (settingsBtn) settingsBtn.style.display = 'block'
        this._buildEntityPalette()
      }
      if (this.nameInput) this.nameInput.value = this.name
      this.nameText.setText(this.name)
      this.sendPacket('join', { world: this.worldId })
    }

    this.groundY = this.scale.height - DEFAULT_WORLD.groundOffset
    this.groundOffset = DEFAULT_WORLD.groundOffset
    this.game.canvas.style.imageRendering = 'pixelated'

    this.physics.world.setBounds(0, 0, DEFAULT_WORLD.width, this.scale.height)
    this.cameras.main.setBounds(0, 0, DEFAULT_WORLD.width, this.scale.height)

    // Entity Manager
    this.entityManager = new EntityManager(this)

    // =================================================
    // BACKGROUND (PARALLAX + SKY)
    // =================================================
    
    // Moon / glow
    this.moon = this.add.circle(DEFAULT_WORLD.width / 2, 200, 80, 0xddddff, 0.8)
      .setScrollFactor(0.05)
      .setDepth(-10)

    // Parallax layers (mountains/hills)
    this.bgLayer1 = this.add.graphics().setScrollFactor(0.2).setDepth(-9)
    this.bgLayer2 = this.add.graphics().setScrollFactor(0.5).setDepth(-8)

    // Draw some simple procedural mountains
    this.bgLayer1.fillStyle(0x1a1a2e, 1)
    for (let i = 0; i < DEFAULT_WORLD.width + 1000; i += 200) {
      this.bgLayer1.fillTriangle(i - 100, this.groundY, i + 300, this.groundY, i + 100, this.groundY - 300 - Math.random() * 150)
    }

    this.bgLayer2.fillStyle(0x22223b, 1)
    for (let i = 0; i < DEFAULT_WORLD.width + 1000; i += 150) {
      this.bgLayer2.fillTriangle(i - 50, this.groundY, i + 200, this.groundY, i + 75, this.groundY - 150 - Math.random() * 100)
    }

    // Post-processing Bloom on the camera
    // Note: Phaser 3 postFX requires webgl. It adds a nice glow to bright colors.
    if (this.cameras.main.postFX) {
      this.bloomPipeline = this.cameras.main.postFX.addBloom(0xffffff, 1, 1, 1, 1.2)
    }

    // =================================================
    // GROUND
    // =================================================

    this.groundLine = this.add.rectangle(0, this.groundY, DEFAULT_WORLD.width, 2, 0x444466).setOrigin(0).setAlpha(1).setDepth(-7)
    this.groundFill = this.add.rectangle(0, this.groundY + 2, DEFAULT_WORLD.width, this.scale.height - this.groundY, 0x11111c).setOrigin(0).setDepth(-7)

    // =================================================
    // UFO — ambient background object
    // =================================================

    this.ufo = this.add.image(400, 440, 'ufo')
      .setScale(0.71)
      .setAlpha(0.82)
      .setDepth(1)

    this.ufoScale  = 0.71
    this.ufoHeight = 440
    this.ufoTime   = 0

    // =================================================
    // MUSHROOM PATH EDITOR
    // =================================================

    this.pathEditorEnabled = false

    this.mushroomPath = [
  {
    "x": 1953,
    "y": 912.5
  },
  {
    "x": 1930,
    "y": 888.5
  },
  {
    "x": 1875,
    "y": 879.5
  },
  {
    "x": 1835,
    "y": 867.5
  },
  {
    "x": 1815,
    "y": 849.5
  },
  {
    "x": 1779,
    "y": 841.5
  },
  {
    "x": 1735,
    "y": 837.5
  },
  {
    "x": 1685,
    "y": 837.5
  },
  {
    "x": 1631,
    "y": 834.5
  },
  {
    "x": 1577,
    "y": 827.5
  },
  {
    "x": 1614,
    "y": 806.5
  },
  {
    "x": 1640,
    "y": 805.5
  },
  {
    "x": 1666,
    "y": 804.5
  },
  {
    "x": 1708,
    "y": 805.5
  },
  {
    "x": 1734,
    "y": 810.5
  },
  {
    "x": 1768,
    "y": 814.5
  },
  {
    "x": 1788,
    "y": 814.5
  },
  {
    "x": 1830,
    "y": 818.5
  },
  {
    "x": 1861,
    "y": 822.5
  },
  {
    "x": 1889,
    "y": 823.5
  },
  {
    "x": 1908,
    "y": 826.5
  },
  {
    "x": 1932,
    "y": 828.5
  },
  {
    "x": 1953,
    "y": 828.5
  },
  {
    "x": 2005,
    "y": 827.5
  },
  {
    "x": 2029,
    "y": 831.5
  },
  {
    "x": 2096,
    "y": 833.5
  },
  {
    "x": 2135,
    "y": 831.5
  },
  {
    "x": 2186,
    "y": 830.5
  },
  {
    "x": 2244,
    "y": 831.5
  },
  {
    "x": 2286,
    "y": 832.5
  },
  {
    "x": 2333,
    "y": 833.5
  },
  {
    "x": 2382,
    "y": 834.5
  },
  {
    "x": 2410,
    "y": 835.5
  },
  {
    "x": 2435,
    "y": 821.5
  },
  {
    "x": 2465,
    "y": 821.5
  },
  {
    "x": 2495,
    "y": 821.5
  },
  {
    "x": 2530,
    "y": 824.5
  },
  {
    "x": 2553,
    "y": 824.5
  },
  {
    "x": 2604,
    "y": 825.5
  },
  {
    "x": 2655,
    "y": 824.5
  },
  {
    "x": 2699,
    "y": 823.5
  },
  {
    "x": 2728,
    "y": 822.5
  },
  {
    "x": 2778,
    "y": 812.5
  },
  {
    "x": 2845,
    "y": 815.5
  },
  {
    "x": 2879,
    "y": 813.5
  },
  {
    "x": 2918,
    "y": 813.5
  },
  {
    "x": 2960,
    "y": 813.5
  },
  {
    "x": 2996,
    "y": 813.5
  },
  {
    "x": 3050,
    "y": 812.5
  },
  {
    "x": 3091,
    "y": 814.5
  },
  {
    "x": 3125,
    "y": 814.5
  },
  {
    "x": 3158,
    "y": 811.5
  },
  {
    "x": 3197,
    "y": 809.5
  },
  {
    "x": 3236,
    "y": 808.5
  },
  {
    "x": 3278,
    "y": 807.5
  },
  {
    "x": 3344,
    "y": 812.5
  },
  {
    "x": 3372,
    "y": 813.5
  },
  {
    "x": 3416,
    "y": 816.5
  },
  {
    "x": 3443,
    "y": 814.5
  },
  {
    "x": 3458,
    "y": 841.5
  },
  {
    "x": 3415,
    "y": 848.5
  },
  {
    "x": 3344,
    "y": 847.5
  },
  {
    "x": 3314,
    "y": 846.5
  },
  {
    "x": 3263,
    "y": 846.5
  },
  {
    "x": 3225,
    "y": 842.5
  },
  {
    "x": 3176,
    "y": 843.5
  },
  {
    "x": 3150,
    "y": 849.5
  },
  {
    "x": 3126,
    "y": 863.5
  },
  {
    "x": 3104,
    "y": 879.5
  },
  {
    "x": 3085,
    "y": 897.5
  },
  {
    "x": 3063,
    "y": 911.5
  },
  {
    "x": 3028,
    "y": 915.5
  }
]

    this.pathGraphics = this.add.graphics().setDepth(999)

    this.pathHandles = []

    this.pathText = this.add.text(20, 90, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#00ff88',
      backgroundColor: '#000000aa',
      padding: { x: 8, y: 6 }
    })
    .setScrollFactor(0)
    .setDepth(999)

    this.pathHelp = this.add.text(
      380,
      90,
      'P = toggle path editor\nLEFT CLICK = add point\nDRAG = move point\nHOLD X + CLICK = delete point',
      {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 6 }
      }
    )
    .setScrollFactor(0)
    .setDepth(999)
    .setVisible(false)

    this.copyBtn = document.createElement('button')
    this.copyBtn.textContent = 'Copy Path JSON'
    this.copyBtn.style.cssText = 'position:fixed; top:70px; left:20px; z-index:9999; display:none; padding:4px 8px; cursor:pointer; background:#fff; border:1px solid #000; border-radius:4px; font-family:Arial; font-size:12px;'
    this.copyBtn.onclick = () => {
      navigator.clipboard.writeText(JSON.stringify(this.mushroomPath, null, 2))
        .then(() => alert('Copied to clipboard!'))
    }
    document.body.appendChild(this.copyBtn)

    this.pathToggleKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.P, false
    )

    this.pathDeleteKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.X, false
    )

    this.input.mouse.disableContextMenu()

    this.refreshPathEditor()

    this.input.on('pointerdown', (pointer) => {

      if (!this.pathEditorEnabled) return

      // X KEY HELD = DELETE
      if (this.pathDeleteKey.isDown) {

        for (let i = this.pathHandles.length - 1; i >= 0; i--) {

          const h = this.pathHandles[i]

          if (h.getBounds().contains(pointer.worldX, pointer.worldY)) {

            h.destroy()

            this.pathHandles.splice(i, 1)
            this.mushroomPath.splice(i, 1)

            this.refreshPathEditor()

            return
          }
        }
      }

      // NORMAL CLICK = ADD
      const clickedHandle = this.pathHandles.some(h =>
        h.getBounds().contains(pointer.worldX, pointer.worldY)
      )

      if (clickedHandle) return

      this.mushroomPath.push({
        x: pointer.worldX,
        y: pointer.worldY,
      })

      this.refreshPathEditor()
    })

// =================================================
// MUSHROOM NPC
// =================================================


    // =================================================
    // PLAYER
    // =================================================

    this.player = {
      x:          DEFAULT_WORLD.spawnX,
      y:          this.groundY,
      vx: 0, vy: 0,
      facing:     1,
      grounded:   true,
      pose:       'idle',
      animTime:   0,
      walkCycle:  0,
      pointAngle: 0,
      elbowSide:  1,
      squashY:    1,
      squashX:    1,
      tearTimer:  0,
      iceTimer:   0,
    }

    this.playerShadow = this.add.ellipse(this.player.x, this.groundY, 40, 10, 0x000000, 0.5).setDepth(2)

    // =================================================
    // GRAPHICS
    // =================================================

    this.playerGraphics = this.add.graphics()
    this.playerSprite = this.createCharacterSprite()
    this.playerSprite.setScrollFactor(1)
    this.playerSprite.setDepth(10)
    this.createSpriteAnimations()
    // =================================================
// MUSHROOM NPC
// =================================================

this.mushroom = this.add.sprite(
  this.mushroomPath[0].x,
  this.mushroomPath[0].y,
  'mushroom-sheet'
)

this.mushroom
  .setOrigin(0.5, 1)
  .setScale(2)
  .setDepth(8)

this.mushroom.play('mushroom-walk')

this.mushroomPathIndex = 0
this.mushroomSpeed = 1.2
// CHANGE 3: direction flag for ping-pong path traversal
this.mushroomDirection = 1   // 1 = forward, -1 = reverse

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
    }, false)

    this.nameInput = document.getElementById('player-name')

    if (this.nameInput) {
      this.nameInput.value = this.name
      this.nameInput.addEventListener('change', () => this.handlePlayerNameChange())
    }

    // =================================================
    // SETTINGS PANEL — collapsible, behind ⚙ button
    // =================================================

    this.emoteNudge      = 35
    this.emoteScale      = 1.65
    this.groundOffset    = 91
    this.ufoScale        = 0.71
    this.ufoHeight       = 440
    this.faceEmojiOffset = 98
    this.jumpVelocity    = 5
    // CHANGE 1: player speed multiplier
    this.playerSpeed     = 1.0
    this.animationAdjustments = {

  idle: {
    offsetY: 2,
    scale: 1.0,
  },

  walk: {
    offsetY: 0,
    scale: 1.0,
  },

  jump: {
    offsetY: 35,
    scale: 1.65,
  },

  laugh: {
    offsetY: 35,
    scale: 1.65,
  },

  heavy_laugh: {
    offsetY: 35,
    scale: 1.65,
  },

  cry: {
    offsetY: 35,
    scale: 1.65,
  },

  angry: {
    offsetY: 35,
    scale: 1.65,
  },

  moderately_angry: {
    offsetY: 35,
    scale: 1.65,
  }
}

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
      display: none;
    `
    document.body.appendChild(settingsBtn)

    // ---- Panel ----
    const panel = document.createElement('div')
    panel.id = 'settings-panel'
    panel.style.cssText = `
  position: fixed;
  top: 44px;
  right: 10px;

  background: rgba(255,255,255,0.97);
  border: 1px solid #ddd;
  border-radius: 10px;

  padding: 14px 18px;

  font-family: Arial;
  font-size: 13px;

  z-index: 9998;

  box-shadow: 0 4px 16px rgba(0,0,0,0.15);

  display: none;
  flex-direction: column;
  gap: 10px;

  min-width: 260px;

  max-height: 80vh;
  overflow-y: auto;
  overflow-x: hidden;
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
        this.broadcastSettings()
      })

      row.append(lbl, btn1, inp, btn2)
      return row
    }

    this.broadcastSettings = () => {
      if (this.role !== 'editor') return
      this.sendPacket('settings', {
        groundOffset: this.groundOffset,
        ufoScale: this.ufoScale,
        ufoHeight: this.ufoHeight,
        playerSpeed: this.playerSpeed,
        animationAdjustments: this.animationAdjustments,
        bgPosX: window._bgPosX,
        bgPosY: window._bgPosY,
        bgSize: window._bgSize
      })
    }

    const sep = () => {
  const d = document.createElement('div')
  d.style.cssText =
    'border-top:1px solid #eee;margin:2px 0'
  return d
}

const makeSectionTitle = (title) => {

  const el = document.createElement('div')

  el.style.cssText = `
    margin-top: 10px;
    padding: 6px 8px;
    background: #f2f2f2;
    border-radius: 6px;
    font-weight: bold;
    color: #333;
    font-size: 13px;
  `

  el.textContent = title

  return el
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
    

    // ---- Emote Scale ----
    // CHANGE 2: label updated to reflect idle + jump 
    // ---- BG Position X ----

    panel.appendChild(makeRow(
      'BG Position X', 'horizontal focus of background image (0=left, 100=right)',
      () => window._bgPosX ?? 50,
      v => { window._bgPosX = v; window._applyBg && window._applyBg(this.scrollX || 0); this.broadcastSettings() },
      1, () => {}
    ))

    panel.appendChild(sep())

    // ---- BG Position Y ----
    panel.appendChild(makeRow(
      'BG Position Y', 'vertical focus of background image (0=top, 100=bottom)',
      () => window._bgPosY ?? 50,
      v => { window._bgPosY = v; window._applyBg && window._applyBg(this.scrollX || 0); this.broadcastSettings() },
      1, () => {}
    ))

    panel.appendChild(sep())

    // ---- BG Size ----
    panel.appendChild(makeRow(
      'BG Size %', 'zoom level of background image (100=fit, higher=zoom in)',
      () => window._bgSize ?? 100,
      v => { window._bgSize = v; window._applyBg && window._applyBg(this.scrollX || 0); this.broadcastSettings() },
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

    panel.appendChild(sep())

    // ---- CHANGE 1: Player Speed ----
    panel.appendChild(makeRow(
      'Player Speed', 'movement speed multiplier (1.0 = normal)',
      () => this.playerSpeed,
      v => { this.playerSpeed = Math.max(0.1, v) },
      0.1, () => {}
    ))
    panel.appendChild(sep())

panel.appendChild(
  makeSectionTitle('Animation Adjustments')
)

Object.keys(this.animationAdjustments).forEach(anim => {

  panel.appendChild(
    makeSectionTitle(anim.toUpperCase())
  )

  // SCALE

  panel.appendChild(makeRow(
    `${anim} Scale`,
    'animation scale',
    () => this.animationAdjustments[anim].scale,
    v => {
      this.animationAdjustments[anim].scale = v
    },
    0.01,
    () => {}
  ))

  // OFFSET

  panel.appendChild(makeRow(
    `${anim} OffsetY`,
    'vertical adjustment',
    () => this.animationAdjustments[anim].offsetY,
    v => {
      this.animationAdjustments[anim].offsetY = v
    },
    1,
    () => {}
  ))

  panel.appendChild(sep())
})

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
    // origin(0.5, 0) anchors the top of the glyph at the Y position — prevents canvas-top clipping
    this.faceEmoji = this.add.text(0, 0, '', {
      fontSize: '32px'
    }).setOrigin(0.5, 0).setVisible(false).setDepth(20)

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

  refreshPathEditor() {
    this.pathGraphics.clear()

    this.pathHandles.forEach(h => h.destroy())
    this.pathHandles = []

    if (!this.pathEditorEnabled) {
      this.pathText.setVisible(false)
      this.pathHelp.setVisible(false)
      if (this.copyBtn) this.copyBtn.style.display = 'none'
      return
    }

    this.pathText.setVisible(true)
    this.pathHelp.setVisible(true)
    if (this.copyBtn) this.copyBtn.style.display = 'block'

    // Draw path lines
    this.pathGraphics.lineStyle(4, 0x00ff88, 1)

    for (let i = 0; i < this.mushroomPath.length - 1; i++) {
      const p1 = this.mushroomPath[i]
      const p2 = this.mushroomPath[i + 1]

      this.pathGraphics.lineBetween(
        p1.x,
        p1.y,
        p2.x,
        p2.y
      )
    }

    // Draw points

this.mushroomPath.forEach((p, index) => {

  if (index === 0) {
    this.pathGraphics.fillStyle(0x00ff00, 1)
  }
  else if (index === this.mushroomPath.length - 1) {
    this.pathGraphics.fillStyle(0xff0000, 1)
  }
  else {
    this.pathGraphics.fillStyle(0xffcc00, 1)
  }

  this.pathGraphics.fillCircle(p.x, p.y, 8)

  this.pathGraphics.fillStyle(0x000000, 1)
  this.pathGraphics.fillCircle(p.x, p.y, 3)

  const handle = this.add.circle(
    p.x,
    p.y,
    18,
    0xffffff,
    0.001
  )
  .setDepth(1000)
  .setInteractive({ draggable: true })

  handle.on('drag', (pointer, dragX, dragY) => {

    p.x = dragX
    p.y = dragY

    this.refreshPathEditor()
  })

  this.input.setDraggable(handle)

  this.pathHandles.push(handle)
})
    this.pathText.setText(
      'mushroomPath = ' +
      JSON.stringify(this.mushroomPath, null, 2)
    )
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
      // Mushroom character — 10 frames across a 640×64 sheet (64×64 per frame)
      { key: 'mushroom-walk',             sheet: 'mushroom-sheet',                  frames: 8, frameRate: 10 },
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

    const adjust =
  this.animationAdjustments[player.pose] ??
  this.animationAdjustments.idle

const scale =
  STICKMAN_SPRITE_SCALE * adjust.scale

const feetOffsetY =
  (SPRITE_FEET_Y - SPRITE_FRAME_SIZE / 2) * scale

const posY =
  player.y - feetOffsetY + adjust.offsetY

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
    const isTyping = document.activeElement && document.activeElement.tagName === 'INPUT'

    // Toggle path editor
    if (!isTyping && Phaser.Input.Keyboard.JustDown(this.pathToggleKey)) {
      if (this.role === 'editor') {
        this.pathEditorEnabled = !this.pathEditorEnabled
        this.refreshPathEditor()
      }
    }

    const dt       = delta / 16.666
    const onIce    = (this.player.iceTimer ?? 0) > 0
    if (onIce) { this.player.iceTimer -= delta }
    const running  = !isTyping && this.keys.run.isDown
    // CHANGE 1: accel and maxSpeed scaled by playerSpeed
    const accel    = onIce ? 0.01 : (running ? 0.16 * (this.playerSpeed ?? 1) : 0.08 * (this.playerSpeed ?? 1))
    const maxSpeed = running ? 1.4  * (this.playerSpeed ?? 1) : 1.2  * (this.playerSpeed ?? 1)
    const friction = onIce ? 0.995 : 0.82

    if (!isTyping && !onIce && this.keys.left.isDown) {
      this.player.vx -= accel * dt
      this.player.facing = -1
    }

    if (!isTyping && !onIce && this.keys.right.isDown) {
      this.player.vx += accel * dt
      this.player.facing = 1
    }

    this.player.vx = Phaser.Math.Clamp(this.player.vx, -maxSpeed, maxSpeed)
    this.player.vx *= friction

    this.player.x += this.player.vx * dt * 4

    if (this.player.x < 40)               this.player.x = 40
    if (this.player.x > WORLD_WIDTH - 40) this.player.x = WORLD_WIDTH - 40

    if (!isTyping && this.keys.jump.isDown && this.player.grounded) {
      this.player.vy = running ? -(this.jumpVelocity ?? 7) * 1.286 : -(this.jumpVelocity ?? 7)
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

    if (!isTyping && this.keys.point.isDown) {
      this.player.pose = 'idle'
    } else if (!isTyping && this.keys.heavyLaugh.isDown) {
      this.player.pose = 'heavy_laugh'
    } else if (!isTyping && this.keys.laugh.isDown) {
      this.player.pose = 'laugh'
    } else if (!isTyping && this.keys.cry.isDown) {
      this.player.pose = 'cry'
    } else if (!isTyping && this.keys.angry.isDown) {
      this.player.pose = 'angry'
    } else if (!isTyping && this.keys.moderatelyAngry.isDown) {
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

    if (!isTyping && this.keys.faceHeart.isDown) {
      this.activeFaceEmoji = '😍'
    } else if (!isTyping && this.keys.faceScream.isDown) {
      this.activeFaceEmoji = '😱'
    } else {
      this.activeFaceEmoji = null
    }

    if (this.activeFaceEmoji) {
      // Position on character head — offset tunable via Settings panel
      const headY = this.player.y - (this.faceEmojiOffset ?? 148)
      this.faceEmoji
        .setText(this.activeFaceEmoji)
        .setPosition(this.player.x, headY)
        .setVisible(true)
    } else {
      this.faceEmoji.setVisible(false)
    }

    // Edge-scroll: move camera so player stays within [margin, screenW-margin]
    const screenW       = this.scale.width
    const margin        = 100
    const playerScreenX = this.player.x - this.scrollX

    if (playerScreenX > screenW - margin) {
      this.scrollX = this.player.x - (screenW - margin)
    }
    if (playerScreenX < margin) {
      this.scrollX = this.player.x - margin
    }

    this.scrollX = Phaser.Math.Clamp(this.scrollX, 0, WORLD_WIDTH - screenW)
    this.cameras.main.setScroll(this.scrollX, 0)
    window._applyBg(this.scrollX)

    // =================================================
    // EMOJI POINTER UPDATE
    // =================================================

    if (!isTyping && this.keys.point.isDown) {
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
    
    this.playerShadow.setPosition(this.player.x, this.groundY)
    const shadowScale = Phaser.Math.Clamp(1 - (this.groundY - this.player.y) / 200, 0.2, 1)
    this.playerShadow.setScale(shadowScale)
    this.playerShadow.setAlpha(shadowScale * 0.5)

    this.nameText.setPosition(this.player.x, this.player.y - 165)

    // =================================================
    // UFO ANIMATION
    // =================================================

    this.ufoTime += delta * 0.001
    const ufoWorldX = DEFAULT_WORLD.ufo.x + Math.sin(this.ufoTime * 0.4) * 200
    const ufoWorldY = this.ufoHeight + Math.sin(this.ufoTime * 0.6) * 18
    const ufoRotation = Math.sin(this.ufoTime * 1.1) * 0.04

    this.ufo.setPosition(ufoWorldX, ufoWorldY)
    this.ufo.setScale(this.ufoScale)
    this.ufo.setRotation(ufoRotation)

    // =================================================
    // CHANGE 3: MUSHROOM PING-PONG PATH MOVEMENT
    // =================================================

    if (this.mushroomPath.length > 1) {
      let totalLength = 0
      const segments = []
      for(let i=0; i<this.mushroomPath.length-1; i++) {
        const p1 = this.mushroomPath[i]
        const p2 = this.mushroomPath[i+1]
        const d = Phaser.Math.Distance.BetweenPoints(p1, p2)
        segments.push({ p1, p2, dist: d, accum: totalLength })
        totalLength += d
      }

      const speedPxPerSec = this.mushroomSpeed * 60
      const cycleTime = (totalLength * 2) / speedPxPerSec
      const t = (Date.now() / 1000) % cycleTime
      let currentD = t * speedPxPerSec

      let forward = true
      if (currentD > totalLength) {
        currentD = totalLength * 2 - currentD
        forward = false
      }

      let targetSeg = segments[0]
      for(let seg of segments) {
        if (currentD >= seg.accum && currentD <= seg.accum + seg.dist) {
          targetSeg = seg
          break
        }
      }

      const segT = targetSeg.dist === 0 ? 0 : (currentD - targetSeg.accum) / targetSeg.dist
      this.mushroom.x = Phaser.Math.Linear(targetSeg.p1.x, targetSeg.p2.x, segT)
      this.mushroom.y = Phaser.Math.Linear(targetSeg.p1.y, targetSeg.p2.y, segT)

      const dx = targetSeg.p2.x - targetSeg.p1.x
      const moveRight = forward ? dx > 0 : dx < 0
      this.mushroom.setScale(moveRight ? -2 : 2, 2)
    }

    for (const id in this.remotePlayers) {
      const remote = this.remotePlayers[id]
      this.renderCharacter(remote.graphics, remote.sprite, remote, remote.color, false)
      remote.label.setPosition(remote.x, remote.y - 165)
    }

    // =================================================
    // ENTITY MANAGER UPDATE
    // =================================================
    if (this.entityManager) {
      this.entityManager.update(this.player, delta, (event) => this._handleEntityEvent(event))
    }
  }

  // =================================================
  // ENTITY EVENT HANDLER
  // =================================================

  _handleEntityEvent(event) {
    switch (event.type) {
      case 'teleport':
        this.player.x = event.x
        this.player.y = event.y
        this.player.vx = 0
        this.player.vy = 0
        this.cameras.main.flash(300, 100, 120, 255)
        break

      case 'trap_spike': {
        const force = 10
        this.player.vx = event.direction * force
        this.player.vy = -6
        this.player.grounded = false
        this.cameras.main.shake(200, 0.01)
        break
      }

      case 'trap_spring':
        this.player.vy = -18
        this.player.grounded = false
        break

      case 'trap_ice':
        this.player.iceTimer = 2000
        break

      case 'trap_fire':
        this.cameras.main.flash(250, 255, 80, 0)
        this.cameras.main.shake(300, 0.015)
        break

      case 'trap_hole':
        this.player.y = this.groundY + 200
        this.player.vy = 0
        this.cameras.main.flash(400, 0, 0, 0)
        this.time.delayedCall(400, () => {
          this.player.x = event.respawnX
          this.player.y = this.groundY
          this.player.vx = 0
        })
        break

      case 'arrow_fire':
        if (this.entityManager) {
          this.entityManager.fireArrow(event.x, event.y, event.direction)
        }
        break

      case 'crate_push':
        this.sendPacket('entity_push', {
          entityId: event.entityId,
          x: event.x,
          y: event.y
        })
        break
    }
  }

  // =================================================
  // ENTITY PLACEMENT EDITOR (Editor only)
  // =================================================

  _buildEntityPalette() {
    const types = [
      { type: 'portal',  label: '🌀 Portal' },
      { type: 'crate',   label: '📦 Crate' },
      { type: 'sign',    label: '🪧 Sign' },
      { type: 'spike',   label: '🗡️ Spikes' },
      { type: 'spring',  label: '🌀 Spring' },
      { type: 'ice',     label: '🧊 Ice' },
      { type: 'fire',    label: '🔥 Fire' },
      { type: 'hole',    label: '🕳️ Hole' },
      { type: 'arrow',   label: '🏹 Arrow' },
      { type: 'guide',   label: '🧙 Guide' },
      { type: 'wanderer', label: '🚶 Wanderer' },
    ]

    const palette = document.createElement('div')
    palette.id = 'entity-palette'
    palette.style.cssText = `
      position:fixed; bottom:12px; left:50%; transform:translateX(-50%);
      display:flex; gap:8px; z-index:9000;
      background:rgba(20,20,30,0.9); padding:10px 14px;
      border-radius:12px; border:1px solid #444;
      box-shadow:0 4px 20px rgba(0,0,0,0.5);
    `

    let selectedEntityType = null

    types.forEach(({ type, label }) => {
      const btn = document.createElement('button')
      btn.textContent = label
      btn.dataset.etype = type
      btn.style.cssText = `
        padding:7px 10px; font-size:12px; cursor:pointer;
        border-radius:8px; border:1px solid #555;
        background:#222; color:#ddd; white-space:nowrap;
      `
      btn.onclick = () => {
        selectedEntityType = (selectedEntityType === type) ? null : type
        palette.querySelectorAll('button').forEach(b => b.style.background = '#222')
        if (selectedEntityType) btn.style.background = '#2255ff'
      }
      palette.appendChild(btn)
    })

    document.body.appendChild(palette)

    // Place entity on click in world
    this.input.on('pointerdown', (pointer) => {
      if (!selectedEntityType || this.role !== 'editor') return
      if (pointer.button !== 0) return

      const worldX = pointer.worldX
      const worldY = pointer.worldY

      let config = {}
      if (selectedEntityType === 'sign') {
        const msgIndex = Math.floor(Math.random() * SIGN_MESSAGES.length)
        config.message = SIGN_MESSAGES[msgIndex]
      }
      if (selectedEntityType === 'portal') {
        config.destX = worldX + 400
        config.destY = worldY
      }

      const entityId = `entity-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`
      const entityData = {
        id:         entityId,
        type:       selectedEntityType,
        x:          worldX,
        y:          worldY,
        config
      }

      this.entityManager.create(entityData)
      this.sendPacket('entity_update', {
        entityId,
        entityType: selectedEntityType,
        x:          worldX,
        y:          worldY,
        config
      })
    })

    // Right-click to delete entity
    this.input.on('pointerdown', (pointer) => {
      if (pointer.button !== 2 || this.role !== 'editor') return
      const wx = pointer.worldX
      const wy = pointer.worldY
      for (const [id, entity] of this.entityManager.entities) {
        const dx = Math.abs(entity.x - wx)
        const dy = Math.abs(entity.y - wy)
        if (dx < 40 && dy < 40) {
          this.entityManager.destroy(id)
          this.sendPacket('entity_update', { entityId: id, deleted: true })
          break
        }
      }
    })
  }

  // =================================================
  // NETWORK
  // =================================================

  connectNetwork() {
    const url = 'wss://stickworld-server.onrender.com'
    this.socket = new WebSocket(url)

    this.socket.addEventListener('open', () => {
      this.sendPacket('join', { world: this.worldId || 'default' })
    })
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
      hat:        this.playerHat,
      glasses:    this.playerGlasses,
    })
  }

  sendPacket(type, extra = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return
    this.socket.send(JSON.stringify({
      type,
      id:    this.clientId,
      name:  this.name,
      world: this.worldId || 'default',
      ...extra
    }))
  }

  handleMessage(message) {
    let data
    try { data = JSON.parse(message) } catch { return }
    if (!data || data.id === this.clientId) return

    switch (data.type) {
      case 'join':         this.createRemotePlayer(data); break
      case 'position':     this.updateRemotePlayer(data); break
      case 'settings':     this.applyRemoteSettings(data); break
      case 'world_state':  this.applyWorldState(data); break
      case 'entity_update': this.applyEntityUpdate(data); break
      case 'entity_push':   this.entityManager.moveCrate(data.entityId, data.x, data.y); break
      case 'disconnect':   this.removeRemotePlayer(data.id); break
    }

    this.onlineText.setText(`Players Online: ${Object.keys(this.remotePlayers).length + 1}`)
  }

  applyRemoteSettings(data) {
    if (this.role === 'editor') return

    if (data.groundOffset !== undefined) {
      this.groundOffset = data.groundOffset
      this.groundY = this.scale.height - this.groundOffset
      this.groundLine.setY(this.groundY)
    }
    if (data.ufoScale !== undefined) this.ufoScale = data.ufoScale
    if (data.ufoHeight !== undefined) this.ufoHeight = data.ufoHeight
    if (data.playerSpeed !== undefined) this.playerSpeed = data.playerSpeed
    if (data.animationAdjustments !== undefined) this.animationAdjustments = data.animationAdjustments
  }

  applyWorldState(data) {
    if (!data.entities) return
    for (const e of data.entities) {
      this.entityManager.create(e)
    }
  }

  applyEntityUpdate(data) {
    if (data.deleted) {
      this.entityManager.destroy(data.entityId)
    } else {
      this.entityManager.create({
        id:     data.entityId,
        type:   data.entityType,
        x:      data.x,
        y:      data.y,
        config: data.config || {}
      })
    }
  }

  removeRemotePlayer(id) {
    const remote = this.remotePlayers[id]
    if (!remote) return
    if (remote.graphics) remote.graphics.destroy()
    if (remote.sprite)   remote.sprite.destroy()
    if (remote.label)    remote.label.destroy()
    delete this.remotePlayers[id]
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
      x:          data.x ?? DEFAULT_WORLD.spawnX,
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
      color:      data.color || 0x2255ff,
      hat:        data.hat || 'none',
      glasses:    data.glasses || false,
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
    remote.color      = data.color || remote.color || 0x2255ff
    remote.hat        = data.hat   ?? remote.hat   ?? 'none'
    remote.glasses    = data.glasses ?? remote.glasses ?? false

    remote.label.setText(remote.name)
    this.renderCharacter(remote.graphics, remote.sprite, remote, remote.color, false)
    remote.label.setPosition(remote.x, remote.y - 165)
  }
}

export const gameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'app',
  transparent: false,
  backgroundColor: '#0a0a14',
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
