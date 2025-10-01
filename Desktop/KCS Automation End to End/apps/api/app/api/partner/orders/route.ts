import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kcs/db";
import { OrderPayloadSchema } from "@kcs/types";
import {
  parsePartnerSlug,
  validateSignature,
  ValidationError,
  UnauthorizedError,
  ConflictError
} from "../../../lib/intake";
import { createOrderFromPayload } from "../../../lib/intake/order-service";

const HMAC_HEADER = "x-kcs-signature";
const TIMESTAMP_HEADER = "x-kcs-timestamp";
const AUTH_HEADER = "authorization";
const IDEMPOTENCY_HEADER = "idempotency-key";

const getRequestBody = async (request: NextRequest) => {
  const raw = await request.text();
  return {
    raw,
    json: JSON.parse(raw)
  };
};

const badRequest = (message: string, fieldErrors?: Record<string, string[]>) =>
  NextResponse.json({ code: "invalid_request", message, field_errors: fieldErrors }, { status: 400 });

const unauthorized = (message: string) =>
  NextResponse.json({ code: "unauthorized", message }, { status: 401 });

const conflict = (message: string) =>
  NextResponse.json({ code: "conflict", message }, { status: 409 });

export const POST = async (request: NextRequest) => {
  try {
    const idempotencyKey = request.headers.get(IDEMPOTENCY_HEADER);
    if (!idempotencyKey) {
      return badRequest("Missing Idempotency-Key header");
    }

    const authHeader = request.headers.get(AUTH_HEADER);
    if (!authHeader) {
      return unauthorized("Missing Authorization header");
    }

    const partnerSlug = parsePartnerSlug(authHeader);

    const timestampHeader = request.headers.get(TIMESTAMP_HEADER);
    const signatureHeader = request.headers.get(HMAC_HEADER);

    if (!timestampHeader || !signatureHeader) {
      return unauthorized("Missing signature headers");
    }

    const { raw, json } = await getRequestBody(request);

    const partner = await prisma.partner.findFirst({
      where: { slug: partnerSlug, isActive: true }
    });

    if (!partner) {
      return unauthorized("Unknown partner");
    }

    validateSignature(partner, timestampHeader, signatureHeader, raw);

    const validation = OrderPayloadSchema.safeParse(json);
    if (!validation.success) {
      const fieldErrors: Record<string, string[]> = {};
      validation.error.issues.forEach((issue) => {
        const path = issue.path.join(".") || "root";
        fieldErrors[path] = [...(fieldErrors[path] ?? []), issue.message];
      });
      throw new ValidationError("Validation failed", fieldErrors);
    }

    const payload = validation.data;

    const existing = await prisma.order.findFirst({
      where: {
        partnerId: partner.id,
        idempotencyKey
      },
      select: { id: true }
    });

    if (existing) {
      throw new ConflictError("Duplicate request");
    }

    const order = await createOrderFromPayload(partner, idempotencyKey, payload);

    return NextResponse.json({
      order_id: order.id,
      status: "queued",
      accepted_at: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return badRequest(error.message, error.fieldErrors);
    }
    if (error instanceof UnauthorizedError) {
      return unauthorized(error.message);
    }
    if (error instanceof ConflictError) {
      return conflict(error.message);
    }
    console.error(error);
    return NextResponse.json({ code: "internal_error", message: "Unexpected error" }, { status: 500 });
  }
};

