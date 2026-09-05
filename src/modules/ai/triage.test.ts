/**
 * AI triage safety tests.
 *
 * These run WITHOUT an API key — that is the point. The rule is that AI is an
 * enhancement, never a dependency: with no key configured, every AI path must
 * return null quietly and the app must behave exactly as it did before.
 */
import { describe, expect, test } from "bun:test";

import { embeddingText } from "./enrich";

describe("AI is optional, never required", () => {
  test("embeddingText combines title and description deterministically", () => {
    const text = embeddingText({
      title: "Huge pothole near university gate",
      description: "Large pothole causing traffic problems.",
    });

    expect(text).toContain("Huge pothole near university gate");
    expect(text).toContain("Large pothole causing traffic problems.");
    // Same input, same embedding input — so a rerun does not produce a
    // different vector for identical text.
    expect(text).toBe(
      embeddingText({
        title: "Huge pothole near university gate",
        description: "Large pothole causing traffic problems.",
      }),
    );
  });

  test("client returns null instead of throwing when unconfigured", async () => {
    // Importing with no GEMINI_API_KEY must not throw at module load either.
    const { embed } = await import("./client");
    const { aiEnabled } = await import("@/env");

    if (!aiEnabled) {
      expect(await embed("anything")).toBeNull();
    } else {
      // With a key configured this is a live call; only assert the shape.
      const vector = await embed("Huge pothole near university gate");
      expect(vector === null || vector.length === 768).toBe(true);
    }
  }, 20_000);
});
