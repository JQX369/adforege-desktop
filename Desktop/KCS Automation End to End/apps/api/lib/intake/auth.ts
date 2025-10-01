import { z } from "zod";
import { computeHmacSignature, verifyHmacSignature } from "@kcs/shared";
import type { Partner } from "@prisma/client";
import { UnauthorizedError } from "./errors";

const AuthHeaderSchema = z
  .string()
  .regex(/^HMAC\s+(?<partner>[a-z0-9\-_/]+)$/i, "Invalid authorization format");

const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;

export const parsePartnerSlug = (headerValue: string) => {
  const match = AuthHeaderSchema.safeParse(headerValue);
  if (!match.success) {
    throw new UnauthorizedError(match.error.issues.map((issue) => issue.message).join(", "));
  }

  const partnerSlug = match.data.match(/^HMAC\s+(?<partner>[a-z0-9\-_/]+)/i)?.groups?.partner;
  if (!partnerSlug) {
    throw new UnauthorizedError("Partner slug missing in Authorization header");
  }

  return partnerSlug;
};

export const validateSignature = (
  partner: Partner,
  timestampHeader: string,
  signatureHeader: string,
  rawBody: string
) => {
  const timestamp = Number(timestampHeader);
  if (Number.isNaN(timestamp) || Math.abs(Date.now() - timestamp) > MAX_TIMESTAMP_DRIFT_MS) {
    throw new UnauthorizedError("Invalid or expired timestamp");
  }

  const expectedSig = computeHmacSignature(partner.webhookSecret, `${timestampHeader}.${rawBody}`);
  const providedSig = signatureHeader.replace(/^v1=/, "");

  const isValid = verifyHmacSignature(partner.webhookSecret, `${timestampHeader}.${rawBody}`, providedSig);

  if (!isValid || expectedSig !== providedSig) {
    throw new UnauthorizedError("Invalid signature");
  }
};

