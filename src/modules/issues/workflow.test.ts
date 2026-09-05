/**
 * The full transition matrix — every from/to pair, legal and illegal.
 *
 * Exhaustive rather than sampled: a rushed edit that widens one rule shows up
 * here immediately.
 */
import { describe, expect, test } from "bun:test";

import type { IssueStatus } from "@/db/schema/enums";
import {
  allowedTransitions,
  canTransition,
  explainAssignment,
  explainTransition,
  isTerminal,
  requiresNote,
} from "./workflow";

const ALL: IssueStatus[] = [
  "SUBMITTED",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
];

const LEGAL: [IssueStatus, IssueStatus][] = [
  ["SUBMITTED", "ACKNOWLEDGED"],
  ["SUBMITTED", "REJECTED"],
  ["ACKNOWLEDGED", "IN_PROGRESS"],
  ["ACKNOWLEDGED", "RESOLVED"],
  ["ACKNOWLEDGED", "REJECTED"],
  ["IN_PROGRESS", "RESOLVED"],
  ["IN_PROGRESS", "REJECTED"],
];

describe("transition matrix", () => {
  test("every legal transition is allowed", () => {
    for (const [from, to] of LEGAL) {
      expect(canTransition(from, to)).toBe(true);
    }
  });

  test("every other pair is refused", () => {
    for (const from of ALL) {
      for (const to of ALL) {
        const legal = LEGAL.some(([f, t]) => f === from && t === to);
        expect(canTransition(from, to)).toBe(legal);
      }
    }
  });

  test("RESOLVED and REJECTED are terminal", () => {
    expect(isTerminal("RESOLVED")).toBe(true);
    expect(isTerminal("REJECTED")).toBe(true);
    expect(allowedTransitions("RESOLVED")).toHaveLength(0);
  });

  test("a resolved issue cannot be reopened", () => {
    expect(canTransition("RESOLVED", "IN_PROGRESS")).toBe(false);
    expect(canTransition("RESOLVED", "SUBMITTED")).toBe(false);
  });

  test("work cannot start before acknowledgement", () => {
    expect(canTransition("SUBMITTED", "IN_PROGRESS")).toBe(false);
    expect(canTransition("SUBMITTED", "RESOLVED")).toBe(false);
  });
});

describe("resolution note rule", () => {
  test("RESOLVED and REJECTED require a note", () => {
    expect(requiresNote("RESOLVED")).toBe(true);
    expect(requiresNote("REJECTED")).toBe(true);
    expect(requiresNote("IN_PROGRESS")).toBe(false);
  });

  test("resolving with no note is refused", () => {
    expect(explainTransition("IN_PROGRESS", "RESOLVED", undefined)).toMatch(
      /requires a note/,
    );
  });

  test("resolving with a blank note is refused", () => {
    expect(explainTransition("IN_PROGRESS", "RESOLVED", "   ")).toMatch(
      /requires a note/,
    );
  });

  test("resolving with a real note is allowed", () => {
    expect(
      explainTransition("IN_PROGRESS", "RESOLVED", "Road resurfaced 4 Sep."),
    ).toBeNull();
  });
});

describe("refusal messages", () => {
  test("names the allowed moves", () => {
    expect(explainTransition("SUBMITTED", "RESOLVED", "x")).toContain(
      "ACKNOWLEDGED",
    );
  });

  test("explains that terminal means new report", () => {
    expect(explainTransition("RESOLVED", "IN_PROGRESS", "x")).toMatch(
      /new issue/,
    );
  });

  test("a no-op transition is refused", () => {
    expect(explainTransition("SUBMITTED", "SUBMITTED", undefined)).toMatch(
      /already/,
    );
  });
});

describe("assignment scope", () => {
  const roads = "roads";
  const water = "water";
  const officer = { role: "OFFICER" as const, departmentId: roads };

  test("an officer can route an unassigned issue to their own department", () => {
    expect(explainAssignment(officer, roads, undefined)).toBeNull();
  });

  test("an officer cannot route an issue to another department", () => {
    expect(explainAssignment(officer, water, undefined)).toMatch(
      /own department/,
    );
  });

  test("an officer without a department cannot route an issue", () => {
    expect(
      explainAssignment(
        { role: "OFFICER", departmentId: null },
        null,
        undefined,
      ),
    ).toMatch(/own department/);
  });

  test("a citizen cannot be assigned as the responsible officer", () => {
    expect(
      explainAssignment(
        { role: "ADMIN", departmentId: null },
        roads,
        { role: "CITIZEN", departmentId: null },
      ),
    ).toMatch(/officer or administrator/);
  });

  test("an officer assignee must belong to the issue department", () => {
    expect(
      explainAssignment(
        { role: "ADMIN", departmentId: null },
        roads,
        { role: "OFFICER", departmentId: water },
      ),
    ).toMatch(/same department/);
  });

  test("an administrator can be assigned across departments", () => {
    expect(
      explainAssignment(
        { role: "ADMIN", departmentId: null },
        roads,
        { role: "ADMIN", departmentId: null },
      ),
    ).toBeNull();
  });
});
