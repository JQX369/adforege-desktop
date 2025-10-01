import type {
  ImageProvider,
  ImageGenerationRequest,
  ImageGenerationResponse,
  VisionRequest,
  VisionResponse
} from "./imageProvider";
import { withRetry } from "./retry";

export class GeminiImageProvider implements ImageProvider {
  name = "gemini-flash";
  private apiKey: string;
  private baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const startTime = Date.now();
    const modelId = request.model || "imagen-3-fast-001";
    const aspectRatio = request.aspectRatio || "1:1";
    
    const endpoint = `${this.baseUrl}/models/${modelId}:generateImage?key=${this.apiKey}`;

    try {
      return await withRetry(async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: request.prompt,
          config: {
            aspectRatio,
            numberOfImages: 1,
            outputOptions: {
              mimeType: "image/png"
            }
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini Imagen API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.generatedImages || data.generatedImages.length === 0) {
        throw new Error("No images returned from Gemini Imagen API");
      }

      const imageBase64 = data.generatedImages[0].image;

        return {
          imageUrl: "", // Will be filled by worker after upload
          provider: this.name,
          model: modelId,
          revisedPrompt: data.generatedImages[0].raiFilteredReason || request.prompt,
          imageBase64,
          mimeType: "image/png"
        };
      }, { maxAttempts: 3, initialDelayMs: 1000 });
    } catch (error) {
      throw new Error(`Gemini image generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async analyzeImages(request: VisionRequest): Promise<VisionResponse> {
    const startTime = Date.now();
    const modelId = request.model || "gemini-2.5-flash-002";
    const endpoint = `${this.baseUrl}/models/${modelId}:generateContent?key=${this.apiKey}`;

    try {
      return await withRetry(async () => {
      const imageParts = await Promise.all(
        request.imageUrls.map(async (url) => {
          const imageResponse = await fetch(url);
          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image from ${url}`);
          }
          const arrayBuffer = await imageResponse.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          return {
            inlineData: {
              mimeType: "image/png",
              data: base64
            }
          };
        })
      );

      const parts = [{ text: request.prompt }, ...imageParts];

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini vision API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error("No response from Gemini vision API");
      }

      const textOutput = data.candidates[0].content.parts
        .filter((part: any) => part.text)
        .map((part: any) => part.text)
        .join("\n");

        return {
          output: textOutput,
          provider: this.name,
          model: modelId
        };
      }, { maxAttempts: 2, initialDelayMs: 500 });
    } catch (error) {
      throw new Error(`Gemini vision analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

