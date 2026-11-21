import { menuItems, type MenuItem } from "@/data/menu";

/** Pairings and combos — deterministic rules, no external AI. */
const DRINK_IDS_BY_MAIN_CATEGORY: Record<string, string[]> = {
  "Choice Cuts": ["16", "33", "14"],
  "Kick Start": ["17", "14"],
  Poultry: ["17", "26", "14"],
  Combos: ["14", "32", "19"],
  "Land + Sea": ["17", "26", "14"],
  Mains: ["14", "16", "17"],
  Burgers: ["14", "32", "19"],
  Starters: ["16", "17"],
  Salads: ["17", "32"],
  Sides: ["14", "19"],
  Desserts: ["15", "19"],
};

const MENU_BY_ID = new Map<string, MenuItem>(menuItems.map((m) => [m.id, m]));

const SIDE_DESSERT_IDS = ["9", "10", "11", "12", "13"].filter((id) => MENU_BY_ID.has(id));

function byId(id: string): MenuItem | undefined {
  return MENU_BY_ID.get(id);
}

export function getUpsellItems(itemId: string, limit = 4): MenuItem[] {
  const base = MENU_BY_ID.get(itemId);
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

  if (
    base.category === "Choice Cuts" ||
    base.category === "Combos" ||
    base.category === "Land + Sea" ||
    base.category === "Mains" ||
    base.category === "Burgers"
  ) {
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
