import { describe, expect, it } from "vitest";
import {
  APPROVED_CUSTOMER_FEATURES,
  isBackendMissingError,
  PRIVATE_FEEDBACK_CATEGORIES,
} from "@/lib/featureAvailability";
import { getFoodWinePairings } from "@/services/upsell";
import { calculateByItemSplit, calculateEqualSplit, validateCustomSplit } from "@/lib/billSplit";
import { revalidatePastOrderForReorder } from "@/lib/reorderValidation";

describe("Final 10 customer features frontend guarantees", () => {
  it("locks permanent scope strictly to the 10 approved customer features", () => {
    expect(APPROVED_CUSTOMER_FEATURES).toHaveLength(10);
    expect(APPROVED_CUSTOMER_FEATURES.map((f) => f.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("detects PostgREST/Postgres missing backend relations & RPCs accurately", () => {
    expect(isBackendMissingError({ code: "PGRST205", message: "Could not find the table in schema cache" })).toBe(true);
    expect(isBackendMissingError({ code: "PGRST202", message: "Could not find the function public.resolve_table_qr" })).toBe(true);
    expect(isBackendMissingError({ code: "42P01", message: "relation does not exist" })).toBe(true);
    expect(isBackendMissingError({ status: 404 })).toBe(true);
    expect(isBackendMissingError({ code: "23505", message: "duplicate key value" })).toBe(false);
    expect(isBackendMissingError(null)).toBe(false);
  });

  it("returns explicit restaurant-approved pairings for steaks and omits unverified items", () => {
    const steakPairings = getFoodWinePairings("cc-ribeye", 2);
    expect(steakPairings.length).toBeGreaterThan(0);
    expect(steakPairings.every((p) => p.item.menuSection === "drinks")).toBe(true);
    expect(steakPairings.every((p) => p.pairingNote.length > 10)).toBe(true);

    // Drinks and Sides & Sauces have no invented pairings -> section omitted cleanly
    expect(getFoodWinePairings("14", 2)).toEqual([]);
    expect(getFoodWinePairings("9", 2)).toEqual([]);
  });

  it("calculates exact integer-cent split bill previews with zero rounding drift", () => {
    const totalCents = 33500; // N$ 335.00
    const equal = calculateEqualSplit(["a", "b", "c"], totalCents);
    expect(equal.reduce((sum, a) => sum + a.amount_cents, 0)).toBe(totalCents);
    expect(equal.map((a) => a.amount_cents)).toEqual([11167, 11167, 11166]);

    const byItem = calculateByItemSplit(
      ["a", "b"],
      [
        { participant_id: "a", unit_price_cents: 33500, quantity: 1 },
        { participant_id: "b", unit_price_cents: 10500, quantity: 2 },
      ],
    );
    expect(byItem).toEqual([
      { participant_id: "a", amount_cents: 33500 },
      { participant_id: "b", amount_cents: 21000 },
    ]);

    const badCustom = validateCustomSplit(
      [
        { participant_id: "a", amount_cents: 20000 },
        { participant_id: "b", amount_cents: 10000 },
      ],
      totalCents,
    );
    expect(badCustom.ok).toBe(false);
  });

  it("never silently substitutes unavailable items during reorder validation", () => {
    const disabled = new Set<string>(["cc-ribeye"]);
    const res = revalidatePastOrderForReorder(
      [{ id: "cc-ribeye", name: "Rib Eye", qty: 1, price: 300 }],
      disabled,
    );
    expect(res.blockedCount).toBe(1);
    expect(res.lines[0].canAdd).toBe(false);
  });

  it("exposes the exact 6 approved private dining feedback categories", () => {
    expect(PRIVATE_FEEDBACK_CATEGORIES.map((c) => c.label)).toEqual([
      "Food quality",
      "Restaurant service",
      "Waiting time",
      "Cleanliness",
      "General experience",
      "Other feedback",
    ]);
  });
});
