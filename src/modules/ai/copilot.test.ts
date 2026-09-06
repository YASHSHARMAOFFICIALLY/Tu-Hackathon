/**
 * Copilot output guards.
 *
 * `toPlan` is the boundary between a model's reply and an officer's screen. A
 * response schema constrains the shape and does not guarantee it, so every way
 * a reply can be useless has to end as null rather than as an empty numbered
 * list.
 */
import { describe, expect, test } from "bun:test";

import { toPlan } from "./copilot";

const GOOD = {
  steps: ["Inspect the road surface.", "Place warning signage."],
  citizenUpdate: "Your report has been accepted and an inspection is arranged.",
};

describe("toPlan", () => {
  test("passes a well-formed plan through, trimmed", () => {
    const plan = toPlan({ ...GOOD, steps: ["  Inspect the road surface.  "] });
    expect(plan?.steps).toEqual(["Inspect the road surface."]);
    expect(plan?.citizenUpdate).toBe(GOOD.citizenUpdate);
  });

  test("null in, null out", () => {
    expect(toPlan(null)).toBeNull();
  });

  test("a plan with no usable step is no plan", () => {
    expect(toPlan({ steps: [], citizenUpdate: GOOD.citizenUpdate })).toBeNull();
    expect(toPlan({ steps: ["", "   "], citizenUpdate: GOOD.citizenUpdate })).toBeNull();
    expect(toPlan({ steps: "not an array", citizenUpdate: GOOD.citizenUpdate })).toBeNull();
  });

  test("a plan with no citizen update is no plan", () => {
    expect(toPlan({ steps: GOOD.steps, citizenUpdate: "" })).toBeNull();
    expect(toPlan({ steps: GOOD.steps, citizenUpdate: 42 })).toBeNull();
  });

  test("non-string steps are dropped, not rendered", () => {
    const plan = toPlan({ steps: [GOOD.steps[0], 7, null], citizenUpdate: GOOD.citizenUpdate });
    expect(plan?.steps).toEqual([GOOD.steps[0]]);
  });

  test("the draft never exceeds what the comment endpoint accepts", () => {
    const plan = toPlan({ steps: GOOD.steps, citizenUpdate: "x".repeat(5000) });
    // createCommentSchema caps a comment body at 2000 characters.
    expect(plan?.citizenUpdate.length).toBe(2000);
  });

  test("at most five steps reach the officer", () => {
    const plan = toPlan({
      steps: Array.from({ length: 9 }, (_, i) => `Step ${i}.`),
      citizenUpdate: GOOD.citizenUpdate,
    });
    expect(plan?.steps).toHaveLength(5);
  });
});
