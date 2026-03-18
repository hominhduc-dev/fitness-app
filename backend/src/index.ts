import { app } from "./app"
import { env } from "./config/env"

const server = app.listen(env.port, () => {
  console.log(`Backend listening on http://localhost:${env.port}`)
})

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${env.port} is already in use. Stop the other backend process or set PORT to a different value.`)
    process.exit(1)
  }

  throw error
})
