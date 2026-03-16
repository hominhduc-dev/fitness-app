import { PrismaClient } from "@prisma/client"

import { env } from "../config/env"

const globalForPrisma = globalThis as {
  prisma?: PrismaClient
}

function createPrismaClient() {
  return new PrismaClient({
    log: env.nodeEnv === "development" ? ["error", "warn"] : ["error"],
  })
}

const prisma = env.databaseUrl ? (globalForPrisma.prisma ?? createPrismaClient()) : null

if (env.nodeEnv !== "production" && prisma) {
  globalForPrisma.prisma = prisma
}

export { prisma }
