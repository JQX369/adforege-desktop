import { z } from "zod";

export const EventTypeSchema = z.enum([
  "order.created",
  "brief.extracted",
  "story.draft_ready",
  "scenes.ready",
  "images.generated",
  "prepress.assets_ready",
  "covers.ready",
  "print.submitted",
  "shipment.updated"
]);

export const EventPayloadSchema = z.object({
  event_id: z.string(),
  order_id: z.string(),
  partner_id: z.string(),
  type: EventTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  created_at: z.string()
});

export type EventType = z.infer<typeof EventTypeSchema>;

