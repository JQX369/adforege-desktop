import { z } from "zod";

export const CharacterDescriptorSchema = z.object({
  hair: z.string(),
  age: z.string(),
  gender: z.string(),
  height: z.string(),
  skin_colour: z.string(),
  ethnicity: z.string(),
  eye_colour: z.string(),
  face_shape: z.string(),
  nose_type: z.string(),
  body_build: z.string(),
  outfit: z.string(),
  outfit_starting: z.string().optional()
});

export type CharacterDescriptor = z.infer<typeof CharacterDescriptorSchema>;

export const LocationDescriptorSchema = z.object({
  description: z.string()
});

export type LocationDescriptor = z.infer<typeof LocationDescriptorSchema>;

export const ImageAnalysisResultSchema = z.object({
  orderId: z.string(),
  assetId: z.string().nullable(),
  role: z.enum(["child_primary", "supporting", "location"]),
  descriptor: z.union([CharacterDescriptorSchema, LocationDescriptorSchema]),
  hasImage: z.boolean(),
  rawResponse: z.string().optional(),
  faceCropMeta: z
    .object({
      attempts: z.number().int().min(0),
      success: z.boolean(),
      cropUrl: z.string().url().optional()
    })
    .optional()
});

export type ImageAnalysisResult = z.infer<typeof ImageAnalysisResultSchema>;

