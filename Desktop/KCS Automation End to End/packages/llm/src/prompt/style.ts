export interface StyleProfileInput {
  stageLabel: string;
  styleText: string;
  negativePrompt: string;
  styleToken: string;
}

export const buildStylePrompt = (input: StyleProfileInput) => {
  const { stageLabel, styleText, negativePrompt, styleToken } = input;
  return `${stageLabel} style:\n${styleText}\n\nNegative prompt: ${negativePrompt}.\n:: ${styleToken}`;
};

export const DEFAULT_STYLE_TEXT =
  "A single-frame 2-D illustration in a clean, “first-chapter-book” style. ✔ Minimal smooth air-brush shading (no harsh cell-shading). ✔ Mid-brown outlines ~2–3 px wide. ✔ Flat, saturated mid-tones; shadows only one value deeper. ✔ Simplified anatomy: head ≈ 1.1 × torso width, small hands, tiny dot-pupil eyes, subtle brows and nose. ✔ Lighting: soft, even frontal fill with a hint of warm rim light. ✘ No pencil, pastel, crayon, chalk, grainy texture, heavy cross-hatching, or vignette.";

export const DEFAULT_NEGATIVE_PROMPT = "pencil, pastel, crayon, chalk, grainy, rough, cross-hatching, vignette";
export const DEFAULT_STYLE_TOKEN = "simple_soft_airbrush_cartoon";

