import { z } from "zod";

export const OrderSource = z.enum(["webhook", "iframe"]);

export const OrderStatus = z.enum([
  "pending_image_analysis",
  "image_analysis_complete",
  "pending_brief_extraction",
  "brief_extracted",
  "story_pending",
  "story_draft_ready",
  "assets_in_progress",
  "prepress_ready",
  "covers_ready",
  "print_submitted",
  "fulfilled",
  "cancelled"
]);

export const OrderPayloadSchema = z.object({
  partner_order_ref: z.string().optional(),
  product_sku: z.string(),
  currency: z.string().length(3),
  allow_user_edit: z.boolean().default(false),
  customer: z.object({
    first_name: z.string(),
    last_name: z.string(),
    email: z.string().email(),
    phone: z.string().optional(),
    child_star_sign: z.string().optional()
  }),
  shipping: z.object({
    country: z.string().length(2),
    address_line1: z.string(),
    address_line2: z.string().optional().nullable(),
    city: z.string(),
    postal_code: z.string(),
    newsletter_opt_in: z.boolean().optional().default(false),
    story_of_the_week_opt_in: z.boolean().optional().default(false)
  }),
  brief: z.object({
    child: z.object({
      first_name: z.string(),
      age: z.number().int().min(0).max(16),
      gender: z.enum(["male", "female", "non_binary"]).default("non_binary"),
      photo_asset_id: z.string().optional()
    }),
    reading_level: z.string(),
    interests: z.string(),
    core_theme: z.string(),
    tone: z.string(),
    objective: z.string(),
    language: z.enum(["en-GB", "en-US", "fr-FR", "de-DE"]),
    sensitive_topics: z.string().optional(),
    dedication: z.string().optional(),
    creator_code: z.string().optional()
  }),
  characters: z
    .array(
      z.object({
        name: z.string(),
        relationship: z.string(),
        photo_asset_id: z.string().optional()
      })
    )
    .max(5)
    .optional(),
  locations: z
    .array(
      z.object({
        description: z.string(),
        photo_asset_id: z.string().optional()
      })
    )
    .max(3)
    .optional(),
  uploads: z
    .array(
      z.object({
        asset_id: z.string(),
        filename: z.string(),
        content_type: z.string(),
        size_bytes: z.number().int().max(10 * 1024 * 1024),
        url: z.string().url(),
        usage: z.enum(["character", "location", "other"])
      })
    )
    .optional(),
  consents: z.object({
    marketing: z.boolean().optional().default(false),
    child_image_usage: z.boolean(),
    terms_version: z.string()
  }),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export type OrderPayload = z.infer<typeof OrderPayloadSchema>;

