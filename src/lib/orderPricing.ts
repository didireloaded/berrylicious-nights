import { menuItems, PDF_SAUCE_ADDONS, type MenuItem } from "@/data/menu";
import type { CartItem } from "@/context/CartContext";

export type OrderItemMeta = {
  tableNumber?: string | null;
  scheduledTime?: string | null;
  guestName?: string | null;
  dietaryNotes?: string | null;
};

export type KitchenOrderItem = {
  id: string;
  name: string;
  qty: number;
  price: number;
  weight?: string;
  doneness?: string;
  side?: string;
  sauces?: string[];
  orderMeta?: OrderItemMeta;
};

const menuById = new Map<string, MenuItem>(menuItems.map((item) => [item.id, item]));
const saucePriceById = new Map<string, number>(PDF_SAUCE_ADDONS.map((s) => [s.id, s.price]));

const STEAK_CUSTOMIZABLE_CATEGORIES = new Set(["Choice Cuts", "Butcher's Choice", "Combos"]);

export function resolveBaseMenuItemId(item: Pick<CartItem, "id" | "baseItemId">): string {
  if (item.baseItemId) return item.baseItemId;
  const sep = item.id.indexOf("::");
  return sep === -1 ? item.id : item.id.slice(0, sep);
}

/**
 * Recomputes the authoritative unit price for a cart line from the official menu
 * catalog (`src/data/menu.ts`) and sauce add-on list so stale or tampered local
 * cart entries cannot submit incorrect totals.
 *
 * Complimentary sides always remain N$ 0.
 */
export function resolveCanonicalUnitPrice(item: CartItem): number | null {
  const baseId = resolveBaseMenuItemId(item);
  const canonical = menuById.get(baseId);
  if (!canonical) return null;
  if (canonical.priceLabel) return null; // Seasonal Quote (S.Q.) cannot be self-priced

  let basePrice = canonical.price;
  if (canonical.variations && canonical.variations.length > 0) {
    const matched = item.weight
      ? canonical.variations.find((v) => v.size === item.weight)
      : canonical.variations[0];
    basePrice = matched ? matched.price : canonical.variations[0].price;
  }

  let sauceTotal = 0;
  if (
    canonical.menuSection === "food" &&
    STEAK_CUSTOMIZABLE_CATEGORIES.has(canonical.category) &&
    Array.isArray(item.sauces)
  ) {
    for (const sauce of item.sauces) {
      const addonPrice = saucePriceById.get(sauce);
      if (typeof addonPrice === "number") {
        sauceTotal += addonPrice;
      }
    }
  }

  return basePrice + sauceTotal;
}

export type RevalidatedOrderResult =
  | {
      ok: true;
      items: KitchenOrderItem[];
      total: number;
      priceAdjusted: boolean;
    }
  | {
      ok: false;
      reason: "empty" | "unavailable" | "invalid_item";
      unavailableNames?: string[];
      invalidNames?: string[];
    };

/**
 * Validates every cart item against live kitchen availability (`disabledIds`)
 * and recomputes canonical menu prices before order submission.
 */
export function revalidateCartForOrder(
  cartItems: CartItem[],
  disabledIds: Set<string>,
  orderMeta?: OrderItemMeta,
): RevalidatedOrderResult {
  if (!cartItems.length) {
    return { ok: false, reason: "empty" };
  }

  const unavailableNames: string[] = [];
  const invalidNames: string[] = [];
  const sanitizedItems: KitchenOrderItem[] = [];
  let total = 0;
  let priceAdjusted = false;

  for (const item of cartItems) {
    const baseId = resolveBaseMenuItemId(item);
    if (disabledIds.has(baseId)) {
      unavailableNames.push(item.name);
      continue;
    }

    const qty = Math.floor(Number(item.quantity));
    const unitPrice = resolveCanonicalUnitPrice(item);
    if (!Number.isFinite(qty) || qty < 1 || qty > 20 || unitPrice === null) {
      invalidNames.push(item.name);
      continue;
    }

    if (Math.abs(unitPrice - item.price) > 0.001) {
      priceAdjusted = true;
    }

    total += unitPrice * qty;

    const cleanItem: KitchenOrderItem = {
      id: baseId,
      name: item.name,
      qty,
      price: unitPrice,
      ...(item.weight ? { weight: item.weight } : {}),
      ...(item.doneness ? { doneness: item.doneness } : {}),
      ...(item.side ? { side: item.side } : {}),
      ...(item.sauces && item.sauces.length > 0 ? { sauces: item.sauces } : {}),
    };
    sanitizedItems.push(cleanItem);
  }

  if (unavailableNames.length > 0) {
    return { ok: false, reason: "unavailable", unavailableNames };
  }
  if (invalidNames.length > 0 || sanitizedItems.length === 0) {
    return { ok: false, reason: "invalid_item", invalidNames };
  }

  const hasMeta =
    orderMeta &&
    Boolean(
      orderMeta.tableNumber ||
        orderMeta.scheduledTime ||
        orderMeta.guestName ||
        orderMeta.dietaryNotes,
    );
  if (hasMeta && sanitizedItems[0]) {
    sanitizedItems[0] = {
      ...sanitizedItems[0],
      orderMeta: {
        ...(orderMeta.tableNumber ? { tableNumber: orderMeta.tableNumber } : {}),
        ...(orderMeta.scheduledTime ? { scheduledTime: orderMeta.scheduledTime } : {}),
        ...(orderMeta.guestName ? { guestName: orderMeta.guestName } : {}),
        ...(orderMeta.dietaryNotes ? { dietaryNotes: orderMeta.dietaryNotes } : {}),
      },
    };
  }

  return {
    ok: true,
    items: sanitizedItems,
    total,
    priceAdjusted,
  };
}

/** Extracts order-level fulfillment & dietary metadata embedded on an order's items JSON. */
export function extractOrderMetaFromItems(items: unknown): OrderItemMeta {
  if (!Array.isArray(items) || items.length === 0) return {};
  for (const item of items) {
    if (item && typeof item === "object" && "orderMeta" in item) {
      const meta = (item as { orderMeta?: unknown }).orderMeta;
      if (meta && typeof meta === "object") {
        return meta as OrderItemMeta;
      }
    }
  }
  return {};
}

/** Deterministic fingerprint of cart + fulfillment payload used for idempotent retries. */
export function buildOrderSubmissionFingerprint(
  items: KitchenOrderItem[],
  orderType: string,
  meta?: OrderItemMeta,
): string {
  return JSON.stringify({
    orderType,
    meta: meta ?? {},
    items: items.map((i) => ({
      id: i.id,
      qty: i.qty,
      price: i.price,
      weight: i.weight ?? "",
      doneness: i.doneness ?? "",
      side: i.side ?? "",
      sauces: i.sauces ?? [],
    })),
  });
}
