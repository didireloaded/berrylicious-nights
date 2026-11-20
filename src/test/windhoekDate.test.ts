import { describe, expect, it } from "vitest";
import { getWindhoekDateISO } from "@/lib/windhoekDate";

describe("Windhoek business date", () => {
  it("uses the next local date after 22:00 UTC", () => {
    expect(getWindhoekDateISO(new Date("2026-11-20T22:30:00.000Z"))).toBe("2026-11-21");
  });

  it("keeps the correct date before local midnight", () => {
    expect(getWindhoekDateISO(new Date("2026-11-20T21:30:00.000Z"))).toBe("2026-11-20");
  });
});
