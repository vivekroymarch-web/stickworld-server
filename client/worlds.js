// =================================================
// WORLD CONFIGURATIONS
// Each world defines background, size, ground, entities, spawn point.
// Add new worlds here by adding a new entry.
// =================================================

export const WORLDS = {
  default: {
    id: 'default',
    name: 'Stickworld',
    width: 7680,           // ~4 screens wide at 1920px
    groundOffset: 91,      // px from screen bottom
    background: 'assets/background.png',
    bgPosX: 50,
    bgPosY: 100,
    bgSize: 100,
    spawnX: 3840,          // center of world
    mushroomSpeed: 1.2,
    ufo: { x: 2000, height: 440, scale: 0.71 },
    entities: [
      { id: 'npc-guide', type: 'guide', x: 3700, y: 0, config: {} },
      { id: 'npc-wanderer', type: 'wanderer', x: 4200, y: 0, config: {} }
    ]
  }
}

export const DEFAULT_WORLD = WORLDS.default
