/**
 * The permission matrix, tested exhaustively.
 *
 * `hasRole` is pure on purpose: every role/action pair can be asserted without
 * seeding users or faking sessions, so this stays fast enough to run on every
 * save and complete enough to catch a widened check during a rushed edit.
 */
import { describe, expect, test } from "bun:test";

import { hasRole } from "./permissions";
import type { UserRole } from "@/db/schema";

const ROLES: UserRole[] = ["CITIZEN", "OFFICER", "ADMIN"];

const ADMIN_ONLY = ["ADMIN"] as const;
const OFFICER_UP = ["OFFICER", "ADMIN"] as const;
const ANY_USER = ["CITIZEN", "OFFICER", "ADMIN"] as const;

describe("permission matrix", () => {
  test("admin-only actions: ADMIN yes, everyone else no", () => {
    expect(hasRole("ADMIN", ADMIN_ONLY)).toBe(true);
    expect(hasRole("OFFICER", ADMIN_ONLY)).toBe(false);
    expect(hasRole("CITIZEN", ADMIN_ONLY)).toBe(false);
  });

  test("officer actions: OFFICER and ADMIN yes, CITIZEN no", () => {
    expect(hasRole("OFFICER", OFFICER_UP)).toBe(true);
    expect(hasRole("ADMIN", OFFICER_UP)).toBe(true);
    expect(hasRole("CITIZEN", OFFICER_UP)).toBe(false);
  });

  test("citizen actions: every role yes", () => {
    for (const role of ROLES) {
      expect(hasRole(role, ANY_USER)).toBe(true);
    }
  });

  test("an empty allow-list permits nobody", () => {
    for (const role of ROLES) {
      expect(hasRole(role, [])).toBe(false);
    }
  });
});
