/**
 * The role-change rules.
 *
 * `explainRoleChange` is pure so the lockout guard can be asserted directly. A
 * self-demotion bug is the kind that only shows up when the last administrator
 * loses the console, which is exactly when nobody can fix it.
 */
import { describe, expect, test } from "bun:test";

import { explainRoleChange } from "./roles";

const ADMIN = "admin_1";
const TARGET = "user_2";
const DEPT = "8f5b1f2c-0000-4000-8000-000000000001";

describe("explainRoleChange", () => {
  test("an admin cannot change their own role", () => {
    expect(explainRoleChange(ADMIN, ADMIN, "CITIZEN", null)).toMatch(
      /your own role/i,
    );
    // Not even to the same role: the whole self path stays closed.
    expect(explainRoleChange(ADMIN, ADMIN, "ADMIN", null)).not.toBeNull();
  });

  test("an officer must have a department", () => {
    expect(explainRoleChange(ADMIN, TARGET, "OFFICER", null)).toMatch(
      /needs a department/i,
    );
    expect(explainRoleChange(ADMIN, TARGET, "OFFICER", DEPT)).toBeNull();
  });

  test("citizens and admins may not hold a department", () => {
    expect(explainRoleChange(ADMIN, TARGET, "CITIZEN", DEPT)).toMatch(
      /only officers/i,
    );
    expect(explainRoleChange(ADMIN, TARGET, "ADMIN", DEPT)).toMatch(
      /only officers/i,
    );
  });

  test("the ordinary promotions are allowed", () => {
    expect(explainRoleChange(ADMIN, TARGET, "CITIZEN", null)).toBeNull();
    expect(explainRoleChange(ADMIN, TARGET, "ADMIN", null)).toBeNull();
  });
});
