import { db } from "@/db";

/**
 * The department list, for filter controls and assignment pickers.
 *
 * Public: the names of a city's departments are not private, and the register
 * filter has to work for an anonymous visitor. Nothing here reveals who works
 * in one — that lives on `profiles`, and never leaves the authority views.
 */
export async function listDepartments() {
  return db.query.departments.findMany({
    columns: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
