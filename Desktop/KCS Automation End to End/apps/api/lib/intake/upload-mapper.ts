import type { OrderPayload } from "@kcs/types";

type AssetCreateInput = {
  type: string;
  url: string;
  meta: Record<string, unknown>;
  colorSpace?: string | null;
  dpi?: number | null;
};

export const mapUploadsToAssets = (payload: OrderPayload): AssetCreateInput[] => {
  const uploads = new Map(
    (payload.uploads ?? []).map((upload) => [upload.asset_id, upload])
  );

  const assets: AssetCreateInput[] = [];

  const childPhotoId = payload.brief.child.photo_asset_id;
  if (childPhotoId) {
    const upload = uploads.get(childPhotoId);
    if (upload) {
      assets.push({
        type: "image",
        url: upload.url,
        meta: {
          role: "child",
          name: payload.brief.child.first_name,
          age: payload.brief.child.age,
          gender: payload.brief.child.gender,
          starting_outfit: true,
          usage: upload.usage,
          filename: upload.filename
        }
      });
    }
  }

  (payload.characters ?? []).forEach((character, index) => {
    if (!character.photo_asset_id) {
      return;
    }
    const upload = uploads.get(character.photo_asset_id);
    if (!upload) {
      return;
    }
    assets.push({
      type: "image",
      url: upload.url,
      meta: {
        role: "supporting",
        ordinal: index,
        name: character.name,
        relationship: character.relationship,
        starting_outfit: true,
        usage: upload.usage,
        filename: upload.filename
      }
    });
  });

  (payload.locations ?? []).forEach((location, index) => {
    if (!location.photo_asset_id) {
      return;
    }
    const upload = uploads.get(location.photo_asset_id);
    if (!upload) {
      return;
    }
    assets.push({
      type: "image",
      url: upload.url,
      meta: {
        role: "location",
        ordinal: index,
        description: location.description,
        usage: upload.usage,
        filename: upload.filename
      }
    });
  });

  return assets;
};

