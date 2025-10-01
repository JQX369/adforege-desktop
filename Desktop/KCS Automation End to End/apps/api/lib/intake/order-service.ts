import { prisma } from "@kcs/db";
import type { OrderPayload } from "@kcs/types";
import type { Partner } from "@prisma/client";
import { queues } from "../queues";
import { logger } from "@kcs/shared";
import { mapUploadsToAssets } from "./upload-mapper";

export const createOrderFromPayload = async (
  partner: Partner,
  idempotencyKey: string,
  payload: OrderPayload
) => {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: {
        partnerId: partner.id,
        sku: payload.product_sku
      }
    });

    const assetsToCreate = mapUploadsToAssets(payload);

    const orderRecord = await tx.order.create({
      data: {
        partnerId: partner.id,
        productId: product?.id,
        status: "pending_image_analysis",
        customerEmail: payload.customer.email,
        currency: payload.currency,
        allowUserEdit: payload.allow_user_edit,
        source: "webhook",
        idempotencyKey,
        partnerOrderRef: payload.partner_order_ref,
        brief: {
          create: {
            raw: payload,
            readingLevel: payload.brief.reading_level,
            constraints: payload.brief.sensitive_topics ? { sensitive_topics: payload.brief.sensitive_topics } : undefined
          }
        },
        assets: {
          create: assetsToCreate
        }
      },
      include: {
        brief: true
      }
    });

    const event = await tx.event.create({
      data: {
        orderId: orderRecord.id,
        type: "order.created",
        payload: {
          order_id: orderRecord.id,
          partner_id: partner.id,
          product_sku: payload.product_sku,
          allow_user_edit: payload.allow_user_edit
        }
      }
    });

    await tx.webhookOutbox.create({
      data: {
        partnerId: partner.id,
        orderId: orderRecord.id,
        eventId: event.id,
        target: partner.webhookUrl ?? "",
        payload: {
          event: "order.created",
          order_id: orderRecord.id,
          data: payload
        }
      }
    });

    await queues.imageAnalysis.add("images.analyze_uploads", { orderId: orderRecord.id });
    logger.info({ orderId: orderRecord.id }, "enqueued image analysis");

    return orderRecord;
  });
};

