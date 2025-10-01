import { describe, it, expect } from "vitest";
import { MockLLMProvider } from "../../packages/llm/src/mock";

describe("mock llm provider", () => {
  it("returns deterministic output", async () => {
    const provider = new MockLLMProvider("gpt5-mock");
    const result = await provider.call({ stage: "image_analysis_child", prompt: "" });
    expect(result.output).toContain("braids");
    expect(result.provider).toBe("gpt5-mock");
  });
});
