import { describe, expect, it } from "vitest";
import { extractDrinkLinesFromOrder, revalidateDrinkRound } from "@/lib/anotherRound";
import { buildSmartFoodSuggestions } from "@/lib/smartSuggestions";
import { getFoodWinePairings } from "@/services/upsell";
import { menuItems } from "@/data/menu";

describe("Phase 7: Order Another Round, Smart Suggestions & Food/Wine Pairings", () => {
  it("extracts only drinks from a mixed meal order and revalidates availability & prices for another round", () => {
    const sampleDrink = menuItems.find((m) => m.menuSection === "drinks" && !m.priceLabel)!;
    const mixedOrder = [
      { id: "cc-ribeye", name: "Rib Eye", qty: 1, price: 335 },
      { id: sampleDrink.id, name: sampleDrink.name, qty: 2, price: sampleDrink.price - 10 },
    ];

    const drinksOnly = extractDrinkLinesFromOrder(mixedOrder);
    expect(drinksOnly).toHaveLength(1);
    expect(drinksOnly[0].id).toBe(sampleDrink.id);

    const validated = revalidateDrinkRound(mixedOrder, new Set());
    expect(validated.addableCount).toBe(1);
    expect(validated.hasPriceChanges).toBe(true);
    expect(validated.lines[0].currentUnitPrice).toBe(sampleDrink.variations?.[0]?.price ?? sampleDrink.price);

    // If the drink is 86'd in the bar, block silently reordering it
    const blocked = revalidateDrinkRound(mixedOrder, new Set([sampleDrink.id]));
    expect(blocked.addableCount).toBe(0);
    expect(blocked.blockedCount).toBe(1);
  });

  it("filters smart food suggestions honestly by dietary preferences and excludes unavailable/S.Q. items", () => {
    const noPork = buildSmartFoodSuggestions({
      dietaryPreferences: ["no_pork"],
      favoriteIds: ["cc-ribeye"],
      pastOrderItemIds: [],
      disabledIds: new Set(["cc-ribeye"]),
      limit: 6,
    });
    expect(noPork.length).toBeGreaterThan(0);
    for (const s of noPork) {
      expect(s.item.id).not.toBe("cc-ribeye");
      expect(s.item.priceLabel).toBeUndefined();
      expect(`${s.item.name} ${s.item.description}`).not.toMatch(/\b(pork|bacon|ribs|eisbein)\b/i);
    }

    const veg = buildSmartFoodSuggestions({
      dietaryPreferences: ["vegetarian_friendly"],
      favoriteIds: [],
      pastOrderItemIds: [],
      disabledIds: new Set(),
      limit: 4,
    });
    expect(veg.length).toBeGreaterThan(0);
    for (const s of veg) {
      expect(["Choice Cuts", "Butcher's Choice", "Burgers", "Poultry"]).not.toContain(s.item.category);
    }
  });

  it("returns restaurant-approved food and wine pairings with tasting rationale notes", () => {
    const pairings = getFoodWinePairings("cc-ribeye", 4);
    expect(pairings.length).toBeGreaterThan(0);
    expect(pairings.some((p) => p.item.menuSection === "drinks")).toBe(true);
    for (const p of pairings) {
      expect(p.pairingNote.length).toBeGreaterThan(10);
    }
  });
});
