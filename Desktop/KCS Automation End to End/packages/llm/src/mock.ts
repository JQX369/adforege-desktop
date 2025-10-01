import type { LLMProvider, LLMResponse, LLMRequest } from "./provider";

const SAMPLE_RESPONSES: Record<string, string> = {
  image_analysis_child:
    "{hair}: Two tight blonde French braids with ribbons\n{age}: Toddler, roughly three years old\n{gender}: Young girl\n{height}: About three feet tall\n{skin colour}: Light creamy complexion\n{ethnicity}: African descent with lighter skin tone\n{eye colour}: Bright blue eyes, wide-eyed\n{face shape}: Round cheeks, small face\n{nose type}: Button nose\n{body build}: Petite, slender\n{outfit}: Red sneakers, loose black jeans, oversized white t-shirt\n{outfit_starting}: Red sneakers with jeans and white tee",
  image_analysis_support:
    "{hair} Very short grey hair, receding hairline@{age} Young adult, early twenties@{gender} Female, slightly androgynous@{height} Around five feet eight inches@{skin colour} Pale with warm undertones@{ethnicity} East Asian with soft features@{eye colour} Deep green with golden flecks@{face shape} Oval face with sharp jawline@{nose type} Straight nose with narrow bridge@{body build} Lean and athletic, toned arms@{outfit} Black leather jacket, ripped blue jeans, white high-top sneakers",
  image_analysis_location:
    "Sunlit playroom with pastel walls, a plush reading nook, neatly arranged bookshelves, and family photos framed on a white mantel.",
  story_profile: "core_emotions: joyful discovery, tone_guidance: keep language gentle and rhythmic, inclusivity_notes: ensure supportive sibling dynamics.",
  story_outline: "Page 1: Introduce sibling explorers packing for a kindness mission\nPage 2: They bounce onto the rainbow tram...",
  story_draft: "Page 1: Lily and Daisy stacked treasured things into their kindness cart. Page 2: ...",
  story_critique: "1. Strengths: lively pacing. 2. Issues: tone drifts. 3. Suggestions: add gentle repetition. 4. Confirmation...",
  story_revision: "Page 1: Lily and Daisy carefully stacked...",
  story_polish: "Page 1: Lily and Daisy carefully stacked treasured things into their cart so nothing rattled. Page 2: …",
  image_generation_main: "{\"url\":\"https://mock-images.example.com/main-character.png\"}",
  image_generation_secondary: "{\"url\":\"https://mock-images.example.com/secondary-character.png\"}",
  image_generation_object: "{\"url\":\"https://mock-images.example.com/object.png\"}",
  image_generation_location: "{\"url\":\"https://mock-images.example.com/location.png\"}",
  image_generation_enhance: "Enhanced prompt"
};

export class MockLLMProvider implements LLMProvider {
  constructor(public readonly name: string) {}

  async call(request: LLMRequest): Promise<LLMResponse> {
    const sample = SAMPLE_RESPONSES[request.stage] ?? "";
    return {
      output: sample,
      provider: this.name,
      model: `${this.name}::mock`
    };
  }
}

