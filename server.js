const WebSocket = require('ws')

const PORT = process.env.PORT || 3002

const wss = new WebSocket.Server({ port: PORT })

const clients = new Map()

console.log(`WebSocket server running on ${PORT}`)

wss.on('connection', (ws) => {

  ws.on('message', (message) => {

    let data

    try {

      data = JSON.parse(message)

    } catch {

      return
    }

    if (!data.id) {
      return
    }

    clients.set(data.id, ws)

    wss.clients.forEach((client) => {

      if (
        client.readyState === WebSocket.OPEN &&
        client !== ws
      ) {

        client.send(JSON.stringify(data))
      }
    })
  })

  ws.on('close', () => {

    for (const [id, client] of clients.entries()) {

      if (client === ws) {

        clients.delete(id)

        break
      }
    }
  })
})