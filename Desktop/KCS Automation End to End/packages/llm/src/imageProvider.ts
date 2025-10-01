import { z } from "zod";

export const ImageModelStageSchema = z.enum([
  "cover_front",
  "cover_back",
  "interior_page",
  "vision_score",
  "overlay_position"
]);

export type ImageModelStage = z.infer<typeof ImageModelStageSchema>;

export interface ImageGenerationRequest {
  stage: ImageModelStage;
  prompt: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  referenceImageUrl?: string;
  /** Explicit model identifier to use (provider-specific) */
  model?: string;
}

export interface ImageGenerationResponse {
  imageUrl: string;
  provider: string;
  model: string;
  revisedPrompt?: string;
  /** Base64-encoded image data (without data URL prefix) */
  imageBase64?: string;
  /** MIME type associated with the generated image */
  mimeType?: string;
}

export interface VisionRequest {
  stage: ImageModelStage;
  imageUrls: string[];
  prompt: string;
  /** Explicit model identifier to use (provider-specific) */
  model?: string;
}

export interface VisionResponse {
  output: string;
  provider: string;
  model: string;
}

export interface ImageProvider {
  name: string;
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse>;
  analyzeImages?(request: VisionRequest): Promise<VisionResponse>;
}

export interface ImageProviderConfig {
  primary: string;
  fallback?: string;
  models: Record<string, string>;
  overrides?: Record<ImageModelStage, { primary?: string; fallback?: string; model?: string }>;
  /** Optional dashboard-controlled mapping of stage -> available model identifiers */
  availableModels?: Record<ImageModelStage | "default", string[]>;
}

export class ImageProviderRegistry {
  private providers = new Map<string, ImageProvider>();

  register(provider: ImageProvider) {
    this.providers.set(provider.name, provider);
  }

  get(name: string) {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Image provider ${name} not registered`);
    }
    return provider;
  }
}

export const createImageClient = (registry: ImageProviderRegistry, config: ImageProviderConfig) => {
  return {
    async generateImage(
      stage: ImageModelStage,
      prompt: string,
      options?: Omit<ImageGenerationRequest, "stage" | "prompt">
    ): Promise<ImageGenerationResponse> {
      const override = config.overrides?.[stage];
      const resolvedModel = override?.model ?? config.models[stage] ?? config.models.default;
      const executorNames = [override?.primary ?? config.primary, override?.fallback ?? config.fallback].filter(
        Boolean
      ) as string[];

      if (executorNames.length === 0) {
        throw new Error("No image providers configured");
      }

      let lastError: unknown;
      for (const name of executorNames) {
        try {
          const provider = registry.get(name);
          const response = await provider.generateImage({
            stage,
            prompt,
            ...options,
            model: resolvedModel
          });
          return { ...response, model: resolvedModel ?? response.model };
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError ?? new Error("All image providers failed");
    },

    async analyzeImages(stage: ImageModelStage, imageUrls: string[], prompt: string): Promise<VisionResponse> {
      const override = config.overrides?.[stage];
      const resolvedModel = override?.model ?? config.models[stage] ?? config.models.default;
      const executorNames = [override?.primary ?? config.primary, override?.fallback ?? config.fallback].filter(
        Boolean
      ) as string[];

      if (executorNames.length === 0) {
        throw new Error("No vision providers configured");
      }

      let lastError: unknown;
      for (const name of executorNames) {
        try {
          const provider = registry.get(name);
          if (!provider.analyzeImages) {
            throw new Error(`Provider ${name} does not support vision analysis`);
          }
          const response = await provider.analyzeImages({
            stage,
            imageUrls,
            prompt,
            model: resolvedModel
          });
          return { ...response, model: resolvedModel ?? response.model };
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError ?? new Error("All vision providers failed");
    }
  };
};

