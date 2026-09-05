/**
 * Upload boundary rules.
 *
 * An upload endpoint is a trust boundary, and these are the checks that stop it
 * being a hole: what may be stored, how large, and how many. Pure — no
 * database, no session, no blob store — so every rule is covered here rather
 * than being hoped for in a route.
 */
import { describe, expect, test } from "bun:test";

import { ValidationError } from "@/lib/http";

import { assertUploadable } from "./attachments";

const jpeg = { type: "image/jpeg", size: 2 * 1024 * 1024 };

describe("assertUploadable", () => {
  test("accepts an ordinary phone photo", () => {
    expect(() => assertUploadable(jpeg, 0)).not.toThrow();
  });

  test.each([["image/jpeg"], ["image/png"], ["image/webp"]])(
    "accepts %s",
    (type) => {
      expect(() => assertUploadable({ type, size: 1024 }, 0)).not.toThrow();
    },
  );

  test.each([
    ["application/pdf"],
    ["image/svg+xml"], // scriptable, deliberately not allowed
    ["text/html"],
    ["application/x-msdownload"],
    [""],
  ])("rejects %s", (type) => {
    expect(() => assertUploadable({ type, size: 1024 }, 0)).toThrow(
      ValidationError,
    );
  });

  test("rejects an empty file", () => {
    expect(() => assertUploadable({ ...jpeg, size: 0 }, 0)).toThrow(
      /empty/i,
    );
  });

  test("rejects a file over 8MB", () => {
    expect(() =>
      assertUploadable({ ...jpeg, size: 8 * 1024 * 1024 + 1 }, 0),
    ).toThrow(/under 8MB/);
  });

  test("accepts a file at exactly 8MB", () => {
    expect(() =>
      assertUploadable({ ...jpeg, size: 8 * 1024 * 1024 }, 0),
    ).not.toThrow();
  });

  test("rejects the sixth photo on an issue", () => {
    expect(() => assertUploadable(jpeg, 5)).toThrow(/at most 5 photos/);
  });

  test("accepts the fifth", () => {
    expect(() => assertUploadable(jpeg, 4)).not.toThrow();
  });

  test("checks the count before the type, so a full issue says so", () => {
    expect(() => assertUploadable({ type: "text/html", size: 1 }, 5)).toThrow(
      /at most 5 photos/,
    );
  });
});
