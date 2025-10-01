import { z } from "zod";

export const ModelStageSchema = z.enum([
  "image_analysis_child",
  "image_analysis_support",
  "image_analysis_location",
  "brief_extraction",
  "story_profile",
  "story_outline",
  "story_draft",
  "story_revision",
  "story_polish",
  "style_main_character",
  "image_generation_main",
  "image_generation_secondary",
  "image_generation_object",
  "image_generation_location",
  "image_generation_enhance"
]);

export type ModelStage = z.infer<typeof ModelStageSchema>;

export interface LLMRequest {
  stage: ModelStage;
  prompt: string;
  inputFormat?: "text" | "json";
}

export interface LLMResponse {
  output: string;
  provider: string;
  model: string;
}

export interface LLMProvider {
  name: string;
  call(request: LLMRequest): Promise<LLMResponse>;
}

export interface ProviderConfig {
  primary: string;
  fallback?: string;
  models: Record<string, string>;
  overrides?: Record<ModelStage, { primary?: string; fallback?: string; model?: string }>;
}

export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>();

  register(provider: LLMProvider) {
    this.providers.set(provider.name, provider);
  }

  get(name: string) {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider ${name} not registered`);
    }
    return provider;
  }
}

export const createLLMClient = (registry: ProviderRegistry, config: ProviderConfig) => {
  return {
    async call(stage: ModelStage, prompt: string): Promise<LLMResponse> {
      const override = config.overrides?.[stage];
      const resolvedModel = override?.model ?? config.models[stage] ?? config.models.default;
      const executorNames = [override?.primary ?? config.primary, override?.fallback ?? config.fallback]
        .filter(Boolean) as string[];

      if (executorNames.length === 0) {
        throw new Error("No LLM providers configured");
      }

      let lastError: unknown;
      for (const name of executorNames) {
        try {
          const provider = registry.get(name);
          const response = await provider.call({ stage, prompt, inputFormat: "text" });
          return { ...response, model: resolvedModel ?? response.model };
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError ?? new Error("All providers failed");
    }
  };
};

