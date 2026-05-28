const WebSocket = require('ws')

const PORT = process.env.PORT || 3002
const wss = new WebSocket.Server({ port: PORT })

console.log(`WebSocket server running on ${PORT}`)

// Map of clientId -> { ws, worldId }
const clients = new Map()

// Map of worldId -> { entities: Map<entityId, entityData> }
const worlds = new Map()

function getWorld(worldId) {
  if (!worlds.has(worldId)) {
    const entities = new Map()
    if (worldId === 'default') {
      entities.set('npc-guide', { id: 'npc-guide', type: 'guide', x: 3700, y: 0, config: {} })
      entities.set('npc-wanderer', { id: 'npc-wanderer', type: 'wanderer', x: 4200, y: 0, config: {} })
    }
    worlds.set(worldId, { entities })
  }
  return worlds.get(worldId)
}

function broadcast(senderId, worldId, data) {
  const msg = JSON.stringify(data)
  for (const [id, info] of clients.entries()) {
    if (id !== senderId && info.worldId === worldId && info.ws.readyState === WebSocket.OPEN) {
      info.ws.send(msg)
    }
  }
}

wss.on('connection', (ws) => {

  ws.on('message', (message) => {
    let data
    try { data = JSON.parse(message) } catch { return }
    if (!data.id) return

    const worldId = data.world || 'default'

    // Register / update client
    clients.set(data.id, { ws, worldId })

    switch (data.type) {

      case 'join': {
        // Send current world state (all entities) to the joining client
        const world = getWorld(worldId)
        const entityList = Array.from(world.entities.values())
        ws.send(JSON.stringify({
          type: 'world_state',
          entities: entityList,
          worldId
        }))
        // Broadcast join to others
        broadcast(data.id, worldId, data)
        break
      }

      case 'entity_update': {
        // Editor placed/moved/deleted an entity
        const world = getWorld(worldId)
        if (data.deleted) {
          world.entities.delete(data.entityId)
        } else {
          world.entities.set(data.entityId, {
            id: data.entityId,
            type: data.entityType,
            x: data.x,
            y: data.y,
            config: data.config || {}
          })
        }
        broadcast(data.id, worldId, data)
        break
      }

      case 'entity_push': {
        // Player pushed a crate - update server state
        const world = getWorld(worldId)
        if (world.entities.has(data.entityId)) {
          const entity = world.entities.get(data.entityId)
          entity.x = data.x
          entity.y = data.y
        }
        broadcast(data.id, worldId, data)
        break
      }

      default: {
        // position, settings, and all other messages: relay to world peers
        broadcast(data.id, worldId, data)
        break
      }
    }
  })

  ws.on('close', () => {
    // Find and remove this client, broadcast disconnect
    for (const [id, info] of clients.entries()) {
      if (info.ws === ws) {
        const worldId = info.worldId
        clients.delete(id)
        // Broadcast disconnect to remaining players in this world
        broadcast(id, worldId, { type: 'disconnect', id })
        break
      }
    }
  })
})