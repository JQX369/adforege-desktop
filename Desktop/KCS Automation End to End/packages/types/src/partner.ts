import { z } from "zod";

export const PartnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  theme: z.record(z.string(), z.unknown()).optional(),
  webhook_url: z.string().url().nullable(),
  webhook_secret: z.string(),
  email_templates_cfg: z.record(z.string(), z.unknown()).optional(),
  payout_split: z.number().min(0).max(1),
  is_active: z.boolean()
});

export type Partner = z.infer<typeof PartnerSchema>;

