console.log("GAME FILE LOADED")

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

    this.name =
      `Guest ${Math.floor(Math.random() * 90) + 10}`
  }

  preload() {}

  create() {
   console.log("CREATE RUNNING")
    // =================================================
    // BACKGROUND
    // =================================================

    this.ground = this.add.rectangle(
  this.scale.width / 2,
  this.groundY + 60,
  this.scale.width * 4,
  120,
  0xe8e8e8
    )
    .setOrigin(0)

    // =================================================
    // GROUND
    // =================================================

    this.groundY =
      this.scale.height - 120

    this.add.rectangle(
      this.scale.width / 2,
      this.groundY + 60,
      this.scale.width,
      120,
      0xe8e8e8
    )

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
    }

    // =================================================
    // GRAPHICS
    // =================================================

    this.playerGraphics =
      this.add.graphics()

    // =================================================
    // INPUT
    // =================================================

    this.keys =
      this.input.keyboard.addKeys({

        left:
          Phaser.Input.Keyboard.KeyCodes.A,

        right:
          Phaser.Input.Keyboard.KeyCodes.D,

        jump:
          Phaser.Input.Keyboard.KeyCodes.W,

        wave:
          Phaser.Input.Keyboard.KeyCodes.Q,

        laugh:
          Phaser.Input.Keyboard.KeyCodes.E,

        point:
          Phaser.Input.Keyboard.KeyCodes.R,
      })

    this.nameInput =
      document.getElementById('player-name')
    this.colorSelect =
      document.getElementById('player-color')

    if (this.nameInput) {
      this.nameInput.value = this.name
      this.nameInput.addEventListener(
        'change',
        () => this.handlePlayerNameChange()
      )
    }

    if (this.colorSelect) {
      this.colorSelect.value = this.playerColorName
      this.colorSelect.addEventListener(
        'change',
        () => this.handlePlayerColorChange()
      )
    }

    // =================================================
    // UI
    // =================================================

    this.nameText = this.add.text(
      this.player.x,
      this.player.y - 160,
      this.name,
      {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#111111',
      }
    )
    .setOrigin(0.5)

    this.onlineText = this.add.text(
      20,
      20,
      'Players Online: 1',
      {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#111111',
      }
    )
this.cameras.main.startFollow(
  {
    x: this.player.x,
    y: this.player.y,
  },
  true,
  0.08,
  0.08
)

this.cameras.main.setBounds(
  0,
  0,
  this.scale.width * 4,
  this.scale.height
)
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
  // DRAW CHARACTER
  // =================================================

  drawCharacter(
    graphics,
    player,
    color,
    isLocal = false
  ) {

    graphics.clear()

    graphics.lineStyle(5, color, 1)

    const x = player.x
    const feetY = player.y

    // =================================================
    // SMOOTH WALK CYCLE
    // =================================================

    const moveSpeed =
      Math.abs(player.vx)

    const targetWalkSpeed =
      moveSpeed > 0.05
        ? 0.06 + moveSpeed * 0.07
        : 0

    player.walkCycle =
      Phaser.Math.Linear(
        player.walkCycle,
        targetWalkSpeed,
        0.12
      )

    player.animTime +=
      player.walkCycle * 0.18

    const t = player.animTime

    // =================================================
    // BODY MOTION
    // =================================================

    const walkWave =
      Math.sin(t)

    const torsoBob =
      Math.abs(walkWave) *
      moveSpeed *
      2.2

    const torsoLean =
      player.vx * 1.8

    // =================================================
    // BODY
    // =================================================

    const headX =
      x + torsoLean

    const headY =
      feetY - 118 - torsoBob

    const neckY =
      feetY - 96 - torsoBob

    const chestY =
      feetY - 72 - torsoBob

    const hipY =
      feetY - 38 - torsoBob

    // =================================================
    // HEAD
    // =================================================

    graphics.strokeCircle(
      headX,
      headY,
      16
    )

    // =================================================
    // BODY
    // =================================================

    graphics.lineBetween(
      headX,
      neckY,
      x,
      hipY
    )

    // =================================================
    // IDLE
    // =================================================

    if (
      player.pose === 'idle'
    ) {

      drawIdlePose(
        graphics,
        x,
        chestY,
        hipY,
        feetY
      )
    }

    // =================================================
    // WALK
    // =================================================

    else if (
  player.pose === 'walk'
) {

  // =========================================
  // PHASE WALK SYSTEM
  // =========================================

  const walkPhase =
    (t * 0.85) % 1

  const leftSupport =
    walkPhase < 0.5

  const phase =
    leftSupport
      ? walkPhase / 0.5
      : (walkPhase - 0.5) / 0.5

  // =========================================
  // BODY WEIGHT SHIFT
  // =========================================

  const supportBlend =
  Math.sin(walkPhase * Math.PI * 2)

const supportOffset =
  supportBlend * 5

  const bodyBob =
    Math.sin(phase * Math.PI) * 4

  const torsoX =
    x + supportOffset

  const torsoY =
    neckY - bodyBob

  const hipX =
    x + supportOffset * 0.6

  const hipWalkY =
    hipY - bodyBob

  // =========================================
  // TORSO
  // =========================================

  graphics.lineBetween(
    torsoX,
    torsoY,
    hipX,
    hipWalkY
  )

  // =========================================
  // ARMS
  // =========================================

  const armSwing =
    Phaser.Math.Linear(
      -10,
      10,
      phase
    )

  const leftArm =
    leftSupport
      ? armSwing
      : -armSwing

  const rightArm =
    -leftArm

  graphics.lineBetween(
    torsoX,
    chestY,
    torsoX + leftArm,
    chestY + 18
  )

  graphics.lineBetween(
    torsoX,
    chestY,
    torsoX + rightArm,
    chestY + 18
  )

  // =========================================
  // FOOT POSITIONS
  // =========================================

  const plantedLeftX =
    hipX - 18

  const plantedRightX =
    hipX + 18

  let leftFootX
  let leftFootY

  let rightFootX
  let rightFootY

  // =========================================
  // LEFT SUPPORT
  // =========================================

  if (leftSupport) {

  leftFootX =
    plantedLeftX

  leftFootY =
    feetY

  const swingArc =
    Math.sin(
      phase * Math.PI
    )

  rightFootX =
    Phaser.Math.Linear(
      plantedLeftX - 8,
      plantedRightX + 8,
      phase
    )

  rightFootY =
    feetY -
    swingArc * 16

  rightFootX +=
    swingArc * 6
}

  // =========================================
  // RIGHT SUPPORT
  // =========================================

 else {

  rightFootX =
    plantedRightX

  rightFootY =
    feetY

  const swingArc =
    Math.sin(
      phase * Math.PI
    )

  leftFootX =
    Phaser.Math.Linear(
      plantedRightX + 8,
      plantedLeftX - 8,
      phase
    )

  leftFootY =
    feetY -
    swingArc * 16

  leftFootX -=
    swingArc * 6
}

  // =========================================
  // LEFT LEG
  // =========================================

  const leftKneeX =
  (hipX + leftFootX) * 0.5 -
  (leftSupport ? 2 : 8)

const leftKneeY =
  leftSupport
    ? hipWalkY + 30
    : hipWalkY + 22


  graphics.lineBetween(
    hipX,
    hipWalkY,
    leftKneeX,
    leftKneeY
  )

  graphics.lineBetween(
    leftKneeX,
    leftKneeY,
    leftFootX,
    leftFootY
  )

  // =========================================
  // RIGHT LEG
  // =========================================

  const rightKneeX =
  (hipX + rightFootX) * 0.5 +
  (leftSupport ? 8 : 2)

const rightKneeY =
  leftSupport
    ? hipWalkY + 22
    : hipWalkY + 30



  graphics.lineBetween(
    hipX,
    hipWalkY,
    rightKneeX,
    rightKneeY
  )

  graphics.lineBetween(
    rightKneeX,
    rightKneeY,
    rightFootX,
    rightFootY
  )

  // =========================================
  // FEET
  // =========================================

  graphics.lineBetween(
    leftFootX,
    leftFootY,
    leftFootX - 8,
    leftFootY
  )

  graphics.lineBetween(
    rightFootX,
    rightFootY,
    rightFootX + 8,
    rightFootY
  )
}

    // =================================================
    // JUMP
    // =================================================

    else if (
      player.pose === 'jump'
    ) {

      const stretch =
        Phaser.Math.Clamp(
          Math.abs(player.vy) / 4,
          0,
          1
        )

      graphics.strokeEllipse(
        x,
        headY,
        32 - stretch * 4,
        32 + stretch * 6
      )

      graphics.lineBetween(
        x,
        neckY,
        x,
        hipY + 4
      )

      graphics.lineBetween(
        x,
        chestY,
        x - 20,
        chestY - 18
      )

      graphics.lineBetween(
        x,
        chestY,
        x + 20,
        chestY - 18
      )

      graphics.lineBetween(
        x,
        hipY,
        x - 10,
        feetY - 14
      )

      graphics.lineBetween(
        x - 10,
        feetY - 14,
        x - 2,
        feetY
      )

      graphics.lineBetween(
        x,
        hipY,
        x + 10,
        feetY - 14
      )

      graphics.lineBetween(
        x + 10,
        feetY - 14,
        x + 2,
        feetY
      )

      graphics.lineBetween(
        x - 2,
        feetY,
        x - 8,
        feetY
      )

      graphics.lineBetween(
        x + 2,
        feetY,
        x + 8,
        feetY
      )
    }

    // =================================================
    // WAVE
    // =================================================

    else if (
      player.pose === 'wave'
    ) {

      const waveTime =
        t * 3.8

      const shoulderSwing =
        Math.sin(waveTime) * 4

      const elbowBend =
        18 +
        Math.sin(waveTime * 1.5) * 8

      const handSwing =
        Math.cos(waveTime * 2.2) * 16

      const bodySway =
        Math.sin(waveTime * 0.45) * 2

      const headBob =
        Math.abs(Math.sin(waveTime * 0.8)) * 2

      const waveSide =
        player.facing || 1

      const shoulderX =
        x + waveSide * (6 + shoulderSwing)

      const shoulderY =
        chestY - 4

      const elbowX =
        shoulderX + waveSide * 12

      const elbowY =
        shoulderY - 18

      const handX =
        elbowX + waveSide * handSwing

      const handY =
        elbowY -
        elbowBend

      graphics.strokeCircle(
        headX + bodySway,
        headY - headBob,
        16
      )

      graphics.lineBetween(
        headX + bodySway,
        neckY,
        x,
        hipY
      )

      graphics.lineBetween(
        shoulderX,
        shoulderY,
        elbowX,
        elbowY
      )

      graphics.lineBetween(
        elbowX,
        elbowY,
        handX,
        handY
      )

      graphics.lineBetween(
        x,
        chestY,
        x - waveSide * 18,
        chestY + 10
      )

      graphics.lineBetween(
        x - waveSide * 18,
        chestY + 10,
        x - waveSide * 10,
        chestY + 24
      )

      const legBounce =
        Math.sin(waveTime * 1.7) * 2

      graphics.lineBetween(
        x,
        hipY,
        x - 8,
        feetY + legBounce
      )

      graphics.lineBetween(
        x,
        hipY,
        x + 8,
        feetY - legBounce
      )

      graphics.lineBetween(
        x - 8,
        feetY + legBounce,
        x - 15,
        feetY + legBounce
      )

      graphics.lineBetween(
        x + 8,
        feetY - legBounce,
        x + 15,
        feetY - legBounce
      )
    }

    // =================================================
    // LAUGH
    // =================================================

    else if (
      player.pose === 'laugh'
    ) {

      const laugh =
        Math.sin(t * 9)

      const bounce =
        Math.abs(laugh) * 5

      const shoulderShake =
        laugh * 4

      const headTilt =
        laugh * 2

      graphics.strokeCircle(
        x + headTilt,
        headY - bounce,
        16
      )

      graphics.lineBetween(
        x + shoulderShake,
        neckY,
        x,
        hipY + bounce
      )

      graphics.lineBetween(
        x,
        chestY,
        x - 22,
        chestY - 10 + laugh * 2
      )

      graphics.lineBetween(
        x,
        chestY,
        x + 22,
        chestY - 10 - laugh * 2
      )

      graphics.lineBetween(
        x,
        hipY,
        x - 10,
        feetY - 8
      )

      graphics.lineBetween(
        x - 10,
        feetY - 8,
        x - 16,
        feetY
      )

      graphics.lineBetween(
        x,
        hipY,
        x + 10,
        feetY - 8
      )

      graphics.lineBetween(
        x + 10,
        feetY - 8,
        x + 16,
        feetY
      )
    }

    // =================================================
    // POINT
    // =================================================

    else if (
      player.pose === 'point'
    ) {

      const pointer =
        isLocal
          ? this.input.activePointer
          : {
              worldX:
                x +
                player.facing * 120,

              worldY:
                chestY,
            }

      const shoulderX = x
      const shoulderY = chestY

      const targetX =
        pointer.worldX

      const targetY =
        pointer.worldY

      const upperArm = 22
      const forearm = 24

      const dx =
        targetX - shoulderX

      const dy =
        targetY - shoulderY

      let dist = Math.sqrt(
        dx * dx + dy * dy
      )

      const maxReach =
        upperArm + forearm - 0.001

      dist =
        Phaser.Math.Clamp(
          dist,
          8,
          maxReach
        )

      const aimAngle =
        Math.atan2(dy, dx)

      player.pointAngle =
        Phaser.Math.Angle.RotateTo(
          player.pointAngle,
          aimAngle,
          0.25
        )

      const a = upperArm
      const b = forearm
      const c = dist

      let elbowAngle =
        Math.acos(
          Phaser.Math.Clamp(
            (
              a * a +
              c * c -
              b * b
            ) /
            (2 * a * c),
            -1,
            1
          )
        )

      const desiredSide =
        dx >= 0 ? 1 : -1

      player.elbowSide =
        Phaser.Math.Linear(
          player.elbowSide,
          desiredSide,
          0.18
        )

      if (
        Math.abs(
          player.elbowSide -
          desiredSide
        ) < 0.05
      ) {

        player.elbowSide =
          desiredSide
      }

      const shoulderAngle =
        player.pointAngle +
        elbowAngle *
          player.elbowSide

      const elbowX =
        shoulderX +
        Math.cos(
          shoulderAngle
        ) *
          upperArm

      const elbowY =
        shoulderY +
        Math.sin(
          shoulderAngle
        ) *
          upperArm

      const handX =
        elbowX +
        Math.cos(
          player.pointAngle
        ) *
          forearm

      const handY =
        elbowY +
        Math.sin(
          player.pointAngle
        ) *
          forearm

      graphics.lineBetween(
        shoulderX,
        shoulderY,
        elbowX,
        elbowY
      )

      graphics.lineBetween(
        elbowX,
        elbowY,
        handX,
        handY
      )

      graphics.lineBetween(
        x,
        chestY,
        x - 16,
        chestY + 12
      )

      graphics.lineBetween(
        x - 16,
        chestY + 12,
        x - 8,
        chestY + 26
      )

      drawStandingLegs(
        graphics,
        x,
        hipY,
        feetY
      )
    }
  }

  update(_, delta) {

    const dt = delta / 16.666

    const accel = 0.24

    const friction = 0.82

    const maxSpeed = 2

    if (this.keys.left.isDown) {

      this.player.vx -= accel * dt

      this.player.facing = -1
    }

    if (this.keys.right.isDown) {

      this.player.vx += accel * dt

      this.player.facing = 1
    }

    this.player.vx =
      Phaser.Math.Clamp(
        this.player.vx,
        -maxSpeed,
        maxSpeed
      )

    this.player.vx *= friction

    this.player.x +=
      this.player.vx * dt * 4

    this.player.x =
      Phaser.Math.Clamp(
        this.player.x,
        40,
        this.scale.width * 4 - 40
      )

    if (
      this.keys.jump.isDown &&
      this.player.grounded
    ) {

      this.player.vy = -7

      this.player.grounded = false
    }

    this.player.vy +=
      0.32 * dt

    this.player.y +=
      this.player.vy * dt * 3

    if (
      this.player.y >=
      this.groundY
    ) {

      this.player.y =
        this.groundY

      this.player.vy = 0

      this.player.grounded = true
    }

    if (this.keys.point.isDown) {

      this.player.pose = 'point'
    }

    else if (this.keys.wave.isDown) {

      this.player.pose = 'wave'
    }

    else if (this.keys.laugh.isDown) {

      this.player.pose = 'laugh'
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

    this.drawCharacter(
      this.playerGraphics,
      this.player,
      this.playerColor,
      true
    )

    this.nameText.setPosition(
      this.player.x,
      this.player.y - 160
    )
    for (const id in this.remotePlayers) {

  const remote =
    this.remotePlayers[id]

  this.drawCharacter(
    remote.graphics,
    remote,
    remote.color,
    false
  )

  remote.label.setPosition(
    remote.x,
    remote.y - 160
  )
}
  }

  connectNetwork() {

    const url =
  'wss://stickworld-server.onrender.com'
      
        
        

    
    

    
  

    this.socket = new WebSocket(url)

    this.socket.addEventListener(
      'open',
      () => {

        this.sendPacket('join')
      }
    )

    this.socket.addEventListener(
      'message',
      (event) => {

        this.handleMessage(event.data)
      }
    )
  }

  broadcastPosition() {

    this.sendPacket(
      'position',
      {

        x: this.player.x,

        y: this.player.y,

        vx: this.player.vx,

        vy: this.player.vy,

        pose: this.player.pose,

        grounded:
          this.player.grounded,

        facing:
          this.player.facing,

        animTime:
          this.player.animTime,

        pointAngle:
          this.player.pointAngle,

        name: this.name,

        color: this.playerColor,
      }
    )
  }

  sendPacket(
    type,
    extra = {}
  ) {

    if (
      !this.socket ||
      this.socket.readyState !==
        WebSocket.OPEN
    ) {
      return
    }

    this.socket.send(
      JSON.stringify({

        type,

        id: this.clientId,

        name: this.name,

        ...extra,
      })
    )
  }

  handleMessage(message) {

    let data

    try {

      data = JSON.parse(message)
    }

    catch {

      return
    }

    if (
      !data ||
      data.id === this.clientId
    ) {
      return
    }

    switch (data.type) {

      case 'join':

        this.createRemotePlayer(data)

        break

      case 'position':

        this.updateRemotePlayer(data)

        break
    }

    this.onlineText.setText(
      `Players Online: ${
        Object.keys(this.remotePlayers).length + 1
      }`
    )
  }

  handlePlayerNameChange() {
    if (!this.nameInput) {
      return
    }

    const nextName = this.nameInput.value.trim()
    if (nextName.length > 0) {
      this.name = nextName
      this.nameText.setText(this.name)
    }
  }

  handlePlayerColorChange() {
    if (!this.colorSelect) {
      return
    }

    const nextColor = this.colorSelect.value
    if (this.colorMap[nextColor]) {
      this.playerColorName = nextColor
      this.playerColor = this.colorMap[nextColor]
    }
  }

  createRemotePlayer(data) {

    if (this.remotePlayers[data.id]) {
      return
    }

    const graphics =
      this.add.graphics()

    const label =
      this.add.text(
        data.x,
        data.y - 160,
        data.name,
        {
          fontFamily: 'Arial',
          fontSize: '18px',
          color: '#111111',
        }
      )
      .setOrigin(0.5)

    this.remotePlayers[data.id] = {

      graphics,

      label,

      x: data.x ?? this.scale.width / 2,

      y: data.y ?? this.groundY,

      vx: 0,

      vy: 0,

      facing: 1,

      grounded: data.grounded ?? true,

      pose: data.pose || 'idle',

      animTime: data.animTime || 0,

      walkCycle: 0,

      pointAngle: data.pointAngle || 0,

      elbowSide: data.elbowSide || 1,

      color: data.color || 0x0066ff,

      name: data.name,
    }
  }

  updateRemotePlayer(data) {

    if (!this.remotePlayers[data.id]) {

      this.createRemotePlayer(data)
    }

    const remote =
      this.remotePlayers[data.id]

    remote.x =
      Phaser.Math.Linear(
        remote.x,
        data.x,
        0.35
      )

    const targetY =
      data.grounded
        ? this.groundY
        : data.y

    remote.y =
      Phaser.Math.Linear(
        remote.y,
        targetY,
        0.35
      )

    remote.vx =
      Phaser.Math.Linear(
        remote.vx,
        data.vx,
        0.25
      )

    remote.vy =
      Phaser.Math.Linear(
        remote.vy,
        data.vy,
        0.25
      )

    remote.pose =
      data.pose

    remote.grounded =
      data.grounded

    remote.facing =
      data.facing

    remote.animTime =
      data.animTime

    remote.pointAngle =
      data.pointAngle || 0

    remote.elbowSide =
      data.elbowSide || 1

    remote.name =
      data.name || remote.name

    remote.color =
      data.color || remote.color || 0x0066ff

    remote.label.setText(remote.name)

    this.drawCharacter(
      remote.graphics,
      remote,
      remote.color,
      false
    )

    remote.label.setPosition(
      remote.x,
      remote.y - 160
    )
  }
}

function drawStandingLegs(
  graphics,
  x,
  hipY,
  feetY
) {

  graphics.lineBetween(
    x,
    hipY,
    x - 8,
    feetY
  )

  graphics.lineBetween(
    x,
    hipY,
    x + 8,
    feetY
  )

  graphics.lineBetween(
    x - 8,
    feetY,
    x - 15,
    feetY
  )

  graphics.lineBetween(
    x + 8,
    feetY,
    x + 15,
    feetY
  )
}

function drawIdlePose(
  graphics,
  x,
  chestY,
  hipY,
  feetY
) {

  graphics.lineBetween(
    x,
    chestY,
    x - 18,
    chestY + 10
  )

  graphics.lineBetween(
    x - 18,
    chestY + 10,
    x - 10,
    chestY + 24
  )

  graphics.lineBetween(
    x,
    chestY,
    x + 18,
    chestY + 10
  )

  graphics.lineBetween(
    x + 18,
    chestY + 10,
    x + 10,
    chestY + 24
  )

  drawStandingLegs(
    graphics,
    x,
    hipY,
    feetY
  )
}
console.log("CREATING GAME")
export const gameConfig = {

  type: Phaser.AUTO,

  width: window.innerWidth,

  height: window.innerHeight,

  parent: 'app',

  backgroundColor: '#ffffff',

  physics: {

    default: 'arcade',

    arcade: {

      debug: false,
    },
  },

  scale: {

    mode: Phaser.Scale.RESIZE,

    autoCenter:
      Phaser.Scale.CENTER_BOTH,
  },

  scene: MainScene,
}
new Phaser.Game(gameConfig)