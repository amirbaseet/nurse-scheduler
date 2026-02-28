/**
 * SQLite doesn't support array fields. These helpers convert between
 * JSON strings stored in the database and TypeScript arrays.
 *
 * When we migrate to PostgreSQL (Phase 10), these become unnecessary
 * since Postgres supports native array columns.
 */

export function parseJsonArray(field: string | null): string[] {
  if (!field) return [];
  try {
    return JSON.parse(field);
  } catch {
    return [];
  }
}

export function toJsonArray(arr: string[]): string {
  return JSON.stringify(arr);
}
