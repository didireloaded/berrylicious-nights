import { menuItems } from "@/data/menu";
import { normalizeReviewMenuItemId } from "@/lib/reviews";
import {
  revalidatePastOrderForReorder,
  type PastOrderLine,
  type ReorderValidationSummary,
} from "@/lib/reorderValidation";

const DRINK_IDS = new Set(menuItems.filter((m) => m.menuSection === "drinks").map((m) => m.id));
const DRINK_NAMES = new Set(
  menuItems.filter((m) => m.menuSection === "drinks").map((m) => m.name.trim().toLowerCase()),
);

/** Filters an order's line items strictly down to drinks for "Order Another Round". */
export function extractDrinkLinesFromOrder(rawItems: unknown): PastOrderLine[] {
  if (!Array.isArray(rawItems)) return [];
  const drinks: PastOrderLine[] = [];
  for (const raw of rawItems as PastOrderLine[]) {
    const baseId = normalizeReviewMenuItemId(raw?.id);
    const lowerName = raw?.name?.trim().toLowerCase() ?? "";
    if ((baseId && DRINK_IDS.has(baseId)) || (lowerName && DRINK_NAMES.has(lowerName))) {
      drinks.push(raw);
    }
  }
  return drinks;
}

/**
 * Revalidates a drink round against live Butcher Block catalog prices and kitchen/bar availability.
 * Never silently substitutes unavailable drinks and never auto-submits.
 */
export function revalidateDrinkRound(
  rawItems: unknown,
  disabledIds: Set<string>,
): ReorderValidationSummary {
  const drinkLines = extractDrinkLinesFromOrder(rawItems);
  return revalidatePastOrderForReorder(drinkLines, disabledIds);
}
