import { PrismaClient } from '@prisma/client'
import { dbManager } from './database'

type GlobalPrisma = typeof globalThis & {
  prisma?: PrismaClient
}

const globalForPrisma = globalThis as GlobalPrisma

// Use the optimized database connection manager
export const prisma = globalForPrisma.prisma ?? dbManager.getClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
