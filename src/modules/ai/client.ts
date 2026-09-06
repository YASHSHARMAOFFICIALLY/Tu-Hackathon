/**
 * Gemini REST client.
 *
 * Plain `fetch` against generativelanguage.googleapis.com rather than an SDK:
 * one less dependency, one less version to track, and the request shape is
 * stable. Model ids come from env so swapping models never touches code.
 *
 * Every call here is best-effort. Callers must treat a null return as "no AI
 * this time" and carry on — a citizen reporting a hazard cannot be blocked by a
 * model provider.
 */
import { aiEnabled, env } from "@/env";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Hard ceiling per call. Triage is background work; it must not hang. */
const TIMEOUT_MS = 12_000;

async function post<T>(path: string, body: unknown): Promise<T | null> {
  if (!aiEnabled) return null;

  try {
    const response = await fetch(`${BASE}/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      // Logged, never thrown: the caller's job is to continue without AI.
      console.warn(`Gemini ${path} failed: ${response.status} ${await response.text()}`);
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.warn(`Gemini ${path} error:`, error);
    return null;
  }
}

type GenerateResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

/**
 * Runs a prompt and parses the reply as JSON.
 *
 * `responseMimeType: application/json` makes Gemini emit strict JSON, which
 * removes the usual fence-stripping guesswork. The parse is still guarded —
 * a model that returns something unexpected must degrade to null, not throw.
 */
export async function generateJson<T>(
  prompt: string,
  schema?: Record<string, unknown>,
  images: InlineImage[] = [],
): Promise<T | null> {
  const response = await post<GenerateResponse>(
    `models/${env.GEMINI_MODEL}:generateContent`,
    {
      // The prompt leads, the images follow: Gemini reads parts in order, and
      // an image handed over before the question is an image with no question.
      contents: [
        {
          parts: [
            { text: prompt },
            ...images.map((image) => ({
              inlineData: { mimeType: image.mimeType, data: image.base64 },
            })),
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        ...(schema ? { responseSchema: schema } : {}),
        // Triage is classification, not creative writing: low temperature keeps
        // the same complaint producing the same answer across demo runs.
        temperature: 0.1,
      },
    },
  );

  const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    console.warn("Gemini returned unparseable JSON:", text.slice(0, 200));
    return null;
  }
}

/** A photo travelling to the model as bytes, never as a URL for it to fetch. */
export type InlineImage = { mimeType: string; base64: string };

/** What `fetchInlineImage` will hand to the model. SVG is excluded upstream in
 *  `assertUploadable` because it is scriptable; it is excluded here too because
 *  the model cannot read it as a photograph anyway. */
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Refuse anything that would blow the request size. Our own uploads cap at 8MB
 *  per file, but a URL in the database can predate that rule or point elsewhere. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Downloads one photo and returns it as inline base64.
 *
 * The alternative is handing Gemini the URL, which makes Google fetch our blob
 * store on our behalf and only works while the URL is public. Fetching it here
 * keeps the decision ours and works for a private store later.
 *
 * Null on every failure: a dead link, a wrong type, an oversized file, a
 * timeout. A photo that cannot be read is a photo the triage does without.
 */
export async function fetchInlineImage(
  url: string,
): Promise<InlineImage | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const mimeType = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim();
    if (!IMAGE_TYPES.includes(mimeType)) return null;

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
      return null;
    }

    return { mimeType, base64: Buffer.from(bytes).toString("base64") };
  } catch (error) {
    console.warn("Could not read a photo for triage:", error);
    return null;
  }
}

type EmbedResponse = { embedding?: { values?: number[] } };

/** Embeds one piece of text. Returns null when AI is off or the call fails. */
export async function embed(text: string): Promise<number[] | null> {
  const response = await post<EmbedResponse>(
    `models/${env.GEMINI_EMBEDDING_MODEL}:embedContent`,
    {
      model: `models/${env.GEMINI_EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      // Duplicate detection compares stored documents against a new one, so
      // both sides are embedded the same way.
      taskType: "SEMANTIC_SIMILARITY",
      // Matches the vector(768) column. Newer models default to more; this
      // truncates them so the schema does not have to change.
      outputDimensionality: 768,
    },
  );

  const values = response?.embedding?.values;
  return values && values.length === 768 ? values : null;
}
