import { menuItems, type MenuItem } from "@/data/menu";

/**
 * Explicit restaurant-approved Food & Wine pairings grounded strictly in
 * Butcher Block Steakhouse's real wine & bar catalog (src/data/menu.ts).
 * Categories without explicit cellar pairings return an empty list so the UI
 * omits the section rather than inventing filler suggestions.
 */
const EXPLICIT_CATEGORY_PAIRINGS: Record<string, { drinkId: string; note: string }[]> = {
  "Choice Cuts": [
    {
      drinkId: "wn-rb-chocolate-block",
      note: "Structured Swartland red blend balances rich 21-day wet-aged beef.",
    },
    {
      drinkId: "16",
      note: "Stellenbosch Cabernet Sauvignon with dark berry tannins suited to chargrilled cuts.",
    },
  ],
  "Butcher's Choice": [
    {
      drinkId: "wn-pt-kanonkop-kadette",
      note: "Classic Stellenbosch Pinotage & Cape Blend notes complement flame-grilled cuts.",
    },
    {
      drinkId: "16",
      note: "Full-bodied Cabernet Sauvignon stands up cleanly to prime grill flavour.",
    },
  ],
  "Land + Sea": [
    {
      drinkId: "wn-sb-springfield",
      note: "Crisp Robertson Sauvignon Blanc lifts seafood while balancing chargrilled richness.",
    },
    {
      drinkId: "17",
      note: "Bright, dry white cellar pour suited to prawns, hake, and steak combos.",
    },
  ],
  "Kick Start": [
    {
      drinkId: "wn-sb-springfield",
      note: "Zesty Sauvignon Blanc pairs cleanly with crisp starters.",
    },
    {
      drinkId: "17",
      note: "Fresh dry white pour to open the meal.",
    },
  ],
  Poultry: [
    {
      drinkId: "wn-ch-springfield-wy",
      note: "Unwooded Wild Yeast Chardonnay pairs smoothly with flame-grilled poultry.",
    },
    {
      drinkId: "17",
      note: "Light, crisp white wine matched to poultry seasoning.",
    },
  ],
  Combos: [
    {
      drinkId: "jr-pimms",
      note: "Refreshing citrus & herb pitcher cuts cleanly through smoky grill combos.",
    },
    {
      drinkId: "14",
      note: "Crisp bar serve built for generous sharing plates.",
    },
  ],
  Burgers: [
    {
      drinkId: "jr-pimms",
      note: "Chilled citrus pitcher balances chargrilled burger richness.",
    },
    {
      drinkId: "14",
      note: "Refreshing ginger and lime cocktail alongside steakhouse burgers.",
    },
  ],
  Salads: [
    {
      drinkId: "wn-sb-springfield",
      note: "Crisp herbal Sauvignon Blanc complements fresh greens and dressings.",
    },
  ],
  Desserts: [
    {
      drinkId: "wn-ds-lormarins-lbv",
      note: "Rich Cape Late Bottled Vintage port finishes sweet desserts cleanly.",
    },
  ],
};

const MENU_BY_ID = new Map<string, MenuItem>(menuItems.map((m) => [m.id, m]));

export interface FoodWinePairing {
  item: MenuItem;
  pairingNote: string;
}

export function getPairingNote(base: MenuItem, paired: MenuItem): string {
  const entries = EXPLICIT_CATEGORY_PAIRINGS[base.category] ?? [];
  const exact = entries.find((e) => e.drinkId === paired.id);
  if (exact) return exact.note;
  return `Cellar match for ${base.category}.`;
}

/**
 * Returns ONLY explicit restaurant-approved pairings for a food item.
 * Returns [] if no verified pairing exists (e.g. drinks, sides & sauces) so
 * the FoodWinePairing component omits itself honestly.
 */
export function getFoodWinePairings(itemId: string, limit = 2): FoodWinePairing[] {
  const base = MENU_BY_ID.get(itemId);
  if (!base || base.menuSection !== "food") return [];

  const configured = EXPLICIT_CATEGORY_PAIRINGS[base.category];
  if (!configured || configured.length === 0) return [];

  const out: FoodWinePairing[] = [];
  const seen = new Set<string>([itemId]);

  for (const entry of configured) {
    if (out.length >= limit) break;
    const drink = MENU_BY_ID.get(entry.drinkId);
    if (!drink || seen.has(drink.id)) continue;
    seen.add(drink.id);
    out.push({ item: drink, pairingNote: entry.note });
  }

  return out;
}

export function getUpsellItems(itemId: string, limit = 2): MenuItem[] {
  return getFoodWinePairings(itemId, limit).map((p) => p.item);
}
