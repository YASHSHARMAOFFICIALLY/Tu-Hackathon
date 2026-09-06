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

/**
 * `post`, but reporting the HTTP status so a caller can tell "this model is
 * rate-limited" from "this request is wrong". `post` stays as it is because
 * embedding has nothing to fall back to.
 */
async function postDetailed<T>(
  path: string,
  body: unknown,
): Promise<{ data: T | null; status: number }> {
  if (!aiEnabled) return { data: null, status: 0 };

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
      const detail = await response.text();
      console.warn(`Gemini ${path} failed: ${response.status} ${detail.slice(0, 200)}`);
      return { data: null, status: response.status };
    }

    return { data: (await response.json()) as T, status: response.status };
  } catch (error) {
    console.warn(`Gemini ${path} error:`, error);
    return { data: null, status: 0 };
  }
}

type GenerateResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

/**
 * The models to try, in order.
 *
 * Every model carries its own free-tier bucket, and that bucket is small: the
 * quota metric is `generate_content_free_tier_requests` with a limit of 20, and
 * a single afternoon of backfilling exhausts it. When it does, the API answers
 * 429 and the app silently loses triage and the copilot, which is survivable on
 * an ordinary day and not survivable during a demo.
 *
 * So a 429 or a 404 moves to the next model rather than giving up. 404 is in
 * that list because model ids retire: `gemini-2.0-flash` and
 * `text-embedding-004` were both already gone the first time a key was
 * configured here, and `gemini-2.5-flash-lite` answers 404 for this project.
 * Any other failure stops the chain, because a malformed request will be
 * malformed for every model and trying five of them just costs five calls.
 */
function modelChain(): string[] {
  const extra = (process.env.GEMINI_MODEL_FALLBACKS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  const chain = [
    env.GEMINI_MODEL,
    ...(extra.length > 0
      ? extra
      : ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-2.5-flash", "gemini-flash-latest"]),
  ];

  // Preserve order, drop repeats: the primary usually appears in the defaults.
  return [...new Set(chain)];
}

/** Tries each model in turn, moving on only when the model itself is the
 *  problem (rate-limited or gone). Returns null when every one is exhausted. */
async function generateWithFallback(
  body: unknown,
): Promise<GenerateResponse | null> {
  if (!aiEnabled) return null;

  for (const model of modelChain()) {
    const outcome = await postDetailed<GenerateResponse>(
      `models/${model}:generateContent`,
      body,
    );
    if (outcome.data) return outcome.data;
    if (outcome.status !== 429 && outcome.status !== 404) return null;
    console.warn(`Gemini ${model} unavailable (${outcome.status}); trying the next model.`);
  }

  console.warn("Every Gemini model in the chain is rate-limited or missing.");
  return null;
}

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
  const response = await generateWithFallback({
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
  });

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
