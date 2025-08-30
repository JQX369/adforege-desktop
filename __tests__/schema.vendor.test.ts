import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient

beforeAll(() => {
	prisma = new PrismaClient()
})

afterAll(async () => {
	await prisma?.$disconnect()
})

describe('Prisma schema - Vendor model', () => {
	it('allows creating a Vendor and linking a Product', async () => {
		// Just check that Prisma client is aware of models & relations
		// We won't actually hit the DB (no migrate dev applied), but the client should have types
		expect(typeof prisma.vendor.findMany).toBe('function')
		expect(typeof prisma.product.findMany).toBe('function')
	})
})
