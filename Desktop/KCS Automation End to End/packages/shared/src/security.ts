import crypto from "node:crypto";

export const computeHmacSignature = (secret: string, payload: string) =>
  crypto.createHmac("sha256", secret).update(payload).digest("hex");

export const verifyHmacSignature = (secret: string, payload: string, signature: string) => {
  const computed = computeHmacSignature(secret, payload);
  if (computed.length !== signature.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(signature, "hex"));
  } catch (error) {
    return false;
  }
};

