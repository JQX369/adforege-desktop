import { prisma } from "@kcs/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const stories = await prisma.story.findMany({
      where: {
        printStatus: {
          not: null
        }
      },
      select: {
        id: true,
        orderId: true,
        printStatus: true,
        printMetadata: true,
        updatedAt: true,
        order: {
          select: {
            partnerOrderRef: true
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 50
    });

    const orders = stories.map((story) => {
      const metadata = (story.printMetadata as any) || {};

      return {
        orderId: story.orderId,
        orderNumber: story.order.partnerOrderRef || story.orderId.substring(0, 8),
        printStatus: story.printStatus,
        coverFront: metadata.coverFront || null,
        coverBack: metadata.coverBack || null,
        coverSpread: metadata.coverSpread || null,
        interiorCount: Array.isArray(metadata.interiorImages) ? metadata.interiorImages.length : 0,
        insideBookPdf: metadata.insideBookPdf || null,
        updatedAt: story.updatedAt.toISOString()
      };
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Failed to fetch print pipeline status:", error);
    return NextResponse.json({ error: "Internal server error", orders: [] }, { status: 500 });
  }
}

