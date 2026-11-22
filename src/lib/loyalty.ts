/**
 * Pure domain logic for Butcher Block Rewards & Guest of the Week.
 * Authoritative points earning, reversals, redemptions, and consent gates live in Postgres RPCs;
 * these helpers calculate UI progress, simulate rules previews cleanly, and verify invariants in unit tests.
 */

export interface LoyaltyRules {
  enabled: boolean;
  points_per_nad: number;
  min_qualifying_nad: number;
  excluded_categories: string[];
  excluded_item_ids: string[];
  award_on_reservation_arrival: boolean;
  reservation_bonus_points: number;
  points_expiry_days: number | null;
}

export interface LoyaltyLedgerEntry {
  id: string;
  user_id: string;
  order_id: string | null;
  redemption_id: string | null;
  entry_type: "earn" | "redeem" | "reverse" | "bonus" | "expire";
  points: number;
  idempotency_key: string;
  note: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface RewardCatalogItem {
  id: string;
  title: string;
  description: string | null;
  category: "dessert" | "side" | "drink" | "discount" | "birthday" | "general";
  points_cost: number;
  active: boolean;
  expires_at: string | null;
  terms: string | null;
}

export interface RewardRedemptionRow {
  id: string;
  user_id: string;
  reward_id: string;
  points_spent: number;
  redemption_code: string;
  source: "loyalty_points" | "guest_of_the_week";
  status: "issued" | "used" | "cancelled" | "expired";
  created_at: string;
  used_at: string | null;
}

export interface PublicGuestOfWeek {
  id: string;
  week_start: string;
  approved_display_name: string;
  approved_photo_url: string | null;
  recognition_message: string;
  reward_title: string | null;
  consented_at: string | null;
}

export interface GuestOfWeekRecord {
  id: string;
  week_start: string;
  user_id: string;
  approved_display_name: string;
  approved_photo_url: string | null;
  recognition_message: string;
  status: "shortlisted" | "approved_pending_consent" | "accepted_published" | "declined" | "withdrawn";
  photo_consent: boolean;
  social_consent: boolean;
  reward_id: string | null;
  reward_redemption_id: string | null;
  consented_at: string | null;
  withdrawn_at: string | null;
}

/**
 * Computes spend-based earned points strictly matching the Postgres `award_order_loyalty_points` rules.
 * Unpaid or non-completed orders always return 0.
 */
export function calculateQualifyingOrderPoints(
  order: {
    status: string;
    payment_status: string;
    total: number;
    items: { id?: string; category?: string; price: number; qty: number }[];
  },
  rules: LoyaltyRules,
): number {
  if (!rules.enabled || rules.points_per_nad <= 0) return 0;
  if (order.status !== "completed" || order.payment_status !== "paid") return 0;

  const excludedCats = new Set(rules.excluded_categories);
  const excludedIds = new Set(rules.excluded_item_ids);

  let eligibleNad = 0;
  for (const item of order.items) {
    if (item.id && excludedIds.has(item.id)) continue;
    if (item.category && excludedCats.has(item.category)) continue;
    eligibleNad += Math.max(0, item.price) * Math.max(1, Math.floor(item.qty));
  }

  eligibleNad = Math.min(eligibleNad, Math.max(0, order.total));
  if (eligibleNad < rules.min_qualifying_nad) return 0;
  return Math.floor(eligibleNad * rules.points_per_nad);
}

/** Computes unexpired available balance from ledger entries. */
export function computeLoyaltyBalanceFromLedger(
  entries: Pick<LoyaltyLedgerEntry, "points" | "expires_at">[],
  nowMs = Date.now(),
): number {
  let sum = 0;
  for (const entry of entries) {
    if (entry.points > 0 && entry.expires_at && Date.parse(entry.expires_at) <= nowMs) {
      continue;
    }
    sum += entry.points;
  }
  return Math.max(0, sum);
}

/** Finds the closest next reward target above current balance (or lowest active reward). */
export function findNextRewardProgress(
  balance: number,
  catalog: RewardCatalogItem[],
  nowMs = Date.now(),
): { nextReward: RewardCatalogItem | null; pointsNeeded: number; percent: number } {
  const active = catalog
    .filter((r) => r.active && (!r.expires_at || Date.parse(r.expires_at) > nowMs))
    .sort((a, b) => a.points_cost - b.points_cost);

  if (active.length === 0) {
    return { nextReward: null, pointsNeeded: 0, percent: 0 };
  }

  const next = active.find((r) => r.points_cost > balance) ?? active[active.length - 1];
  const pointsNeeded = Math.max(0, next.points_cost - balance);
  const percent = next.points_cost > 0 ? Math.min(100, Math.round((balance / next.points_cost) * 100)) : 0;
  return { nextReward: next, pointsNeeded, percent };
}

/**
 * Pure mirror of the fair non-spend-only Guest of the Week score.
 * Caps each dimension so high spending alone cannot dominate community recognition.
 */
export function calculateCommunityRecognitionScore(input: {
  completedOrders: number;
  verifiedReviews: number;
  loyaltyEvents: number;
  totalVisits: number;
}): number {
  return (
    Math.min(Math.max(0, input.completedOrders), 5) * 15 +
    Math.min(Math.max(0, input.verifiedReviews), 5) * 20 +
    Math.min(Math.max(0, input.loyaltyEvents), 5) * 10 +
    Math.min(Math.max(0, input.totalVisits), 10) * 5
  );
}

/** Returns Monday ISO date (YYYY-MM-DD) for the current Windhoek week. */
export function getCurrentWeekStartISO(todayISO: string): string {
  const d = new Date(`${todayISO}T12:00:00Z`);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
