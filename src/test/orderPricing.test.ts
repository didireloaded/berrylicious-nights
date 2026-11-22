import { describe, expect, it } from "vitest";
import { foodItems } from "@/data/menu";
import type { CartItem } from "@/context/CartContext";
import {
  extractOrderMetaFromItems,
  resolveCanonicalUnitPrice,
  revalidateCartForOrder,
} from "@/lib/orderPricing";
import { groupOrdersByKitchenStatus } from "@/lib/adminDashboardIntel";

const rump = foodItems.find((i) => i.id === "7")!;
const tomahawk = foodItems.find((i) => i.id === "6")!;

describe("canonical order pricing and stale-cart protection", () => {
  it("computes steak weight + sauces accurately while keeping complimentary side at N$ 0", () => {
    const cartItem: CartItem = {
      ...rump,
      id: "7::300g|Medium Rare|Chips|Green Peppercorn,Bordelaise",
      baseItemId: "7",
      quantity: 1,
      weight: "300g",
      doneness: "Medium Rare",
      side: "Chips",
      sauces: ["Green Peppercorn", "Bordelaise"],
      price: 1, // intentionally stale/tampered local price
    };

    // 300g Rump = 285, Green Peppercorn = 55, Bordelaise = 45 => 385
    expect(resolveCanonicalUnitPrice(cartItem)).toBe(385);

    const validated = revalidateCartForOrder([cartItem], new Set(), {
      tableNumber: "Table 9",
      dietaryNotes: "Nut allergy",
    });
    expect(validated.ok).toBe(true);
    if ("items" in validated) {
      expect(validated.priceAdjusted).toBe(true);
      expect(validated.total).toBe(385);
      expect(validated.items[0].price).toBe(385);
      expect(validated.items[0].doneness).toBe("Medium Rare");
      expect(validated.items[0].side).toBe("Chips");
      expect(validated.items[0].sauces).toEqual(["Green Peppercorn", "Bordelaise"]);
      expect(extractOrderMetaFromItems(validated.items)).toEqual({
        tableNumber: "Table 9",
        dietaryNotes: "Nut allergy",
      });
    }
  });

  it("blocks checkout when a cart item has been 86'd in the kitchen", () => {
    const staleCart: CartItem[] = [
      { ...tomahawk, id: "6::800g|Medium|Chips|", baseItemId: "6", quantity: 1, weight: "800g" },
    ];
    const result = revalidateCartForOrder(staleCart, new Set(["6"]));
    expect(result.ok).toBe(false);
    if ("reason" in result) {
      expect(result.reason).toBe("unavailable");
      expect(result.unavailableNames).toEqual(["Tomahawk Steak"]);
    }
  });

  it("groups cancelled kitchen orders separately from active and completed tickets", () => {
    const grouped = groupOrdersByKitchenStatus([
      { id: "1", status: "pending", created_at: "2026-11-22T12:00:00Z" },
      { id: "2", status: "preparing", created_at: "2026-11-22T12:05:00Z" },
      { id: "3", status: "cancelled", created_at: "2026-11-22T12:10:00Z" },
      { id: "4", status: "completed", created_at: "2026-11-22T12:15:00Z" },
    ]);
    expect(grouped.pending).toHaveLength(1);
    expect(grouped.preparing).toHaveLength(1);
    expect(grouped.cancelled).toHaveLength(1);
    expect(grouped.completed).toHaveLength(1);
  });
});
