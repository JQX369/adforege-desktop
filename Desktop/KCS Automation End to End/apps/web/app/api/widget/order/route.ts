import { NextRequest, NextResponse } from "next/server";

export const POST = async (request: NextRequest) => {
  const payload = await request.json();

  // Simulate form submission to partner intake API
  return NextResponse.json({
    ok: true,
    received: payload,
    status: "queued"
  });
};

