import { menuItems, type MenuItem } from "@/data/menu";

/** Pairings and combos — deterministic rules, no external AI. */
const DRINK_IDS_BY_MAIN_CATEGORY: Record<string, string[]> = {
  Mains: ["14", "16", "17"],
  Burgers: ["14", "19"],
  Starters: ["16", "17"],
  Salads: ["17", "19"],
  Sides: ["14", "19"],
  Desserts: ["16"],
};

const SIDE_DESSERT_IDS = ["9", "10", "11", "12", "13"].filter((id) => menuItems.some((m) => m.id === id));

function byId(id: string): MenuItem | undefined {
  return menuItems.find((m) => m.id === id);
}

export function getUpsellItems(itemId: string, limit = 4): MenuItem[] {
  const base = menuItems.find((m) => m.id === itemId);
  if (!base) return [];

  const out: MenuItem[] = [];
  const seen = new Set<string>([itemId]);

  const drinkIds = DRINK_IDS_BY_MAIN_CATEGORY[base.category] ?? ["14", "16", "17"];
  for (const id of drinkIds) {
    const m = byId(id);
    if (m && !seen.has(m.id)) {
      seen.add(m.id);
      out.push(m);
    }
    if (out.length >= limit) return out;
  }

  if (base.category === "Mains" || base.category === "Burgers") {
    for (const id of SIDE_DESSERT_IDS) {
      const m = byId(id);
      if (m && !seen.has(m.id)) {
        seen.add(m.id);
        out.push(m);
      }
      if (out.length >= limit) return out;
    }
  }

  for (const m of menuItems) {
    if (out.length >= limit) break;
    if (seen.has(m.id)) continue;
    if (m.category === base.category) continue;
    if (m.category === "Drinks" || m.popular) {
      out.push(m);
      seen.add(m.id);
    }
  }

  return out.slice(0, limit);
}
