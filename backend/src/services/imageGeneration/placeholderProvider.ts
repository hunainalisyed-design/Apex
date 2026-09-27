import type { GeneratedImage, ImageGenerationProvider } from "./ImageGenerationProvider.js";

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

/** Splits text into at most `maxLines` lines of ~`width` characters on word boundaries; "…" marks a cut. */
export function wrap(text: string, width: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = "";
  const words = text.split(/\s+/).filter(Boolean);
  let i = 0;
  for (; i < words.length && lines.length < maxLines; i++) {
    const candidate = line ? `${line} ${words[i]}` : words[i];
    if (candidate.length > width && line) {
      lines.push(line);
      line = words[i];
    } else {
      line = candidate;
    }
  }
  const cut = i < words.length || lines.length === maxLines;
  if (lines.length < maxLines && line) lines.push(line);
  if (cut && lines.length > 0) lines[lines.length - 1] = `${lines[lines.length - 1]}…`;
  return lines;
}

/**
 * Stands in for a real image-generation vendor until one is chosen (Spec 35, Risk #1 — the
 * product owner picked "build against the interface now, connect a provider later"). It makes
 * a clearly-labeled SVG locally: no network call, no cost. Enabled only with
 * IMAGE_PROVIDER="placeholder", for development and demos.
 */
export const placeholderProvider: ImageGenerationProvider = {
  name: "placeholder",
  isPlaceholder: true,
  estimatedCostUsd: 0,

  async generate(prompt, { signal }): Promise<GeneratedImage> {
    if (signal.aborted) throw new Error("aborted");
    const lines = wrap(prompt, 70, 6)
      .map((line, i) => `<text x="80" y="${520 + i * 34}" class="p">${escapeXml(line)}</text>`)
      .join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1344" height="768" viewBox="0 0 1344 768">
<defs>
<radialGradient id="g" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#2a2f3a"/><stop offset="1" stop-color="#07080b"/></radialGradient>
<style>.t{font:700 44px sans-serif;fill:#f5f5f0}.s{font:500 22px sans-serif;fill:#fbbf24;letter-spacing:4px}.p{font:400 22px sans-serif;fill:#c7ccd2}</style>
</defs>
<rect width="1344" height="768" fill="url(#g)"/>
<ellipse cx="672" cy="360" rx="420" ry="70" fill="#000" opacity="0.45"/>
<path d="M300 330 Q420 230 620 225 Q820 220 940 300 L1050 320 Q1080 330 1070 350 L290 350 Z" fill="#3b4150" stroke="#8a93a6" stroke-width="3"/>
<circle cx="440" cy="352" r="48" fill="#11131a" stroke="#8a93a6" stroke-width="4"/>
<circle cx="900" cy="352" r="48" fill="#11131a" stroke="#8a93a6" stroke-width="4"/>
<text x="80" y="110" class="s">DEVELOPMENT PLACEHOLDER — NO IMAGE PROVIDER CONNECTED</text>
<text x="80" y="170" class="t">AI concept render goes here</text>
<text x="80" y="480" class="s">PROMPT THAT WOULD BE SENT</text>
${lines}
</svg>`;
    return { data: Buffer.from(svg, "utf8"), contentType: "image/svg+xml" };
  },
};
