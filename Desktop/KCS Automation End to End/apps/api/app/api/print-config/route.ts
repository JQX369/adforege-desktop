import { prisma } from "@kcs/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get("partnerId");
    const readingAge = searchParams.get("readingAge");

    const where: any = {};

    if (partnerId) {
      where.partnerId = partnerId;
    } else {
      where.partnerId = null; // Global defaults only
    }

    if (readingAge) {
      where.readingAge = readingAge;
    }

    const configs = await prisma.printConfig.findMany({
      where,
      orderBy: {
        readingAge: "asc"
      }
    });

    return NextResponse.json({ configs });
  } catch (error) {
    console.error("Failed to fetch print configs:", error);
    return NextResponse.json({ error: "Internal server error", configs: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const config = await prisma.printConfig.create({
      data: {
        partnerId: body.partnerId || null,
        name: body.name,
        isDefault: body.isDefault ?? false,
        readingAge: body.readingAge,
        fontSize: body.fontSize,
        lineSpacing: body.lineSpacing,
        fontFamily: body.fontFamily,
        textColor: body.textColor || "#000000",
        textWidthPercent: body.textWidthPercent ?? 80,
        borderPercent: body.borderPercent ?? 5.0,
        maxWords: body.maxWords,
        overlayPreferences: body.overlayPreferences || {},
        imageModelPreferences: body.imageModelPreferences || {},
        iccProfilePath: body.iccProfilePath,
        bleedPercent: body.bleedPercent ?? 3.5,
        safeMarginMm: body.safeMarginMm ?? 6.0
      }
    });

    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    console.error("Failed to create print config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Config ID required" }, { status: 400 });
    }

    const config = await prisma.printConfig.update({
      where: { id },
      data: updates
    });

    return NextResponse.json({ config });
  } catch (error) {
    console.error("Failed to update print config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Config ID required" }, { status: 400 });
    }

    await prisma.printConfig.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete print config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

