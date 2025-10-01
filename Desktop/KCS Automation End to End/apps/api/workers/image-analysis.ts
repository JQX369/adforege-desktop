import { Worker } from "bullmq";
import { prisma } from "@kcs/db";
import { queues } from "../lib/queues";
import { ProviderRegistry, createLLMClient, ModelStage, MockLLMProvider } from "@kcs/llm";
import { CharacterDescriptorSchema, LocationDescriptorSchema } from "@kcs/types";
import { attemptFaceCrop } from "@kcs/shared";
import { logger } from "@kcs/shared";

const registry = new ProviderRegistry();
registry.register(new MockLLMProvider("gpt5-mock"));
registry.register(new MockLLMProvider("gemini-mock"));

interface ImageAnalysisJobData {
  orderId: string;
}

const llmClient = createLLMClient(registry, {
  primary: "gpt5-mock",
  fallback: "gemini-mock",
  models: {
    default: "mock",
    image_analysis_child: "mock",
    image_analysis_support: "mock",
    image_analysis_location: "mock"
  }
});

const MAX_RETRIES = 2;

const parseCharacterResponse = (response: string) => {
  const lines = response
    .split(/\n|@/)
    .map((line) => line.trim())
    .filter(Boolean);

  const record: Record<string, string> = {};
  for (const line of lines) {
    const [key, ...rest] = line.split(/[:}]/).map((part) => part.trim());
    if (key && rest.length) {
      const value = rest.join("").replace(/^{|}$/g, "").trim();
      if (value) {
        record[key.replace(/[{}]/g, "")] = value;
      }
    }
  }
  return CharacterDescriptorSchema.parse(record);
};

const parseLocationResponse = (response: string) => {
  return LocationDescriptorSchema.parse({ description: response.trim() });
};

const processAsset = async (
  orderId: string,
  assetId: string | null,
  role: "child_primary" | "supporting" | "location",
  prompt: string,
  stage: ModelStage,
  hasImage: boolean
) => {
  let lastError: unknown;
  let faceMeta;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await llmClient.call(stage, prompt);
      const descriptor =
        role === "location" ? parseLocationResponse(response.output) : parseCharacterResponse(response.output);

      const audit = await prisma.imageAnalysisAudit.create({
        data: {
          orderId,
          assetId: assetId ?? undefined,
          role,
          descriptor,
          rawResponse: response.output,
          provider: response.provider,
          faceCropMeta: faceMeta
        }
      });

      return { audit, descriptor };
    } catch (error) {
      lastError = error;
      if (hasImage) {
        const asset = assetId
          ? await prisma.asset.findUnique({ where: { id: assetId } })
          : null;
        if (asset?.url) {
          faceMeta = await attemptFaceCrop(asset.url);
        }
      }
    }
  }

  throw lastError ?? new Error("Image analysis failed");
};

interface AssetWithMeta {
  id: string;
  type: string;
  url: string;
  meta: Record<string, unknown> & {
    role?: string;
    name?: string;
    relationship?: string;
    description?: string;
  };
}

interface OrderHydrated {
  id: string;
  brief?: {
    raw?: {
      brief?: {
        child?: {
          first_name?: string;
          gender?: string;
        };
        interests?: string;
        additional_details?: string;
      };
    };
  };
  assets: AssetWithMeta[];
}

const buildChildPrompt = (order: OrderHydrated) => {
  const childInfo = order.brief?.raw?.brief?.child;
  const description = order.brief?.raw?.brief?.interests ?? "";
  const overrides = order.brief?.raw?.brief?.additional_details ?? "";
  return `Main characrer prompt for detail extraction\nThis child is a ${childInfo?.gender ?? "child"} named ${
    childInfo?.first_name ?? "the child"
  }.\nClient description: ${description}\nAdditional overrides: ${overrides}`;
};

const buildSupportingPrompt = (asset: AssetWithMeta) => {
  const description = asset.meta.description ?? "";
  const name = asset.meta.name ?? "the character";
  return `Supporting character description prompt\nClient description: ${description}\nCharacter name: ${name}`;
};

export const imageAnalysisWorker = new Worker<ImageAnalysisJobData>(
  "images.analyze_uploads",
  async (job) => {
    const { orderId } = job.data;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        brief: true,
        assets: true
      }
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    const descriptors: Array<{
      role: "child_primary" | "supporting" | "location";
      source_asset_id: string | null;
      has_image: boolean;
      descriptor: unknown;
    }> = [];

    const childAsset = order.assets.find((asset) => asset.type === "image" && asset.meta?.role === "child");

    if (childAsset) {
      const { descriptor } = await processAsset(orderId, childAsset.id, "child_primary", buildChildPrompt(order), "image_analysis_child", true);
      descriptors.push({
        role: "child_primary",
        source_asset_id: childAsset.id,
        has_image: true,
        descriptor
      });
    } else {
      // No child image provided
      const { descriptor } = await processAsset(orderId, null, "child_primary", buildChildPrompt(order), "image_analysis_child", false);
      descriptors.push({
        role: "child_primary",
        source_asset_id: null,
        has_image: false,
        descriptor
      });
    }

    const supportingAssets = order.assets.filter((asset) => asset.meta?.role === "supporting");

    for (const asset of supportingAssets) {
      const prompt = buildSupportingPrompt(asset);
      const { descriptor } = await processAsset(orderId, asset.id, "supporting", prompt, "image_analysis_support", true);
      descriptors.push({
        role: "supporting",
        source_asset_id: asset.id,
        has_image: true,
        descriptor
      });
    }

    const locationAsset = order.assets.find((asset) => asset.meta?.role === "location");
    const locationPrompt = `Describe this photo in detail (not the camera type etc - just what's in the frame)
- Just output the description`;

    if (locationAsset) {
      const { descriptor } = await processAsset(orderId, locationAsset.id, "location", locationPrompt, "image_analysis_location", true);
      descriptors.push({
        role: "location",
        source_asset_id: locationAsset.id,
        has_image: true,
        descriptor
      });
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { status: "image_analysis_complete" }
    });

    await prisma.orderBrief.update({
      where: { orderId },
      data: {
        imageDescriptors: descriptors
      }
    });

    await prisma.event.create({
      data: {
        orderId,
        type: "images.uploads_analyzed",
        payload: {
          descriptors_count: descriptors.length
        }
      }
    });

    logger.info({ orderId, descriptors_count: descriptors.length }, "images.uploads_analyzed");

    await queues.storyAssetPlan.add("story.asset_plan", { orderId });
  },
  { connection: queues.imageAnalysis.client.opts.connection as { host: string; port: number; password?: string } }
);

