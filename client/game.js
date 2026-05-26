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
    this.load.spritesheet(
  'stickman-idle-sheet',
  'assets/stickman/stickman_idle_sheet.png',
  {
    frameWidth: SPRITE_FRAME_SIZE,
    frameHeight: SPRITE_FRAME_SIZE
  }
)

this.load.spritesheet(
  'stickman-jump-sheet',
  'assets/stickman/stickman_jump_sheet.png',
  {
    frameWidth: SPRITE_FRAME_SIZE,
    frameHeight: SPRITE_FRAME_SIZE
  }
)

this.load.spritesheet(
  'stickman-heavy-laugh-sheet',
  'assets/stickman/stickman_heavy_laugh_sheet.png',
  {
    frameWidth: SPRITE_FRAME_SIZE,
    frameHeight: SPRITE_FRAME_SIZE
  }
)

this.load.spritesheet(
  'stickman-angry-sheet',
  'assets/stickman/stickman_angry_sheet.png',
  {
    frameWidth: SPRITE_FRAME_SIZE,
    frameHeight: SPRITE_FRAME_SIZE
  }
)

this.load.spritesheet(
  'stickman-moderately-angry-sheet',
  'assets/stickman/stickman_moderately_angry_sheet.png',
  {
    frameWidth: SPRITE_FRAME_SIZE,
    frameHeight: SPRITE_FRAME_SIZE
  }
)
this.load.spritesheet(
  'stickman-walk-sheet',
  'assets/stickman/stickman_walk_sheet.png',
  {
    frameWidth: SPRITE_FRAME_SIZE,
    frameHeight: SPRITE_FRAME_SIZE
  }
)

this.load.spritesheet(
  'stickman-laugh-sheet',
  'assets/stickman/stickman_laugh_sheet.png',
  {
    frameWidth: SPRITE_FRAME_SIZE,
    frameHeight: SPRITE_FRAME_SIZE
  }
)

this.load.spritesheet(
  'stickman-cry-sheet',
  'assets/stickman/stickman_cry_sheet.png',
  {
    frameWidth: SPRITE_FRAME_SIZE,
    frameHeight: SPRITE_FRAME_SIZE
  }
)
  }

  create() {
    console.log("CREATE RUNNING")
    this.game.canvas.style.imageRendering =
  'pixelated'

    this.groundY = this.scale.height - 120

    // =================================================
    // BACKGROUND
    // =================================================

    this.add.rectangle(
      0, 0,
      5000,
      this.scale.height,
      0xfafafa
    ).setOrigin(0)

    // =================================================
    // GROUND
    // =================================================

    this.add.rectangle(
      0,
      this.groundY,
      5000,
      120,
      0xe8e8e8
    ).setOrigin(0)

    this.add.rectangle(
      0,
      this.groundY,
      5000,
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
      
      laugh: Phaser.Input.Keyboard.KeyCodes.E,
      point: Phaser.Input.Keyboard.KeyCodes.R,
      cry:   Phaser.Input.Keyboard.KeyCodes.F,
      run:   Phaser.Input.Keyboard.KeyCodes.SHIFT,
      heavyLaugh:
  Phaser.Input.Keyboard.KeyCodes.Z,

angry:
  Phaser.Input.Keyboard.KeyCodes.X,

moderatelyAngry:
  Phaser.Input.Keyboard.KeyCodes.C,
    })

    this.nameInput   = document.getElementById('player-name')
    


    if (this.nameInput) {
      this.nameInput.value = this.name
      this.nameInput.addEventListener('change', () => this.handlePlayerNameChange())
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
      'A/D move · W jump · E laugh · Z heavy laugh · F cry · X angry · C moderate angry · R point',
      { fontFamily: 'Arial', fontSize: '13px', color: '#888888' }
    ).setScrollFactor(0)

    this.cameras.main.startFollow(
      { x: this.player.x, y: this.player.y },
      true, 0.08, 0.08
    )
    this.cameras.main.setBounds(0, 0, 5000, this.scale.height)

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
  // =================================================
// SPRITE CREATION
// =================================================

createCharacterSprite() {

  return this.add.sprite(
    0,
    0,
    'stickman-idle-sheet'
  )
  .setOrigin(
    0.5,
    SPRITE_FEET_Y / SPRITE_FRAME_SIZE
  )
  .setScale(STICKMAN_SPRITE_SCALE)
  .setVisible(false)
}

// =================================================
// SPRITE ANIMATIONS
// =================================================

createSpriteAnimations() {

  const specs = [

    {
      key: 'stickman-idle',
      sheet: 'stickman-idle-sheet',
      frames: 16,
      frameRate: 8
    },

    {
      key: 'stickman-walk',
      sheet: 'stickman-walk-sheet',
      frames: 16,
      frameRate: 14
    },

    {
      key: 'stickman-jump',
      sheet: 'stickman-jump-sheet',
      frames: 16,
      frameRate: 10
    },

    {
      key: 'stickman-laugh',
      sheet: 'stickman-laugh-sheet',
      frames: 16,
      frameRate: 12
    },

    {
      key: 'stickman-heavy_laugh',
      sheet: 'stickman-heavy-laugh-sheet',
      frames: 16,
      frameRate: 14
    },

    {
      key: 'stickman-cry',
      sheet: 'stickman-cry-sheet',
      frames: 16,
      frameRate: 9
    },

    {
      key: 'stickman-angry',
      sheet: 'stickman-angry-sheet',
      frames: 16,
      frameRate: 8
    },

    {
      key: 'stickman-moderately_angry',
      sheet: 'stickman-moderately-angry-sheet',
      frames: 16,
      frameRate: 8
    }
  ]

  specs.forEach(spec => {

    if (this.anims.exists(spec.key)) {
      return
    }

    this.anims.create({

      key: spec.key,

      frames: this.anims.generateFrameNumbers(
        spec.sheet,
        {
          start: 0,
          end: spec.frames - 1
        }
      ),

      frameRate: spec.frameRate,

      repeat: -1
    })
  })
}

// =================================================
// RENDER CHARACTER
// =================================================

renderCharacter(
  graphics,
  sprite,
  player,
  color,
  isLocal = false
) {

  if (SPRITE_POSES.has(player.pose)) {

    this.drawSpriteCharacter(
      graphics,
      sprite,
      player,
      color
    )

    return
  }

  sprite.setVisible(false)

  this.drawCharacter(
    graphics,
    player,
    color,
    isLocal
  )
}

// =================================================
// DRAW SPRITE CHARACTER
// =================================================

drawSpriteCharacter(
  graphics,
  sprite,
  player,
  color
) {

  graphics.clear()

  const poseMap = {

    idle: 'stickman-idle',

    walk: 'stickman-walk',

    jump: 'stickman-jump',

    laugh: 'stickman-laugh',

    heavy_laugh: 'stickman-heavy_laugh',

    cry: 'stickman-cry',

    angry: 'stickman-angry',

    moderately_angry:
      'stickman-moderately_angry',
  }

  const key = poseMap[player.pose]

  let scale = STICKMAN_SPRITE_SCALE

if (
  player.pose === 'jump' ||
  player.pose === 'laugh' ||
  player.pose === 'heavy_laugh' ||
  player.pose === 'cry' ||
  player.pose === 'angry' ||
  player.pose === 'moderately_angry'
) {
  scale = 0.8
}

let offsetY = 0

if (
  player.pose === 'laugh' ||
  player.pose === 'heavy_laugh' ||
  player.pose === 'angry' ||
  player.pose === 'moderately_angry'
) {
  offsetY = 40
}

sprite
  .setVisible(true)
  .setPosition(
    player.x,
    player.y + offsetY
  )
  .setTint()
  .setScale(
    (player.facing || 1) * scale,
    scale
  )

  if (
    sprite.anims.currentAnim?.key !==
    key
  ) {
    sprite.play(key)
  }

  if (player.pose === 'walk') {

  sprite.anims.timeScale =
    Phaser.Math.Clamp(
      Math.abs(player.vx) / 1.5,
      0.65,
      1.1
    )
}

else {

  sprite.anims.timeScale = 1
}

  if (player.pose === 'cry') {
    this.drawSpriteCryTears(
      graphics,
      player
    )
  }
}

// =================================================
// SPRITE CRY TEARS
// =================================================

drawSpriteCryTears(
  graphics,
  player
) {

  const phase =
    (this.time.now / 900) % 1

  const mirror =
    player.facing || 1

  const headX =
    player.x +
    mirror *
    8 *
    STICKMAN_SPRITE_SCALE

  const headY =
    player.y -
    127 *
    STICKMAN_SPRITE_SCALE

  graphics.fillStyle(
    0x4aa3ff,
    0.88
  )

  for (let i = 0; i < 2; i++) {

    const fall =
      (phase + i * 0.5) % 1

    const tearX =
      headX +
      mirror *
      (i === 0 ? -7 : 7) *
      STICKMAN_SPRITE_SCALE

    const tearY =
      headY +
      (14 + fall * 52) *
      STICKMAN_SPRITE_SCALE

    const radius =
      Math.max(
        1,
        3.5 - fall * 2.4
      )

    graphics.fillCircle(
      tearX,
      tearY,
      radius
    )
  }
}
  // =================================================
  // IDLE
  // =================================================

  

  // =================================================
  // WALK — 4-phase gait with full IK legs
  // =================================================


  // =================================================
  // RUN — aggressive lean, high knees, pumping arms
  // =================================================


  // =================================================
  // JUMP — rising / peak / falling states
  // =================================================

  

  // =================================================
  // WAVE — 3-segment arm with wrist snap
  // =================================================

  // =================================================
  // LAUGH — doubled-over, hands on knees
  // =================================================



  // =================================================
  // CRY — hunched, bowed head, falling tears
  // =================================================



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

    const WORLD_WIDTH = 5000
   this.player.x += this.player.vx * dt * 4

this.player.x = Phaser.Math.Clamp(
  this.player.x,
  40,
  5000 - 40
)
  


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
}



else if (this.keys.heavyLaugh.isDown) {

  this.player.pose = 'heavy_laugh'
}

else if (this.keys.laugh.isDown) {

  this.player.pose = 'laugh'
}

else if (this.keys.cry.isDown) {

  this.player.pose = 'cry'
}

else if (this.keys.angry.isDown) {

  this.player.pose = 'angry'
}

else if (
  this.keys.moderatelyAngry.isDown
) {

  this.player.pose =
    'moderately_angry'
}

else if (!this.player.grounded) {

  this.player.pose = 'jump'
}

else if (
  Math.abs(this.player.vx) > 0.15
) {

  this.player.pose = 'walk'
}

else {

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
      elbowSide:  data.elbowSide || 1,
      
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
