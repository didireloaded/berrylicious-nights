/**
 * Domain helpers & client validation for Butcher Block verified food ratings.
 * Authoritative verification happens in Postgres (`submit_verified_food_review`);
 * these helpers validate UX inputs, compute safe eligibility previews, and summarize recurring feedback.
 */

export interface DishRatingSummary {
  menu_item_id: string;
  avg_rating: number;
  review_count: number;
}

export interface PublicFoodReview {
  id: string;
  menu_item_id: string;
  menu_item_name: string;
  reviewer_name: string;
  rating: number;
  comment: string | null;
  photo_url: string | null;
  staff_response: string | null;
  staff_responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManagedFoodReview extends PublicFoodReview {
  order_id: string;
  user_id: string;
  private_issue_note: string | null;
  status: "published" | "hidden" | "flagged" | "removed";
  editable_until: string;
}

export interface OrderLineForReview {
  id?: string;
  name?: string;
  qty?: number;
}

export function normalizeReviewMenuItemId(rawId: string | undefined): string | null {
  if (!rawId || !rawId.trim()) return null;
  const idx = rawId.indexOf("::");
  return (idx === -1 ? rawId : rawId.slice(0, idx)).trim();
}

/**
 * Extracts distinct reviewable dishes from a completed order's items JSON.
 * Prevents duplicate review rows for the same menu item within one order.
 */
export function extractReviewableDishesFromOrder(
  orderStatus: string | null | undefined,
  items: unknown,
): { menuItemId: string; name: string }[] {
  if (orderStatus !== "completed" || !Array.isArray(items)) return [];
  const seen = new Set<string>();
  const dishes: { menuItemId: string; name: string }[] = [];
  for (const raw of items as OrderLineForReview[]) {
    const id = normalizeReviewMenuItemId(raw?.id);
    const name = raw?.name?.trim();
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    dishes.push({ menuItemId: id, name });
  }
  return dishes;
}

export function canEditReview(editableUntilIso: string | null | undefined, nowMs = Date.now()): boolean {
  if (!editableUntilIso) return false;
  const until = Date.parse(editableUntilIso);
  return Number.isFinite(until) && nowMs <= until;
}

export function validateReviewDraft(input: {
  rating: number;
  comment?: string;
  privateIssueNote?: string;
}): { ok: true } | { ok: false; error: string } {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return { ok: false, error: "Please select a star rating from 1 to 5." };
  }
  if (input.comment && input.comment.trim().length > 1200) {
    return { ok: false, error: "Review comments must be 1,200 characters or fewer." };
  }
  if (input.privateIssueNote && input.privateIssueNote.trim().length > 1000) {
    return { ok: false, error: "Private issue notes must be 1,000 characters or fewer." };
  }
  return { ok: true };
}

/** Identifies dishes with recurring low verified ratings (<= 2 stars) for management review. */
export function summarizeRecurringComplaints(
  reviews: Pick<ManagedFoodReview, "menu_item_id" | "menu_item_name" | "rating" | "status">[],
  minLowCount = 2,
): { menuItemId: string; name: string; lowRatingCount: number }[] {
  const counts = new Map<string, { name: string; lowRatingCount: number }>();
  for (const r of reviews) {
    if (r.status === "removed" || r.rating > 2) continue;
    const prev = counts.get(r.menu_item_id);
    if (prev) {
      prev.lowRatingCount += 1;
    } else {
      counts.set(r.menu_item_id, { name: r.menu_item_name, lowRatingCount: 1 });
    }
  }
  return Array.from(counts.entries())
    .filter(([, v]) => v.lowRatingCount >= minLowCount)
    .map(([menuItemId, v]) => ({ menuItemId, ...v }))
    .sort((a, b) => b.lowRatingCount - a.lowRatingCount);
}
