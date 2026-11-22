import { menuItems, type MenuItem } from "@/data/menu";

export type DietaryPreference =
  | "no_pork"
  | "vegetarian_friendly"
  | "seafood_lover"
  | "alcohol_free"
  | "gluten_conscious";

export const DIETARY_PREFERENCE_OPTIONS: {
  id: DietaryPreference;
  label: string;
  description: string;
}[] = [
  { id: "no_pork", label: "No pork", description: "Excludes ribs, bacon, eisbein, and pork-based dishes" },
  { id: "vegetarian_friendly", label: "Vegetarian-friendly", description: "Highlights salads, sides, and vegetarian options" },
  { id: "seafood_lover", label: "Seafood & grills", description: "Prioritizes Land + Sea & seafood highlights" },
  { id: "alcohol_free", label: "Alcohol-free drinks", description: "Prefers zero-proof drinks & mocktails" },
  { id: "gluten_conscious", label: "Gluten-conscious", description: "Prefers unbreaded steaks, salads & plain sides (confirm allergens with staff)" },
];

export interface SmartSuggestion {
  item: MenuItem;
  reason: string;
}

const PORK_REGEX = /\b(pork|bacon|ribs|eisbein|ham|chorizo|belly)\b/i;
const MEAT_CATEGORIES = new Set(["Choice Cuts", "Butcher's Choice", "Combos", "Burgers", "Poultry"]);
const GLUTEN_HEAVY_REGEX = /\b(burger|bun|bread|pasta|crumbed|battered|pastry|waffle|brownie|cake|pizza)\b/i;

function itemMatchesDietaryPreferences(item: MenuItem, prefs: Set<DietaryPreference>): boolean {
  const blob = `${item.name} ${item.description} ${item.category}`;

  if (prefs.has("no_pork") && PORK_REGEX.test(blob)) {
    return false;
  }

  if (prefs.has("vegetarian_friendly")) {
    if (item.menuSection === "food") {
      if (MEAT_CATEGORIES.has(item.category) || item.category === "Land + Sea") return false;
      if (/\b(beef|steak|fillet|sirloin|rump|ribeye|lamb|chicken|oxtail|calamari|prawns|hake|kingklip|bobotie|biltong|carpaccio|marrow|sausage|wors|bacon|pork)\b/i.test(blob)) {
        return false;
      }
    }
  }

  if (prefs.has("alcohol_free") && item.menuSection === "drinks") {
    const isAlcoholFreeFriendly =
      Boolean(item.alcoholFreeOption) ||
      /\b(virgin|alcohol[- ]?free|0%|mocktail|soft|water|juice|tea|coffee|soda|lemonade|tonic|appletiser|grapetiser)\b/i.test(blob);
    if (!isAlcoholFreeFriendly) return false;
  }

  if (prefs.has("gluten_conscious") && item.menuSection === "food" && GLUTEN_HEAVY_REGEX.test(blob)) {
    return false;
  }

  return true;
}

/**
 * Transparent, deterministic food & drink suggestions based solely on the guest's
 * saved dietary preferences, favourites, and past orders — excluding 86'd and S.Q. items.
 */
export function buildSmartFoodSuggestions(input: {
  dietaryPreferences: DietaryPreference[];
  favoriteIds: string[];
  pastOrderItemIds: string[];
  disabledIds: Set<string>;
  limit?: number;
}): SmartSuggestion[] {
  const limit = input.limit ?? 4;
  const prefs = new Set(input.dietaryPreferences);
  const favSet = new Set(input.favoriteIds);
  const pastSet = new Set(input.pastOrderItemIds);

  // Identify preferred categories from real user favourites & past orders
  const likedCategories = new Map<string, number>();
  for (const item of menuItems) {
    if (favSet.has(item.id) || pastSet.has(item.id)) {
      likedCategories.set(item.category, (likedCategories.get(item.category) ?? 0) + 1);
    }
  }

  const candidates: { item: MenuItem; score: number; reason: string }[] = [];

  for (const item of menuItems) {
    if (input.disabledIds.has(item.id) || item.priceLabel) continue;
    if (!itemMatchesDietaryPreferences(item, prefs)) continue;

    let score = 0;
    let reason = "House favourite";

    const catAffinity = likedCategories.get(item.category) ?? 0;
    if (catAffinity > 0 && !pastSet.has(item.id)) {
      score += 30 + catAffinity * 5;
      reason = `Similar to your ${item.category} picks`;
    } else if (favSet.has(item.id)) {
      score += 18;
      reason = "In your favourites";
    }

    if (prefs.has("seafood_lover") && item.category === "Land + Sea") {
      score += 28;
      reason = "Matches your seafood & grill preference";
    }
    if (prefs.has("vegetarian_friendly") && (item.category === "Salads" || item.category === "Sides & Sauces")) {
      score += 22;
      reason = "Vegetarian-friendly choice";
    }
    if (prefs.has("alcohol_free") && item.menuSection === "drinks") {
      score += 20;
      reason = item.alcoholFreeOption ? "Available alcohol-free" : "Zero-proof drink";
    }
    if (prefs.has("gluten_conscious") && item.category === "Choice Cuts") {
      score += 16;
      reason = "Unbreaded chargrilled cut";
    }

    if (item.popular) score += 10;
    if (item.menuSection === "food") score += 4;

    if (score > 0) {
      candidates.push({ item, score, reason });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));

  // Keep category variety so suggestions don't repeat 4 identical items
  const picked: SmartSuggestion[] = [];
  const catCount = new Map<string, number>();
  for (const c of candidates) {
    if (picked.length >= limit) break;
    const count = catCount.get(c.item.category) ?? 0;
    if (count >= 2) continue;
    catCount.set(c.item.category, count + 1);
    picked.push({ item: c.item, reason: c.reason });
  }

  return picked;
}
