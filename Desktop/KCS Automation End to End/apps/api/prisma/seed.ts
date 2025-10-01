import { prisma } from "@kcs/db";

export const seed = async () => {
  const demoPartner = await prisma.partner.upsert({
    where: { slug: "demo-partner" },
    update: {},
    create: {
      name: "Demo Partner",
      slug: "demo-partner",
      webhookSecret: "demo-secret",
      webhookUrl: "https://example.com/webhook",
      payoutSplit: 0.2
    }
  });

  await prisma.product.upsert({
    where: { partnerId_sku: { partnerId: demoPartner.id, sku: "BOOK_STD_A4" } },
    update: {},
    create: {
      partnerId: demoPartner.id,
      sku: "BOOK_STD_A4",
      trimSize: "210x297mm",
      pagesMin: 24,
      pagesMax: 48,
      iccProfile: "FOGRA39",
      price: 24.99
    }
  });

  await prisma.order.upsert({
    where: { id: "seed-order" },
    update: {},
    create: {
      id: "seed-order",
      partnerId: demoPartner.id,
      status: "pending_image_analysis",
      customerEmail: "demo@example.com",
      currency: "GBP",
      source: "iframe",
      idempotencyKey: "seed-order",
      allowUserEdit: false,
      brief: {
        create: {
          raw: {},
          readingLevel: "KS1",
          constraints: {},
          imageDescriptors: []
        }
      }
    }
  });

  console.info("Seed successful");
};

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

