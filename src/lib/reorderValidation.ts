import {
  menuItems,
  PDF_COMPLIMENTARY_SIDES,
  PDF_SAUCE_ADDONS,
  type MenuItem,
} from "@/data/menu";
import { normalizeReviewMenuItemId } from "@/lib/reviews";
import type { SteakCustomization } from "@/context/CartContext";

export interface PastOrderLine {
  id?: string;
  name?: string;
  qty?: number;
  price?: number;
  weight?: string;
  doneness?: string;
  side?: string;
  sauces?: string[];
}

export type ReorderLineStatus = "ready" | "price_changed" | "modified" | "blocked";

export interface ReorderValidatedLine {
  key: string;
  originalName: string;
  quantity: number;
  status: ReorderLineStatus;
  canAdd: boolean;
  menuItem: MenuItem | null;
  customization?: SteakCustomization & { priceOverride?: number };
  originalUnitPrice: number | null;
  currentUnitPrice: number | null;
  priceDelta: number;
  notices: string[];
  blockingReason?: string;
}

export interface ReorderValidationSummary {
  lines: ReorderValidatedLine[];
  addableCount: number;
  blockedCount: number;
  hasPriceChanges: boolean;
  hasNotices: boolean;
  currentTotal: number;
}

const menuById = new Map<string, MenuItem>(menuItems.map((m) => [m.id, m]));
const menuByLowerName = new Map<string, MenuItem>(menuItems.map((m) => [m.name.trim().toLowerCase(), m]));
const validSaucePriceById = new Map<string, number>(PDF_SAUCE_ADDONS.map((s) => [s.id, s.price]));
const validSides = new Set<string>(PDF_COMPLIMENTARY_SIDES);
const STEAK_CATS = new Set(["Choice Cuts", "Butcher's Choice", "Combos"]);

/**
 * Revalidates every line of a past order against the live Butcher Block menu,
 * kitchen 86 availability, portion variations, complimentary sides, sauces, and current prices.
 * Never silently substitutes a missing dish and never auto-submits an order.
 */
export function revalidatePastOrderForReorder(
  rawItems: unknown,
  disabledIds: Set<string>,
  catalogOverride?: MenuItem[],
): ReorderValidationSummary {
  const lookupById = catalogOverride
    ? new Map(catalogOverride.map((m) => [m.id, m]))
    : menuById;
  const lookupByName = catalogOverride
    ? new Map(catalogOverride.map((m) => [m.name.trim().toLowerCase(), m]))
    : menuByLowerName;

  const list = Array.isArray(rawItems) ? (rawItems as PastOrderLine[]) : [];
  const lines: ReorderValidatedLine[] = [];

  for (let i = 0; i < list.length; i += 1) {
    const raw = list[i];
    const originalName = raw?.name?.trim() || "Menu item";
    const qty = Math.min(20, Math.max(1, Math.floor(Number(raw?.qty ?? 1)) || 1));
    const originalUnitPrice = typeof raw?.price === "number" && Number.isFinite(raw.price) ? raw.price : null;
    const baseId = normalizeReviewMenuItemId(raw?.id);
    const key = `${baseId ?? originalName}-${i}`;

    const matched: MenuItem | undefined =
      (baseId ? lookupById.get(baseId) : undefined) ??
      lookupByName.get(originalName.toLowerCase());

    if (!matched) {
      lines.push({
        key,
        originalName,
        quantity: qty,
        status: "blocked",
        canAdd: false,
        menuItem: null,
        originalUnitPrice,
        currentUnitPrice: null,
        priceDelta: 0,
        notices: [],
        blockingReason: "This item is no longer on the Butcher Block menu.",
      });
      continue;
    }

    if (disabledIds.has(matched.id)) {
      lines.push({
        key,
        originalName: matched.name,
        quantity: qty,
        status: "blocked",
        canAdd: false,
        menuItem: matched,
        originalUnitPrice,
        currentUnitPrice: matched.price,
        priceDelta: 0,
        notices: [],
        blockingReason: "Currently unavailable in the kitchen.",
      });
      continue;
    }

    if (matched.priceLabel) {
      lines.push({
        key,
        originalName: matched.name,
        quantity: qty,
        status: "blocked",
        canAdd: false,
        menuItem: matched,
        originalUnitPrice,
        currentUnitPrice: null,
        priceDelta: 0,
        notices: [],
        blockingReason: `${matched.priceLabel} (Seasonal Quote) — please confirm today's rate with your waiter.`,
      });
      continue;
    }

    const notices: string[] = [];
    let resolvedBasePrice = matched.price;
    let resolvedWeight: string | undefined = raw?.weight;

    // Validate portion size / cut variation (never silently swap to a different weight!)
    if (matched.variations && matched.variations.length > 0) {
      if (raw?.weight) {
        const foundVar = matched.variations.find((v) => v.size === raw.weight);
        if (!foundVar) {
          lines.push({
            key,
            originalName: matched.name,
            quantity: qty,
            status: "blocked",
            canAdd: false,
            menuItem: matched,
            originalUnitPrice,
            currentUnitPrice: null,
            priceDelta: 0,
            notices: [],
            blockingReason: `Portion size "${raw.weight}" is no longer available (current options: ${matched.variations.map((v) => v.size).join(", ")}). Please select it fresh from the menu.`,
          });
          continue;
        }
        resolvedBasePrice = foundVar.price;
      } else {
        resolvedWeight = matched.variations[0].size;
        resolvedBasePrice = matched.variations[0].price;
      }
    } else if (raw?.weight) {
      notices.push(`Previous portion option "${raw.weight}" is no longer listed separately.`);
      resolvedWeight = undefined;
    }

    // Validate complimentary side
    let resolvedSide: string | undefined = raw?.side;
    if (resolvedSide && !validSides.has(resolvedSide)) {
      notices.push(`Previous side "${resolvedSide}" is no longer available — please choose a new side if needed.`);
      resolvedSide = undefined;
    }

    // Validate sauces and recalculate sauce add-on total
    const validSelectedSauces: string[] = [];
    const droppedSauces: string[] = [];
    let sauceTotal = 0;
    const isSteak = matched.menuSection === "food" && STEAK_CATS.has(matched.category);
    if (Array.isArray(raw?.sauces) && raw.sauces.length > 0) {
      for (const s of raw.sauces) {
        const p = validSaucePriceById.get(s);
        if (isSteak && typeof p === "number") {
          validSelectedSauces.push(s);
          sauceTotal += p;
        } else {
          droppedSauces.push(s);
        }
      }
    }
    if (droppedSauces.length > 0) {
      notices.push(`Removed unavailable sauce(s): ${droppedSauces.join(", ")}.`);
    }

    const currentUnitPrice = resolvedBasePrice + sauceTotal;
    const priceDelta =
      originalUnitPrice !== null ? Number((currentUnitPrice - originalUnitPrice).toFixed(2)) : 0;

    if (originalUnitPrice !== null && Math.abs(priceDelta) > 0.001) {
      notices.push(
        `Price updated from N$ ${originalUnitPrice} to N$ ${currentUnitPrice} (${priceDelta > 0 ? `+N$ ${priceDelta}` : `-N$ ${Math.abs(priceDelta)}`}).`,
      );
    }

    const status: ReorderLineStatus =
      droppedSauces.length > 0 || (raw?.side && !resolvedSide)
        ? "modified"
        : Math.abs(priceDelta) > 0.001
          ? "price_changed"
          : "ready";

    const hasCustom = Boolean(
      resolvedWeight || raw?.doneness || resolvedSide || validSelectedSauces.length > 0,
    );

    lines.push({
      key,
      originalName: matched.name,
      quantity: qty,
      status,
      canAdd: true,
      menuItem: matched,
      customization: hasCustom
        ? {
            weight: resolvedWeight,
            doneness: raw?.doneness,
            side: resolvedSide,
            sauces: validSelectedSauces.length > 0 ? validSelectedSauces : undefined,
            priceOverride: currentUnitPrice,
          }
        : undefined,
      originalUnitPrice,
      currentUnitPrice,
      priceDelta,
      notices,
    });
  }

  let addableCount = 0;
  let blockedCount = 0;
  let hasPriceChanges = false;
  let hasNotices = false;
  let currentTotal = 0;

  for (const line of lines) {
    if (line.canAdd && line.currentUnitPrice !== null) {
      addableCount += 1;
      currentTotal += line.currentUnitPrice * line.quantity;
    } else {
      blockedCount += 1;
    }
    if (Math.abs(line.priceDelta) > 0.001) hasPriceChanges = true;
    if (line.notices.length > 0) hasNotices = true;
  }

  return {
    lines,
    addableCount,
    blockedCount,
    hasPriceChanges,
    hasNotices,
    currentTotal,
  };
}
