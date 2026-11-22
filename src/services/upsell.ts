import { menuItems, type MenuItem } from "@/data/menu";

/** Restaurant-approved food & wine pairings — deterministic rules over real Butcher Block menu items. */
const DRINK_IDS_BY_MAIN_CATEGORY: Record<string, string[]> = {
  "Choice Cuts": ["16", "wn-rb-chocolate-block", "14"],
  "Butcher's Choice": ["16", "wn-pt-kanonkop-kadette", "14"],
  "Kick Start": ["17", "wn-sb-springfield", "14"],
  Poultry: ["17", "wn-ch-springfield-wy", "15"],
  Combos: ["14", "jr-pimms", "19"],
  "Land + Sea": ["17", "wn-sb-springfield", "14"],
  Burgers: ["14", "jr-pimms", "19"],
  Salads: ["17", "jr-pimms"],
  "Sides & Sauces": ["14", "19"],
  Desserts: ["wn-ds-lormarins-lbv", "19", "14"],
};

const PAIRING_NOTE_BY_TARGET: Record<string, string> = {
  "wn-rb-chocolate-block": "Structured Swartland red blend balances rich 21-day wet-aged beef.",
  "wn-pt-kanonkop-kadette": "Classic Stellenbosch Pinotage & Cape Blend notes complement charcoal-grilled cuts.",
  "wn-sb-springfield": "Crisp Robertson Sauvignon Blanc cuts cleanly through seafood and starters.",
  "wn-ch-springfield-wy": "Unwooded Wild Yeast Chardonnay pairs smoothly with flame-grilled poultry.",
  "wn-ds-lormarins-lbv": "Rich Cape Late Bottled Vintage port finishes sweet desserts cleanly.",
  "jr-pimms": "Refreshing citrus & herb pitcher cuts through smoky grill combos and burgers.",
};

const MENU_BY_ID = new Map<string, MenuItem>(menuItems.map((m) => [m.id, m]));
const SIDE_DESSERT_IDS = ["9", "10", "11", "12", "13"].filter((id) => MENU_BY_ID.has(id));

function byId(id: string): MenuItem | undefined {
  return MENU_BY_ID.get(id);
}

export interface FoodWinePairing {
  item: MenuItem;
  pairingNote: string;
}

export function getPairingNote(base: MenuItem, paired: MenuItem): string {
  if (PAIRING_NOTE_BY_TARGET[paired.id]) return PAIRING_NOTE_BY_TARGET[paired.id];
  if (base.menuSection === "drinks") {
    return `Classic Butcher Block ${paired.category.toLowerCase()} pairing for this pour.`;
  }
  if (paired.menuSection === "drinks") {
    return `Restaurant-approved cellar & bar match for ${base.category}.`;
  }
  return `Popular table accompaniment with ${base.name}.`;
}

export function getUpsellItems(itemId: string, limit = 4): MenuItem[] {
  return getFoodWinePairings(itemId, limit).map((p) => p.item);
}

export function getFoodWinePairings(itemId: string, limit = 4): FoodWinePairing[] {
  const base = MENU_BY_ID.get(itemId);
  if (!base) return [];

  const out: FoodWinePairing[] = [];
  const seen = new Set<string>([itemId]);

  const pushIfValid = (m: MenuItem | undefined) => {
    if (!m || seen.has(m.id) || out.length >= limit) return;
    seen.add(m.id);
    out.push({ item: m, pairingNote: getPairingNote(base, m) });
  };

  if (base.menuSection === "drinks") {
    for (const id of ["cc-ribeye", "1", "3", "6", "7", "8", "12"]) {
      pushIfValid(byId(id));
    }
    return out.slice(0, limit);
  }

  const drinkIds = DRINK_IDS_BY_MAIN_CATEGORY[base.category] ?? ["14", "16", "17"];
  for (const id of drinkIds) pushIfValid(byId(id));

  if (
    base.category === "Choice Cuts" ||
    base.category === "Butcher's Choice" ||
    base.category === "Combos" ||
    base.category === "Land + Sea" ||
    base.category === "Burgers"
  ) {
    for (const id of SIDE_DESSERT_IDS) pushIfValid(byId(id));
  }

  for (const m of menuItems) {
    if (out.length >= limit) break;
    if (seen.has(m.id) || m.category === base.category) continue;
    if (m.menuSection === "drinks" || m.popular) pushIfValid(m);
  }

  return out.slice(0, limit);
}
