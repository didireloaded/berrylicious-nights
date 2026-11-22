import { describe, expect, it } from "vitest";
import { revalidatePastOrderForReorder } from "@/lib/reorderValidation";
import { menuItems, PDF_SAUCE_ADDONS } from "@/data/menu";

describe("Phase 5: Past Order Revalidation & One-Tap Reorder", () => {
  it("preserves valid customizations and recalculates changed menu prices transparently", () => {
    const ribeye = menuItems.find((m) => m.id === "cc-ribeye")!;
    const pepperSauce = PDF_SAUCE_ADDONS[0];
    const result = revalidatePastOrderForReorder(
      [
        {
          id: ribeye.id,
          name: ribeye.name,
          qty: 2,
          price: 290, // older price
          doneness: "Medium Rare",
          side: "Chips",
          sauces: [pepperSauce.id],
        },
      ],
      new Set(),
    );

    expect(result.addableCount).toBe(1);
    expect(result.blockedCount).toBe(0);
    expect(result.hasPriceChanges).toBe(true);
    const line = result.lines[0];
    expect(line.status).toBe("price_changed");
    expect(line.currentUnitPrice).toBe(ribeye.price + pepperSauce.price);
    expect(line.customization?.doneness).toBe("Medium Rare");
    expect(line.customization?.side).toBe("Chips");
    expect(line.customization?.sauces).toEqual([pepperSauce.id]);
    expect(result.currentTotal).toBe((ribeye.price + pepperSauce.price) * 2);
  });

  it("blocks removed items, 86'd unavailable items, Seasonal Quote items, and removed portion sizes without substituting", () => {
    const tbone = menuItems.find((m) => m.variations && m.variations.length > 1)!;
    const sqItem = menuItems.find((m) => Boolean(m.priceLabel));

    const result = revalidatePastOrderForReorder(
      [
        { id: "discontinued-dish-999", name: "Old Seasonal Duck", qty: 1, price: 240 },
        { id: "cc-ribeye", name: "Rib Eye", qty: 1, price: 335 },
        { id: tbone.id, name: tbone.name, qty: 1, price: 200, weight: "999g-discontinued" },
        ...(sqItem ? [{ id: sqItem.id, name: sqItem.name, qty: 1, price: 400 }] : []),
      ],
      new Set(["cc-ribeye"]),
    );

    expect(result.addableCount).toBe(0);
    expect(result.blockedCount).toBe(sqItem ? 4 : 3);
    expect(result.lines[0].blockingReason).toContain("no longer on the Butcher Block menu");
    expect(result.lines[1].blockingReason).toContain("Currently unavailable in the kitchen");
    expect(result.lines[2].blockingReason).toContain("999g-discontinued");
    if (sqItem) {
      expect(result.lines[3].blockingReason).toContain("Seasonal Quote");
    }
  });

  it("flags removed sauces and discontinued sides explicitly while preserving the valid base dish", () => {
    const ribeye = menuItems.find((m) => m.id === "cc-ribeye")!;
    const result = revalidatePastOrderForReorder(
      [
        {
          id: ribeye.id,
          name: ribeye.name,
          qty: 1,
          price: ribeye.price,
          doneness: "Medium",
          side: "Discontinued Truffle Polenta",
          sauces: ["Discontinued Ghost Sauce"],
        },
      ],
      new Set(),
    );

    expect(result.addableCount).toBe(1);
    const line = result.lines[0];
    expect(line.status).toBe("modified");
    expect(line.customization?.side).toBeUndefined();
    expect(line.customization?.sauces).toBeUndefined();
    expect(line.notices.length).toBeGreaterThanOrEqual(2);
  });
});
