import { describe, it, expect } from "vitest";
import { mapUploadsToAssets } from "../lib/intake/upload-mapper";

describe("upload mapper", () => {
  it("maps child and supporting photos", () => {
    const payload = {
      brief: {
        child: { first_name: "Lily", age: 6, gender: "female", photo_asset_id: "child" }
      },
      characters: [{ name: "Jamie", relationship: "Friend", photo_asset_id: "support" }],
      uploads: [
        { asset_id: "child", filename: "child.png", content_type: "image/png", size_bytes: 100, url: "https://example.com/child", usage: "character" },
        { asset_id: "support", filename: "support.png", content_type: "image/png", size_bytes: 100, url: "https://example.com/support", usage: "character" }
      ]
    } as const;

    const assets = mapUploadsToAssets(payload);
    expect(assets).toHaveLength(2);
    expect(assets[0].meta.role).toBe("child");
    expect(assets[1].meta.role).toBe("supporting");
  });
});

