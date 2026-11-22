import { describe, expect, it } from "vitest";
import {
  calculateByItemSplit,
  calculateEqualSplit,
  canModifyGroupItem,
  canRecordBillSettlement,
  computeGroupTotalCents,
  formatCentsNAD,
  toCents,
  validateCustomSplit,
} from "@/lib/billSplit";

describe("Phase 6: Group Ordering & Integer Minor-Unit Split Bill Engine", () => {
  it("converts and formats Namibian Dollar minor units accurately without float drift", () => {
    expect(toCents(335)).toBe(33500);
    expect(toCents(19.99)).toBe(1999);
    expect(formatCentsNAD(33500)).toBe("N$ 335");
    expect(formatCentsNAD(3334)).toBe("N$ 33.34");
  });

  it("splits bills equally with deterministic remainder distribution summing to exact total", () => {
    const splits = calculateEqualSplit(["p1", "p2", "p3"], 10000); // N$ 100.00 / 3
    expect(splits).toEqual([
      { participant_id: "p1", amount_cents: 3334 },
      { participant_id: "p2", amount_cents: 3333 },
      { participant_id: "p3", amount_cents: 3333 },
    ]);
    const total = splits.reduce((acc, s) => acc + s.amount_cents, 0);
    expect(total).toBe(10000);
  });

  it("splits bills accurately by participant items", () => {
    const items = [
      { participant_id: "host", unit_price_cents: 33500, quantity: 1 },
      { participant_id: "guestA", unit_price_cents: 18500, quantity: 2 },
      { participant_id: "guestB", unit_price_cents: 6500, quantity: 1 },
    ];
    const totalCents = computeGroupTotalCents(items);
    expect(totalCents).toBe(77000);

    const byItem = calculateByItemSplit(["host", "guestA", "guestB"], items);
    expect(byItem).toEqual([
      { participant_id: "host", amount_cents: 33500 },
      { participant_id: "guestA", amount_cents: 37000 },
      { participant_id: "guestB", amount_cents: 6500 },
    ]);
    expect(byItem.reduce((s, a) => s + a.amount_cents, 0)).toBe(totalCents);
  });

  it("validates custom splits strictly and rejects short, over-allocated, or negative shares", () => {
    expect(
      validateCustomSplit(
        [
          { participant_id: "p1", amount_cents: 50000 },
          { participant_id: "p2", amount_cents: 27000 },
        ],
        77000,
      ),
    ).toEqual({ ok: true, allocatedCents: 77000 });

    const short = validateCustomSplit(
      [
        { participant_id: "p1", amount_cents: 50000 },
        { participant_id: "p2", amount_cents: 26999 },
      ],
      77000,
    );
    expect(short.ok).toBe(false);

    const over = validateCustomSplit(
      [
        { participant_id: "p1", amount_cents: 50000 },
        { participant_id: "p2", amount_cents: 28000 },
      ],
      77000,
    );
    expect(over.ok).toBe(false);

    const neg = validateCustomSplit(
      [
        { participant_id: "p1", amount_cents: 80000 },
        { participant_id: "p2", amount_cents: -3000 },
      ],
      77000,
    );
    expect(neg.ok).toBe(false);
  });

  it("enforces item ownership, lock-after-submission, and staff-only payment settlement rules", () => {
    expect(canModifyGroupItem({ participant_id: "p1", locked: false }, "p1", "open")).toBe(true);
    expect(canModifyGroupItem({ participant_id: "p1", locked: false }, "p2", "open")).toBe(false);
    expect(canModifyGroupItem({ participant_id: "p1", locked: true }, "p1", "open")).toBe(false);
    expect(canModifyGroupItem({ participant_id: "p1", locked: false }, "p1", "submitted")).toBe(false);

    expect(canRecordBillSettlement(null)).toBe(false);
    expect(canRecordBillSettlement("customer")).toBe(false);
    expect(canRecordBillSettlement("waiter")).toBe(true);
    expect(canRecordBillSettlement("admin")).toBe(true);
  });
});
