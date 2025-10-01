import { prisma } from "@kcs/db";
import { queues } from "../queues";

export const fetchRecentOrders = async (limit = 20) => {
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      brief: true,
      assets: true
    }
  });
};

export const fetchPackagingSummaries = async () => {
  const stories = await prisma.story.findMany({
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      orderId: true,
      status: true,
      assetPlan: true,
      updatedAt: true,
      order: {
        select: {
          customerEmail: true,
          partner: { select: { name: true } }
        }
      }
    }
  });

  return stories.map((story) => ({
    orderId: story.orderId,
    partnerName: story.order?.partner?.name ?? "Unknown",
    customerEmail: story.order?.customerEmail,
    status: story.status,
    packagedLinks: story.assetPlan?.packagedLinks,
    updatedAt: story.updatedAt
  }));
};

export const fetchQueueStats = async () => {
  const queueNames = ["story.assets", "story.packaging", "story.prompts", "story.focus"] as const;

  const stats = [] as Array<{ name: string; waiting: number; active: number; completed: number; failed: number }>;

  for (const name of queueNames) {
    const queue = queues[name];
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount()
    ]);

    stats.push({ name, waiting, active, completed, failed });
  }

  return stats;
};

