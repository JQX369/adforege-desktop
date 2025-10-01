import type {
  ImageProvider,
  ImageGenerationRequest,
  ImageGenerationResponse,
  VisionRequest,
  VisionResponse
} from "./imageProvider";
import { withRetry } from "./retry";

export class OpenAIImageProvider implements ImageProvider {
  name = "openai-image";
  private apiKey: string;
  private baseUrl = "https://api.openai.com/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const startTime = Date.now();
    const modelId = request.model || "dall-e-3";
    const size = this.mapDimensionsToSize(request.width, request.height);

    const endpoint = `${this.baseUrl}/images/generations`;

    try {
      return await withRetry(async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: modelId,
          prompt: request.prompt,
          size,
          quality: "hd",
          n: 1,
          response_format: "url"
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI Image API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        throw new Error("No images returned from OpenAI API");
      }

      const imageUrl = data.data[0].url;
      const revisedPrompt = data.data[0].revised_prompt || request.prompt;

        return {
          imageUrl,
          provider: this.name,
          model: modelId,
          revisedPrompt
        };
      }, { maxAttempts: 3, initialDelayMs: 1000 });
    } catch (error) {
      throw new Error(`OpenAI image generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private mapDimensionsToSize(width?: number, height?: number): string {
    if (width && height) {
      if (width === height) return "1024x1024";
      if (width > height) return "1792x1024";
      return "1024x1792";
    }
    return "1024x1024";
  }

  async analyzeImages(request: VisionRequest): Promise<VisionResponse> {
    const startTime = Date.now();
    const modelId = request.model || "gpt-4o";
    const endpoint = `${this.baseUrl}/chat/completions`;

    const contentParts: any[] = [{ type: "text", text: request.prompt }];

    for (const imageUrl of request.imageUrls) {
      contentParts.push({
        type: "image_url",
        image_url: { url: imageUrl }
      });
    }

    try {
      return await withRetry(async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            {
              role: "user",
              content: contentParts
            }
          ],
          max_tokens: 1024,
          temperature: 0.2
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI vision API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error("No response from OpenAI vision API");
      }

      const textOutput = data.choices[0].message.content;

        return {
          output: textOutput,
          provider: this.name,
          model: modelId
        };
      }, { maxAttempts: 2, initialDelayMs: 500 });
    } catch (error) {
      throw new Error(`OpenAI vision analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

