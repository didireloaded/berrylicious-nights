import dishLamb from "@/assets/dish-lamb.jpg";

/**
 * Restaurant-controlled promo spotlight (day or week).
 * Update dates when you rotate — or clear validFrom/validUntil to always treat as active.
 */
export type PromoWindowKind = "daily" | "weekly";

export type PromoSpotlightConfig = {
  /** Shown in small caps on the promo page */
  windowKind: PromoWindowKind;
  /** Short badge on the home card + hero (e.g. "This week", "Today only") */
  badge: string;
  title: string;
  /** Home carousel line (keep short) */
  shortLine: string;
  heroImage: string;
  /** 2–4 short paragraphs for the dedicated promo screen */
  storyParagraphs: string[];
  /**
   * Optional menu item id from `menu.ts` — when set, guests can add at `promoPrice` (or menu price if null).
   * Leave null for non-dish promos (e.g. drink specials); page shows story + link to menu.
   */
  menuItemId: string | null;
  /** Promo price in NAD; omit or null to use the menu item’s usual price */
  promoPrice: number | null;
  /**
   * Inclusive YYYY-MM-DD in local calendar sense (compare to "today" in client TZ).
   * Omit both to always be active.
   */
  validFrom?: string;
  validUntil?: string;
};

export const promoSpotlight: PromoSpotlightConfig = {
  windowKind: "weekly",
  badge: "This week",
  title: "800g Tomahawk on the bone",
  shortLine: "100% Namibian wet-aged rib eye on the bone, grilled over charcoal.",
  heroImage: dishLamb,
  storyParagraphs: [
    "We’re putting our 800g Tomahawk centre stage: bone-in Namibian rib eye meant for savouring, flame-grilled over charcoal and served on a hot sizzle plate with your choice of complimentary side.",
    "Pair it with a bottle of Rust En Vrede Cabernet Sauvignon from our glass wine cellar or a Moscow Mule in an icy copper mug.",
    "Join us at Am Weinberg Estate on Tuesdays for Ladies’ Night or Wednesdays for Men’s Night.",
  ],
  menuItemId: "6",
  promoPrice: 625,
};

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isPromoSpotlightActive(config: PromoSpotlightConfig = promoSpotlight): boolean {
  if (!config.validFrom || !config.validUntil) return true;
  const t = todayYmd();
  return t >= config.validFrom && t <= config.validUntil;
}

export function getHomePromoTeaser(config: PromoSpotlightConfig = promoSpotlight) {
  const active = isPromoSpotlightActive(config);
  return {
    active,
    badge: config.badge,
    title: config.title,
    shortLine: config.shortLine,
    image: config.heroImage,
    windowKind: config.windowKind,
  };
}
