import { NextResponse } from "next/server";
import { metricsRegister } from "../../../lib/metrics";
import { requireAdminSession } from "../../../lib/session";

const CACHE_TTL_SECONDS = 5;

let cachedBody: string | null = null;
let cacheExpiresAt = 0;

export const runtime = "nodejs";

export const GET = async () => {
  const session = await requireAdminSession();
  if (!session?.user?.role || session.user.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  if (cachedBody && cacheExpiresAt > now) {
    return new NextResponse(cachedBody, {
      status: 200,
      headers: {
        "content-type": metricsRegister.contentType,
        "cache-control": `private, max-age=${CACHE_TTL_SECONDS}`
      }
    });
  }

  const metrics = await metricsRegister.metrics();
  cachedBody = metrics;
  cacheExpiresAt = now + CACHE_TTL_SECONDS * 1000;

  return new NextResponse(metrics, {
    status: 200,
    headers: {
      "content-type": metricsRegister.contentType,
      "cache-control": `private, max-age=${CACHE_TTL_SECONDS}`
    }
  });
};

