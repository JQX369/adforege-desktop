/*
  Nightly price/availability refresh (stub):
  - Select recent/top products
  - Re-check availability/price (integration TODO)
  - Update lastSeenAt, availability

  Usage:
    ts-node scripts/nightly-refresh.ts
*/
import { PrismaClient, AvailabilityStatus } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  try {
    const products = await prisma.product.findMany({
      where: { status: 'APPROVED' },
      take: 500,
      orderBy: { updatedAt: 'desc' as any }
    } as any)

    const now = new Date()
    for (const p of products) {
      // TODO: call retailer APIs to get fresh price/stock; stub keeps availability as UNKNOWN if missing
      await prisma.product.update({
        where: { id: p.id },
        data: {
          lastSeenAt: now,
          availability: p.availability || AvailabilityStatus.UNKNOWN,
        }
      })
    }
    console.log(`Refreshed ${products.length} products`)
  } finally {
    await (global as any).prisma?.$disconnect?.().catch(() => {})
  }
}

main().catch((e) => { console.error(e); process.exit(1) })


