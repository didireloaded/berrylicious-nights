/**
 * Pure table picker for a party size given table definitions and codes already taken.
 * DB trigger `assign_booking_table` runs the same logic server-side on insert; keep this in sync for previews/tests.
 */
export type TableDef = {
  code: string;
  capacityMin: number;
  capacityMax: number;
  sortOrder: number;
};

export function assignTable(guests: number, tables: TableDef[], takenCodes: Set<string>): string | null {
  const sorted = [...tables].filter((t) => t.capacityMax >= guests).sort((a, b) => {
    if (a.capacityMax !== b.capacityMax) return a.capacityMax - b.capacityMax;
    return a.sortOrder - b.sortOrder || a.code.localeCompare(b.code);
  });
  for (const t of sorted) {
    if (!takenCodes.has(t.code)) return t.code;
  }
  return null;
}
